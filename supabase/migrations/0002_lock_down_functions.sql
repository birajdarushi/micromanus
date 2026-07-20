-- Harden SECURITY DEFINER functions so they cannot be called from the public API.
-- Both functions are only ever invoked server-side via the service_role client
-- (consume_credit in api/agent) or by the auth trigger (handle_new_user).
-- Without this, an authenticated user could POST /rest/v1/rpc/consume_credit with a
-- negative p_amount and grant themselves unlimited credits.

revoke execute on function public.consume_credit(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_credit(uuid, integer) to service_role;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;
