CREATE OR REPLACE FUNCTION public.seed_workspace_billing()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.credit_grants(workspace_id, source, amount, balance, expires_at, metadata_json)
  VALUES (NEW.id, 'trial', 100, 100, now() + interval '7 days', jsonb_build_object('plan','trial'));

  INSERT INTO public.subscriptions(workspace_id, user_id, plan, status, current_period_end)
  VALUES (NEW.id, NEW.owner_user_id, 'trial', 'trialing', now() + interval '7 days');

  RETURN NEW;
END;
$function$;