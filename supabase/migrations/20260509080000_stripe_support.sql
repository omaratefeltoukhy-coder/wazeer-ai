-- =============================================================================
-- Stripe support migration
-- 1) Add provider + provider_transaction_id columns to transactions
-- 2) Update record_payment_link_purchase to accept generic provider info
-- 3) Add stripe_subscription_id to subscriptions table
-- =============================================================================

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS provider text DEFAULT 'paddle',
  ADD COLUMN IF NOT EXISTS provider_transaction_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_provider_txn
  ON public.transactions (provider, provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS provider text DEFAULT 'paddle',
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub
  ON public.subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- Update the function signature to support any provider
DROP FUNCTION IF EXISTS public.record_payment_link_purchase(text, text, text, text, numeric, text, text);

CREATE OR REPLACE FUNCTION public.record_payment_link_purchase(
  _code                   text,
  _buyer_name             text,
  _buyer_email            text,
  _buyer_phone            text,
  _amount                 numeric,
  _currency               text,
  _provider_transaction_id text DEFAULT NULL,
  _provider               text DEFAULT 'paddle'
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
  -- Idempotency: if a transaction with this provider ID already exists, return it.
  IF _provider_transaction_id IS NOT NULL THEN
    SELECT id INTO v_tx_id
      FROM public.transactions
     WHERE provider = _provider
       AND provider_transaction_id = _provider_transaction_id
     LIMIT 1;
    IF FOUND THEN
      RETURN v_tx_id;
    END IF;
  END IF;

  -- Resolve the link (must be active).
  SELECT id, workspace_id, product_id, amount AS link_amount, pass_fee_to_buyer
    INTO v_link
    FROM public.payment_links
   WHERE unique_code = _code
     AND active = true;

  IF v_link IS NULL THEN
    RAISE EXCEPTION 'Payment link not found or inactive: %', _code;
  END IF;

  -- Insert the transaction.
  INSERT INTO public.transactions (
    workspace_id,
    product_id,
    amount,
    currency,
    buyer_name,
    buyer_email,
    buyer_phone,
    metadata_json,
    provider,
    provider_transaction_id
  ) VALUES (
    v_link.workspace_id,
    v_link.product_id,
    _amount,
    _currency,
    _buyer_name,
    _buyer_email,
    _buyer_phone,
    jsonb_build_object(
      'link_amount', v_link.link_amount,
      'pass_fee_to_buyer', v_link.pass_fee_to_buyer,
      'payment_link_code', _code
    ),
    _provider,
    _provider_transaction_id
  )
  RETURNING id INTO v_tx_id;

  -- Increment sales count.
  UPDATE public.payment_links
     SET sales_count = COALESCE(sales_count, 0) + 1
   WHERE id = v_link.id;

  RETURN v_tx_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_payment_link_purchase(text, text, text, text, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_payment_link_purchase(text, text, text, text, numeric, text, text, text) TO anon, authenticated;
