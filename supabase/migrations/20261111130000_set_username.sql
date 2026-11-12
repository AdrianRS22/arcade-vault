-- SPEC 14: one-time username selection for OAuth players.

create function public.set_username(p text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if p is null or upper(p) !~ '^[A-Z0-9_]{1,10}$' then
    raise exception 'invalid username' using errcode = '22023';
  end if;
  update public.profiles
    set username = upper(p)
  where id = auth.uid() and username is null;
  if not found then
    raise exception 'username already set' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.set_username(text) from public, anon;
grant execute on function public.set_username(text) to authenticated;
