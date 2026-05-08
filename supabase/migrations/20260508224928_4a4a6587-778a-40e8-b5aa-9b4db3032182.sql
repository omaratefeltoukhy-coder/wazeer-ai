
-- 1) Remove permissive public SELECT on email_unsubscribe_tokens (server functions use service role)
DROP POLICY IF EXISTS "public read unsub token" ON public.email_unsubscribe_tokens;

-- 2) Remove broad public SELECT on payment_links; expose only via security definer RPC
DROP POLICY IF EXISTS "public view active by code" ON public.payment_links;

CREATE OR REPLACE FUNCTION public.get_public_payment_link(_code text)
RETURNS TABLE (
  id uuid,
  workspace_id uuid,
  product_id uuid,
  unique_code text,
  amount numeric,
  currency text,
  description text,
  custom_title text,
  thank_you_message text,
  collect_phone boolean,
  pass_fee_to_buyer boolean,
  redirect_url text,
  is_active boolean,
  sales_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id, workspace_id, product_id, unique_code, amount, currency,
         description, custom_title, thank_you_message, collect_phone,
         pass_fee_to_buyer, redirect_url, is_active, sales_count
  FROM public.payment_links
  WHERE unique_code = _code AND is_active = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_payment_link(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_payment_link(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_payment_link_sale(_code text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.payment_links
  SET sales_count = sales_count + 1
  WHERE unique_code = _code AND is_active = true;
$$;
REVOKE ALL ON FUNCTION public.record_payment_link_sale(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_payment_link_sale(text) TO anon, authenticated;

-- 3) Tighten billing_events: drop NULL workspace branch
DROP POLICY IF EXISTS "members view billing events" ON public.billing_events;
CREATE POLICY "members view billing events"
ON public.billing_events
FOR SELECT
USING (workspace_id IS NOT NULL AND is_workspace_member(workspace_id, auth.uid()));

-- 4) credit_transactions: remove member INSERT (server uses service role which bypasses RLS)
DROP POLICY IF EXISTS "members insert credits" ON public.credit_transactions;

-- 5) Fix mutable search_path on email/queue helper functions, and lock down EXECUTE
CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pgmq'
AS $function$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pgmq'
AS $function$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pgmq'
AS $function$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$function$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pgmq'
AS $function$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN PERFORM pgmq.create(dlq_name); EXCEPTION WHEN OTHERS THEN NULL; END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN PERFORM pgmq.delete(source_queue, message_id); EXCEPTION WHEN undefined_table THEN NULL; END;
  RETURN new_id;
END;
$function$;

-- Revoke EXECUTE from anon/authenticated on internal definer functions
REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.encrypt_meta_token(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decrypt_meta_token(bytea, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_credits(uuid, integer, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_usage(uuid, text, integer) FROM PUBLIC, anon, authenticated;
