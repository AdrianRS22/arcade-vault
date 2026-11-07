-- SPEC 07: games catalog and scores leaderboard.
-- Writes happen only through public.submit_score(); anon/authenticated are read-only.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.games (
  id         text primary key,                 -- slug, e.g. 'asteroids'
  title      text not null,
  short      text not null,
  long       text not null,
  category   text not null check (category in ('ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS')),
  cover      text not null,                    -- CSS class, e.g. 'cover-rocas'
  color      text not null check (color in ('cyan', 'magenta', 'yellow', 'green')),
  plays      integer not null default 0 check (plays >= 0),
  sort_order integer not null default 0,       -- catalog order
  created_at timestamptz not null default now()
);

create table public.scores (
  id         bigint generated always as identity primary key,
  game_id    text not null references public.games (id) on delete cascade,
  player     text not null check (player ~ '^[A-Z0-9_]{1,10}$'),
  score      integer not null check (score between 0 and 9999999),
  created_at timestamptz not null default now()
);

create index scores_game_score_idx on public.scores (game_id, score desc);
create index scores_created_idx on public.scores (created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security: read-only for anon and authenticated
-- ---------------------------------------------------------------------------

alter table public.games enable row level security;
alter table public.scores enable row level security;

create policy "games are readable by everyone"
  on public.games for select
  to anon, authenticated
  using (true);

create policy "scores are readable by everyone"
  on public.scores for select
  to anon, authenticated
  using (true);

-- Supabase grants write privileges by default; take them away explicitly.
revoke insert, update, delete, truncate, references, trigger
  on public.games, public.scores
  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Views (security_invoker: they respect the caller's RLS)
-- ---------------------------------------------------------------------------

create view public.games_with_best
with (security_invoker = true) as
select
  g.*,
  coalesce(max(s.score), 0)::integer as best
from public.games g
left join public.scores s on s.game_id = g.id
group by g.id;

-- One row per (game, player): the player's best score, the earliest time it
-- was reached, and the rank inside the game (ties: earlier score wins).
create view public.player_bests
with (security_invoker = true) as
with best as (
  select game_id, player, max(score) as score
  from public.scores
  group by game_id, player
),
achieved as (
  select b.game_id, b.player, b.score, min(s.created_at) as achieved_at
  from best b
  join public.scores s
    on s.game_id = b.game_id
   and s.player = b.player
   and s.score = b.score
  group by b.game_id, b.player, b.score
)
select
  game_id,
  player,
  score,
  achieved_at,
  (rank() over (
    partition by game_id
    order by score desc, achieved_at asc
  ))::integer as rank
from achieved;

-- Sum of each player's best score per game over the last 24 hours.
create view public.top_players_today
with (security_invoker = true) as
select
  player,
  sum(best)::bigint as total
from (
  select player, game_id, max(score) as best
  from public.scores
  where created_at > now() - interval '24 hours'
  group by player, game_id
) per_game
group by player
order by total desc;

grant select on public.games_with_best, public.player_bests, public.top_players_today
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- submit_score: the only write path
-- ---------------------------------------------------------------------------

create function public.submit_score(
  p_game_id text,
  p_player  text,
  p_score   integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rank integer;
begin
  if p_player is null or p_player !~ '^[A-Z0-9_]{1,10}$' then
    raise exception 'invalid player' using errcode = '22023';
  end if;

  if p_score is null or p_score < 0 or p_score > 9999999 then
    raise exception 'invalid score' using errcode = '22023';
  end if;

  if not exists (select 1 from public.games where id = p_game_id) then
    raise exception 'unknown game' using errcode = '22023';
  end if;

  insert into public.scores (game_id, player, score)
  values (p_game_id, p_player, p_score);

  update public.games
  set plays = plays + 1
  where id = p_game_id;

  select pb.rank
  into v_rank
  from public.player_bests pb
  where pb.game_id = p_game_id
    and pb.player = p_player;

  return v_rank;
end;
$$;

revoke all on function public.submit_score(text, text, integer) from public;
grant execute on function public.submit_score(text, text, integer) to anon, authenticated;
