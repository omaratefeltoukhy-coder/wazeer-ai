
-- 1) workspace_members: remove self-join branch
DROP POLICY IF EXISTS "owners insert members" ON public.workspace_members;
CREATE POLICY "owners insert members"
  ON public.workspace_members FOR INSERT
  WITH CHECK (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin']::public.app_role[]));

-- 2) subscriptions: restrict member-facing policy to SELECT/UPDATE only
DROP POLICY IF EXISTS "owners manage subscription" ON public.subscriptions;
CREATE POLICY "members view subscription"
  ON public.subscriptions FOR SELECT
  USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "owners update subscription"
  ON public.subscriptions FOR UPDATE
  USING (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin']::public.app_role[]))
  WITH CHECK (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin']::public.app_role[]));

-- 3) email_unsubscribe_tokens: restrict members to no direct access; service role only
DROP POLICY IF EXISTS "members manage unsub tokens" ON public.email_unsubscribe_tokens;
