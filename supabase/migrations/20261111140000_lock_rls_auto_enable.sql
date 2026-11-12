-- SPEC 15: rls_auto_enable() must not be callable through /rest/v1/rpc.
-- Revoke instead of drop so automatic RLS on new tables keeps working.
-- Guarded so it does not fail on a project without the function.
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  ) then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
