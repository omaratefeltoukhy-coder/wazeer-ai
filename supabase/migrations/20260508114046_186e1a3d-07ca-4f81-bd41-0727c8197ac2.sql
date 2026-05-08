ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS generation_log_json jsonb NOT NULL DEFAULT '{}'::jsonb;