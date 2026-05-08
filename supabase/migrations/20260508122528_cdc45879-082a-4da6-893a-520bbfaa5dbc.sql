
ALTER FUNCTION public.encrypt_meta_token(text, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.decrypt_meta_token(bytea, text) SET search_path = public, pg_temp;
