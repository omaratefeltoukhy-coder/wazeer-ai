-- =============================================================================
-- Lovable Security Scan Fixes
-- Addresses: invoices insert, subscriptions update, profiles cross-read,
--            storage workspace scoping
-- =============================================================================

-- =============================================================================
-- 1) invoices — restrict INSERT to workspace owners/admins only
--    Lovable: "Workspace members can insert their own invoice records"
-- =============================================================================

DROP POLICY IF EXISTS "members insert invoices" ON public.invoices;

CREATE POLICY "owners insert invoices"
  ON public.invoices FOR INSERT
  WITH CHECK (
    public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin']::public.app_role[])
  );

-- Also restrict UPDATE/DELETE to owners/admins (defense in depth)
DROP POLICY IF EXISTS "members update invoices" ON public.invoices;
DROP POLICY IF EXISTS "members delete invoices" ON public.invoices;

CREATE POLICY "owners update invoices"
  ON public.invoices FOR UPDATE
  USING (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin']::public.app_role[]));

CREATE POLICY "owners delete invoices"
  ON public.invoices FOR DELETE
  USING (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin']::public.app_role[]));


-- =============================================================================
-- 2) subscriptions — remove owner UPDATE. Only service role / webhooks should
--    mutate subscriptions. Lovable: "Workspace owners can directly update
--    subscription rows"
-- =============================================================================

DROP POLICY IF EXISTS "owners update subscription" ON public.subscriptions;

-- Keep SELECT so owners can view their subscription status
-- No INSERT/UPDATE/DELETE for authenticated users — service role only


-- =============================================================================
-- 3) profiles — allow workspace co-members to read each other's basic profile
--    Lovable: "Users can only read their own profile, but workspace co-members
--    cannot look up each other's email/name"
-- =============================================================================

-- Add a policy so workspace members can view profiles of other members in the same workspace
CREATE POLICY "workspace members view profiles"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm1
      JOIN public.workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
      WHERE wm1.user_id = auth.uid() AND wm2.user_id = profiles.id
    )
  );


-- =============================================================================
-- 4) Storage — product-covers: scope by workspace membership, not uploader UID
--    Lovable: "Product-cover storage policies scope by uploader UID folder,
--    not workspace membership"
-- =============================================================================

-- The upload path format is changed from `user_id/filename` to `workspace_id/filename`
-- so we can verify workspace membership directly from the path.

DROP POLICY IF EXISTS "Authenticated upload product covers" ON storage.objects;
DROP POLICY IF EXISTS "Owners update product covers" ON storage.objects;
DROP POLICY IF EXISTS "Owners delete product covers" ON storage.objects;

CREATE POLICY "workspace members insert product covers"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-covers'
    AND public.is_workspace_member(
      (storage.foldername(name))[1]::uuid,
      auth.uid()
    )
  );

CREATE POLICY "workspace members update product covers"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-covers'
    AND public.is_workspace_member(
      (storage.foldername(name))[1]::uuid,
      auth.uid()
    )
  );

CREATE POLICY "workspace members delete product covers"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-covers'
    AND public.is_workspace_member(
      (storage.foldername(name))[1]::uuid,
      auth.uid()
    )
  );
