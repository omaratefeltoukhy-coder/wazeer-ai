
ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS body_html text,
  ADD COLUMN IF NOT EXISTS audience_type text DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS recipients_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opens_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicks_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bounces_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unsubscribes_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.email_automations
  ADD COLUMN IF NOT EXISTS automation_type text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS body_html text,
  ADD COLUMN IF NOT EXISTS delay_minutes integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS sent_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opens_count integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_automation_per_business_type
  ON public.email_automations(business_id, automation_type)
  WHERE automation_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_campaigns_business_created
  ON public.email_campaigns(business_id, created_at DESC);
