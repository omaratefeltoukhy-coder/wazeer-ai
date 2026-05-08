
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.meta_connections
  ADD COLUMN IF NOT EXISTS encrypted_token bytea,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'meta',
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_meta_connections_biz_kind
  ON public.meta_connections(business_id, kind);

ALTER TABLE public.meta_posts
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS hashtags text,
  ADD COLUMN IF NOT EXISTS cta_text text,
  ADD COLUMN IF NOT EXISTS post_type text,
  ADD COLUMN IF NOT EXISTS error_message text;

ALTER TABLE public.meta_ads
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS copy_json jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.meta_campaigns
  ADD COLUMN IF NOT EXISTS daily_budget numeric,
  ADD COLUMN IF NOT EXISTS total_budget numeric,
  ADD COLUMN IF NOT EXISTS audience_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS goal text;

-- Encrypt/decrypt helpers (key passed in, never persisted; SECURITY DEFINER not needed)
CREATE OR REPLACE FUNCTION public.encrypt_meta_token(_plaintext text, _key text)
RETURNS bytea LANGUAGE sql IMMUTABLE AS $$
  SELECT pgp_sym_encrypt(_plaintext, _key);
$$;

CREATE OR REPLACE FUNCTION public.decrypt_meta_token(_cipher bytea, _key text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT pgp_sym_decrypt(_cipher, _key);
$$;
