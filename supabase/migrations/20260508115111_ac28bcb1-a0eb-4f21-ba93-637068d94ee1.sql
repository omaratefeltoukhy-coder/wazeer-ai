
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  business_id uuid,
  user_id uuid,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_workspace_idx ON public.audit_logs(workspace_id, created_at DESC);
CREATE INDEX audit_logs_business_idx ON public.audit_logs(business_id, created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "members insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
