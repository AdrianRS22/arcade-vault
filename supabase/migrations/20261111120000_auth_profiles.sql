-- SPEC 13: profiles table, signup trigger and username availability check.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text unique check (username ~ '^[A-Z0-9_]{1,10}$'),  -- null until chosen (SPEC 14)
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "users can read their own profile"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

-- Only the trigger writes profiles.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- handle_new_user: create the profile when an auth user is inserted
-- ---------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    nullif(upper(new.raw_user_meta_data ->> 'username'), '')
  );
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- username_available: pre-check used by the sign-up form
-- ---------------------------------------------------------------------------

create function public.username_available(p text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    upper(p) ~ '^[A-Z0-9_]{1,10}$'
    and not exists (
      select 1 from public.profiles where username = upper(p)
    );
$$;

revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;
