
-- Fix trigger function search path
create or replace function public.set_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin new.updated_at = now(); return new; end;
$$;

-- Revoke direct execute from public/authenticated roles for SECURITY DEFINER helpers.
-- They are still callable from RLS policies and the auth trigger because those
-- run in the function owner's context.
revoke execute on function public.is_workspace_member(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.has_workspace_role(uuid, uuid, public.app_role[]) from public, anon, authenticated;
revoke execute on function public.can_access_business(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
