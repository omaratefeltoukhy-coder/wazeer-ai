-- credit_grants: each grant is a chunk of credits the workspace received (trial, plan, top-up)
CREATE TABLE IF NOT EXISTS public.credit_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  source text NOT NULL, -- 'trial' | 'plan' | 'topup' | 'refund' | 'adjustment'
  amount integer NOT NULL,
  balance integer NOT NULL,
  expires_at timestamptz,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS credit_grants_workspace_idx ON public.credit_grants(workspace_id, created_at);

ALTER TABLE public.credit_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view grants" ON public.credit_grants
  FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));

-- usage_counters: per-feature, per-month rolling counter
CREATE TABLE IF NOT EXISTS public.usage_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  feature text NOT NULL,
  period_start date NOT NULL,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, feature, period_start)
);

ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view usage" ON public.usage_counters
  FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));

-- consume_credits: deduct N credits from oldest non-expired grant; log a transaction
CREATE OR REPLACE FUNCTION public.consume_credits(
  _workspace_id uuid,
  _amount integer,
  _reason text,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining integer := _amount;
  g RECORD;
  total_balance integer;
BEGIN
  IF _amount <= 0 THEN RETURN true; END IF;

  SELECT COALESCE(SUM(balance),0) INTO total_balance
  FROM public.credit_grants
  WHERE workspace_id = _workspace_id
    AND balance > 0
    AND (expires_at IS NULL OR expires_at > now());

  IF total_balance < _amount THEN RETURN false; END IF;

  FOR g IN
    SELECT * FROM public.credit_grants
    WHERE workspace_id = _workspace_id
      AND balance > 0
      AND (expires_at IS NULL OR expires_at > now())
    ORDER BY created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN remaining <= 0;
    IF g.balance >= remaining THEN
      UPDATE public.credit_grants SET balance = balance - remaining WHERE id = g.id;
      remaining := 0;
    ELSE
      remaining := remaining - g.balance;
      UPDATE public.credit_grants SET balance = 0 WHERE id = g.id;
    END IF;
  END LOOP;

  INSERT INTO public.credit_transactions(workspace_id, amount, reason, metadata_json)
  VALUES (_workspace_id, -_amount, _reason, _metadata);

  RETURN true;
END;
$$;

-- increment_usage: bump per-month counter
CREATE OR REPLACE FUNCTION public.increment_usage(
  _workspace_id uuid,
  _feature text,
  _by integer DEFAULT 1
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ps date := date_trunc('month', now())::date;
BEGIN
  INSERT INTO public.usage_counters(workspace_id, feature, period_start, count)
  VALUES (_workspace_id, _feature, ps, _by)
  ON CONFLICT (workspace_id, feature, period_start)
  DO UPDATE SET count = usage_counters.count + EXCLUDED.count, updated_at = now();
END;
$$;

-- Trigger: seed trial credits + subscription when a workspace is created
CREATE OR REPLACE FUNCTION public.seed_workspace_billing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.credit_grants(workspace_id, source, amount, balance, expires_at, metadata_json)
  VALUES (NEW.id, 'trial', 100, 100, now() + interval '14 days', jsonb_build_object('plan','trial'));

  INSERT INTO public.subscriptions(workspace_id, user_id, plan, status, current_period_end)
  VALUES (NEW.id, NEW.owner_user_id, 'trial', 'trialing', now() + interval '14 days');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workspaces_seed_billing ON public.workspaces;
CREATE TRIGGER workspaces_seed_billing
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.seed_workspace_billing();

-- Backfill: ensure existing workspaces have at least one grant
INSERT INTO public.credit_grants(workspace_id, source, amount, balance, expires_at, metadata_json)
SELECT w.id, 'trial', 100, 100, now() + interval '14 days', jsonb_build_object('plan','trial','backfill',true)
FROM public.workspaces w
WHERE NOT EXISTS (SELECT 1 FROM public.credit_grants g WHERE g.workspace_id = w.id);