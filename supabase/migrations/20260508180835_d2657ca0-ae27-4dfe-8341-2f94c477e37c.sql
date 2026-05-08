GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_access_business(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_workspace_role(uuid, uuid, app_role[]) TO authenticated, anon;