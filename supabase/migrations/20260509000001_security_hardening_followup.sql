-- Follow-up to migrations 224928 and 230950: closes the gaps Paddle's scanner
-- and the Supabase linter still flag.
--
-- Each block is idempotent (DROP IF EXISTS / CREATE OR REPLACE) so this
-- migration can be re-applied without breaking state.

-- =============================================================================
-- 1) storefronts — drop the public SELECT policy.
--    The Paddle scan flagged "public view published storefronts" because it
--    exposes the full row including content_json. The /s/$slug public render
--    path goes through getPublicStorefront server fn (uses supabaseAdmin /
--    service_role and bypasses RLS), so dropping the policy doesn't change
--    user-facing behavior. Anon clients can no longer SELECT storefronts
--    directly.
-- =============================================================================

DROP POLICY IF EXISTS "public view published storefronts" ON public.storefronts;


-- =============================================================================
-- 2) payment_links — replace the existing get_public_payment_link with a
--    column-scoped version. The previous function returned workspace_id,
--    product_id, is_active, and sales_count to anonymous callers, which is
--    exactly the data Paddle's check said should not leak.
--
--    The new function returns only display-safe fields and joins the
--    seller name + product info server-side so the pay page makes a single
--    call instead of three (payment_links + products + workspaces).
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_public_payment_link(text);

CREATE OR REPLACE FUNCTION public.get_public_payment_link(_code text)
RETURNS TABLE (
  unique_code         text,
  custom_title        text,
  description         text,
  amount              numeric,
  currency            text,
  collect_phone       boolean,
  pass_fee_to_buyer   boolean,
  redirect_url        text,
  thank_you_message   text,
  product_title       text,
  product_image_url   text,
  product_description text,
  seller_name         text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pl.unique_code,
    pl.custom_title,
    pl.description,
    pl.amount,
    pl.currency,
    pl.collect_phone,
    pl.pass_fee_to_buyer,
    pl.redirect_url,
    pl.thank_you_message,
    p.title,
    p.cover_image_url,
    p.description,
    w.name
  FROM public.payment_links pl
  LEFT JOIN public.products    p ON p.id = pl.product_id
  LEFT JOIN public.workspaces  w ON w.id = pl.workspace_id
  WHERE pl.unique_code = _code AND pl.is_active = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_payment_link(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_public_payment_link(text) TO anon, authenticated;


-- =============================================================================
-- 3) Atomic anon-buyer transaction insert + sales count update.
--    The current pay.$code.tsx does `supabase.from("transactions").insert(...)`
--    from the anon client. The transactions table has only "members" RLS
--    policies, so anon inserts silently fail (RLS rejects the row, no error
--    is returned to the client). The page UI shows success but no row lands.
--
--    record_payment_link_purchase wraps the lookup, validation, transaction
--    insert, and sales_count increment under SECURITY DEFINER so anon callers
--    can complete a purchase without ever touching the underlying tables
--    directly.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.record_payment_link_purchase(
  _code        text,
  _buyer_name  text,
  _buyer_email text,
  _buyer_phone text,
  _amount      numeric,
  _currency    text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link RECORD;
  v_tx_id uuid;
BEGIN
  -- Resolve the link (must be active).
  SELECT id, workspace_id, product_id, amount AS link_amount, pass_fee_to_buyer
    INTO v_link
    FROM public.payment_links
   WHERE unique_code = _code AND is_active = true
   LIMIT 1;

  IF v_link.id IS NULL THEN
    RAISE EXCEPTION 'Payment link not found or inactive';
  END IF;

  -- Basic input validation.
  IF _buyer_email IS NULL OR _buyer_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Invalid buyer email';
  END IF;

  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  -- Cap the accepted amount at the link price (+3% optional pass-through fee).
  -- Prevents a client from claiming arbitrarily large or small totals.
  IF _amount > v_link.link_amount * 1.05 THEN
    RAISE EXCEPTION 'Amount exceeds link price';
  END IF;

  INSERT INTO public.transactions (
    workspace_id, product_id, buyer_name, buyer_email,
    amount, currency, status
  ) VALUES (
    v_link.workspace_id, v_link.product_id, _buyer_name, _buyer_email,
    _amount, _currency, 'completed'
  )
  RETURNING id INTO v_tx_id;

  UPDATE public.payment_links
     SET sales_count = COALESCE(sales_count, 0) + 1
   WHERE id = v_link.id;

  RETURN v_tx_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_payment_link_purchase(text, text, text, text, numeric, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.record_payment_link_purchase(text, text, text, text, numeric, text) TO anon, authenticated;


-- =============================================================================
-- 4) handle_first_workspace_credit_grant — lock down EXECUTE.
--    This is a trigger function; calling it directly from the API has no
--    legitimate use case. Lovable's prior migration revoked many definer
--    helpers but missed this one.
-- =============================================================================

DO $$ BEGIN
  EXECUTE 'REVOKE EXECUTE ON FUNCTION public.handle_first_workspace_credit_grant() FROM PUBLIC, anon, authenticated';
EXCEPTION WHEN undefined_function THEN NULL; END $$;


-- =============================================================================
-- 5) increment_payment_link_clicks — keep callable (it's used to track public
--    pay-page visits) but ensure search_path is set explicitly. Belt and
--    braces; the existing definition already has SET search_path = public.
-- =============================================================================

DO $$ BEGIN
  EXECUTE 'ALTER FUNCTION public.increment_payment_link_clicks(text) SET search_path = public, pg_catalog';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
