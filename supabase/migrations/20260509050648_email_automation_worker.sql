-- Email automation worker tables and RPC helpers

-- Enrollment tracking for email automations
CREATE TABLE IF NOT EXISTS public.email_automation_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES public.email_automations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'sent', 'failed', 'completed', 'skipped')),
  execute_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  metadata_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(automation_id, contact_id)
);

ALTER TABLE public.email_automation_enrollments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can manage enrollments"
    ON public.email_automation_enrollments FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_automation_enrollments_status_execute ON public.email_automation_enrollments(status, execute_at);
CREATE INDEX IF NOT EXISTS idx_email_automation_enrollments_contact ON public.email_automation_enrollments(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_automation_enrollments_automation ON public.email_automation_enrollments(automation_id);

-- Add last_run_at to email_automations for worker tracking
ALTER TABLE public.email_automations ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMPTZ;

-- Increment automation sent count (atomic, avoids race conditions)
CREATE OR REPLACE FUNCTION public.increment_automation_sent(automation_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.email_automations
  SET sent_count = sent_count + 1, updated_at = now()
  WHERE id = automation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_automation_sent(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_automation_sent(UUID) TO service_role;

-- Helper: find contacts for re-engagement automation
-- Returns contacts who have been sent emails but haven't opened any since p_since
CREATE OR REPLACE FUNCTION public.get_re_engagement_contacts(p_business_id UUID, p_since TIMESTAMPTZ)
RETURNS TABLE(id UUID, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.created_at
  FROM public.contacts c
  WHERE c.business_id = p_business_id
    AND c.unsubscribed_at IS NULL
    AND c.status != 'unsubscribed'
    AND EXISTS (
      SELECT 1 FROM public.email_events e
      WHERE e.contact_id = c.id AND e.event_type = 'sent'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.email_events e
      WHERE e.contact_id = c.id AND e.event_type = 'opened' AND e.created_at > p_since
    )
    AND c.created_at < p_since;
END;
$$;

REVOKE ALL ON FUNCTION public.get_re_engagement_contacts(UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_re_engagement_contacts(UUID, TIMESTAMPTZ) TO service_role;

-- Cron job to trigger automation worker every 5 minutes
-- Uses pg_net to POST to the internal automation worker endpoint
-- Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be available
DO $$
DECLARE
  cron_exists boolean;
  supabase_url text;
  service_key text;
BEGIN
  -- Check if pg_cron extension exists
  SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') INTO cron_exists;
  IF NOT cron_exists THEN
    RAISE NOTICE 'pg_cron not available, skipping cron setup';
    RETURN;
  END IF;

  -- Unschedule existing job if any (idempotent)
  PERFORM cron.unschedule('process-email-automations');

  -- Read credentials from vault if available, otherwise skip
  BEGIN
    SELECT decrypted_secret INTO service_key
    FROM vault.decrypted_secrets
    WHERE name = 'email_queue_service_role_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    service_key := NULL;
  END;

  IF service_key IS NULL THEN
    RAISE NOTICE 'Service role key not found in vault, skipping cron setup. Set it up manually via Supabase dashboard.';
    RETURN;
  END IF;

  supabase_url := current_setting('app.settings.supabase_url', true);
  IF supabase_url IS NULL OR supabase_url = '' THEN
    supabase_url := 'https://' || current_setting('app.settings.supabase_project_ref', true) || '.supabase.co';
  END IF;

  IF supabase_url IS NULL OR supabase_url = '' THEN
    RAISE NOTICE 'Could not determine Supabase URL, skipping cron setup';
    RETURN;
  END IF;

  PERFORM cron.schedule(
    'process-email-automations',
    '*/5 * * * *',
    format(
      'SELECT net.http_post(url:=%L, headers:=''{"Authorization":"Bearer %s","Content-Type":"application/json"}''::jsonb, body:=''{}''::jsonb)',
      supabase_url || '/functions/v1/email-automations-process',
      service_key
    )
  );
END $$;
