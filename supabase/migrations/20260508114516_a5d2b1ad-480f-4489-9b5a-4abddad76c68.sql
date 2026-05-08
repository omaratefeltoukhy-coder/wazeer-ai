REVOKE ALL ON FUNCTION public.consume_credits(uuid, integer, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_usage(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.seed_workspace_billing() FROM PUBLIC, anon, authenticated;