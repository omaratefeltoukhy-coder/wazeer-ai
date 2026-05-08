
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  campaign_id uuid NOT NULL,
  position integer NOT NULL DEFAULT 0,
  name text NOT NULL,
  goal text,
  subject_line text NOT NULL,
  preview_text text,
  body_markdown text,
  cta_text text,
  cta_url_placeholder text,
  send_delay text,
  success_metric text,
  personalization_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_messages_campaign ON public.email_messages(campaign_id, position);
CREATE INDEX IF NOT EXISTS idx_email_messages_business ON public.email_messages(business_id);
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage email messages" ON public.email_messages
  FOR ALL USING (public.can_access_business(business_id, auth.uid()))
  WITH CHECK (public.can_access_business(business_id, auth.uid()));
CREATE TRIGGER set_email_messages_updated BEFORE UPDATE ON public.email_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.suppression_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  email text NOT NULL,
  reason text NOT NULL DEFAULT 'unsubscribed',
  source text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, email)
);
CREATE INDEX IF NOT EXISTS idx_suppression_business_email ON public.suppression_list(business_id, email);
ALTER TABLE public.suppression_list ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage suppression" ON public.suppression_list
  FOR ALL USING (public.can_access_business(business_id, auth.uid()))
  WITH CHECK (public.can_access_business(business_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.email_unsubscribe_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  contact_id uuid,
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_unsub_token ON public.email_unsubscribe_tokens(token);
ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage unsub tokens" ON public.email_unsubscribe_tokens
  FOR ALL USING (public.can_access_business(business_id, auth.uid()))
  WITH CHECK (public.can_access_business(business_id, auth.uid()));
CREATE POLICY "public read unsub token" ON public.email_unsubscribe_tokens
  FOR SELECT USING (true);
