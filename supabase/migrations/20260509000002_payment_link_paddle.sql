-- Payment link Paddle integration: idempotency + metadata support
-- 
-- 1) Add metadata_json to transactions so we can store paddle_transaction_id
--    for duplicate-prevention and audit trails.
-- 2) Replace record_payment_link_purchase with a 7-arg version that accepts
--    an optional paddle_transaction_id. Drops the old 6-arg signature.

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS metadata_json jsonb DEFAULT '{}';

DROP FUNCTION IF EXISTS public.record_payment_link_purchase(text, text, text, text, numeric, text);

CREATE OR REPLACE FUNCTION public.record_payment_link_purchase(
  _code                   text,
  _buyer_name             text,
  _buyer_email            text,
  _buyer_phone            text,
  _amount                 numeric,
  _currency               text,
  _paddle_transaction_id  text DEFAULT NULL
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
  -- Idempotency: if a transaction with this Paddle ID already exists, return it.
  IF _paddle_transaction_id IS NOT NULL THEN
    SELECT id INTO v_tx_id
    FROM public.transactions
    WHERE metadata_json->>'paddle_transaction_id' = _paddle_transaction_id
    LIMIT 1;

    IF v_tx_id IS NOT NULL THEN
      RETURN v_tx_id;
    END IF;
  END IF;

  -- Resolve the link (must be active).
  SELECT id, workspace_id, product_id, amount AS link_amount, pass_fee_to_buyer
    INTO v_link
    FROM public.payment_links
   WHERE unique_code = _code AND is_active = true
   LIMIT 1;

  IF v_link.id IS NULL THEN
    RAISE EXCEPTION 'Payment link not found or inactive';
  END IF;

  -- Basic input validation. Avoids regex flavor issues by using LIKE.
  IF _buyer_email IS NULL
     OR length(_buyer_email) < 5
     OR _buyer_email NOT LIKE '%_@_%.__%'
  THEN
    RAISE EXCEPTION 'Invalid buyer email';
  END IF;

  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  -- Cap the accepted amount at the link price (+5% to allow minor fee variations).
  IF _amount > v_link.link_amount * 1.05 THEN
    RAISE EXCEPTION 'Amount exceeds link price';
  END IF;

  INSERT INTO public.transactions (
    workspace_id, product_id, buyer_name, buyer_email,
    amount, currency, status, metadata_json
  ) VALUES (
    v_link.workspace_id, v_link.product_id, _buyer_name, _buyer_email,
    _amount, _currency, 'completed',
    CASE WHEN _paddle_transaction_id IS NOT NULL
      THEN jsonb_build_object('paddle_transaction_id', _paddle_transaction_id)
      ELSE '{}'
    END
  )
  RETURNING id INTO v_tx_id;

  UPDATE public.payment_links
     SET sales_count = COALESCE(sales_count, 0) + 1
   WHERE id = v_link.id;

  RETURN v_tx_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_payment_link_purchase(text, text, text, text, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_payment_link_purchase(text, text, text, text, numeric, text, text) TO anon, authenticated;
