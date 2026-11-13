-- Arcade Vault: post-migration check for the PRODUCTION Supabase project.
-- Read-only. Paste into Prod > SQL Editor and run. Every row must show status = 'ok'.
-- Expected values come from the Dev schema as of migration 20261111140000.

with expected_migrations(version) as (
  values
    ('20261107120000'), ('20261107120100'), ('20261107120200'), ('20261107120300'),
    ('20261108120000'), ('20261109120000'), ('20261111120000'), ('20261111120100'),
    ('20261111130000'), ('20261111140000')
),
checks as (
  -- 1. Migration history
  select 'migrations: all 10 applied' as check_name,
         (select count(*) from expected_migrations e
            join supabase_migrations.schema_migrations m on m.version = e.version) = 10 as passed

  -- 2. RLS enabled on every public table
  union all
  select 'rls enabled: games, scores, profiles',
         (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind = 'r'
              and c.relname in ('games', 'scores', 'profiles') and c.relrowsecurity) = 3

  -- 3. Policies
  union all
  select 'policies: exactly 3 in public',
         (select count(*) from pg_policies where schemaname = 'public') = 3
  union all
  select 'policy: games readable by everyone',
         exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'games' and cmd = 'SELECT')
  union all
  select 'policy: scores readable by everyone',
         exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'scores' and cmd = 'SELECT')
  union all
  select 'policy: profiles own row only',
         exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and cmd = 'SELECT')

  -- 4. No direct writes for API roles on scores / games
  union all
  select 'grants: anon/authenticated cannot write scores or games',
         not exists (
           select 1 from information_schema.role_table_grants
           where table_schema = 'public' and table_name in ('scores', 'games')
             and grantee in ('anon', 'authenticated')
             and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
         )

  -- 5. RPC execute grants
  union all
  select 'rpc: submit_score only authenticated',
         has_function_privilege('authenticated', 'public.submit_score(text, integer)', 'execute')
           and not has_function_privilege('anon', 'public.submit_score(text, integer)', 'execute')
  union all
  select 'rpc: set_username only authenticated',
         has_function_privilege('authenticated', 'public.set_username(text)', 'execute')
           and not has_function_privilege('anon', 'public.set_username(text)', 'execute')
  union all
  select 'rpc: username_available anon + authenticated',
         has_function_privilege('anon', 'public.username_available(text)', 'execute')
           and has_function_privilege('authenticated', 'public.username_available(text)', 'execute')
  union all
  select 'rpc: rls_auto_enable not callable by API roles (or absent)',
         not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                       where n.nspname = 'public' and p.proname = 'rls_auto_enable'
                         and (has_function_privilege('anon', p.oid, 'execute')
                              or has_function_privilege('authenticated', p.oid, 'execute')))
  union all
  select 'rpc: handle_new_user not callable by API roles',
         not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                       where n.nspname = 'public' and p.proname = 'handle_new_user'
                         and (has_function_privilege('anon', p.oid, 'execute')
                              or has_function_privilege('authenticated', p.oid, 'execute')))

  -- 6. Trigger and views
  union all
  select 'trigger: on_auth_user_created on auth.users',
         exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
                   join pg_namespace n on n.oid = c.relnamespace
                   where t.tgname = 'on_auth_user_created' and n.nspname = 'auth' and c.relname = 'users')
  union all
  select 'views: games_with_best, player_bests, top_players_today',
         (select count(*) from pg_views where schemaname = 'public'
            and viewname in ('games_with_best', 'player_bests', 'top_players_today')) = 3

  -- 7. Seeded games
  union all
  select 'games: 5 seeded (arkanoid, asteroids, snake, tetris, toadroad)',
         (select count(*) from public.games
            where id in ('arkanoid', 'asteroids', 'snake', 'tetris', 'toadroad')) = 5

  -- 8. Prod must start clean
  union all
  select 'clean start: no scores yet (informational, fails once players play)',
         (select count(*) from public.scores) = 0
)
select check_name, case when passed then 'ok' else 'FAIL' end as status
from checks
order by passed, check_name;
