
CREATE TABLE IF NOT EXISTS public.payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  product_id uuid,
  custom_title text,
  description text,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  thank_you_message text,
  redirect_url text,
  pass_fee_to_buyer boolean NOT NULL DEFAULT true,
  collect_phone boolean NOT NULL DEFAULT false,
  unique_code text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  clicks integer NOT NULL DEFAULT 0,
  sales_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view payment_links" ON public.payment_links FOR SELECT
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "public view active by code" ON public.payment_links FOR SELECT
  USING (is_active = true);

CREATE POLICY "members insert payment_links" ON public.payment_links FOR INSERT
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()) AND auth.uid() = user_id);

CREATE POLICY "members update payment_links" ON public.payment_links FOR UPDATE
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "owners delete payment_links" ON public.payment_links FOR DELETE
  USING (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner'::app_role,'admin'::app_role]));

CREATE TRIGGER trg_payment_links_updated BEFORE UPDATE ON public.payment_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Public RPC to increment clicks safely
CREATE OR REPLACE FUNCTION public.increment_payment_link_clicks(_code text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.payment_links SET clicks = clicks + 1 WHERE unique_code = _code AND is_active = true;
$$;
