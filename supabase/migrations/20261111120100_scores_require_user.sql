-- SPEC 13: scores belong to a signed-in user; submit_score reads auth.uid().
-- Existing scores carry free-form names and cannot be attributed: wipe them.

delete from public.scores;
update public.games set plays = 0;

alter table public.scores
  add column user_id uuid not null references auth.users (id) on delete cascade;

create index scores_user_idx on public.scores (user_id);

-- ---------------------------------------------------------------------------
-- submit_score(p_game_id, p_score): authenticated only
-- ---------------------------------------------------------------------------

drop function public.submit_score(text, text, integer);

create function public.submit_score(
  p_game_id text,
  p_score   integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id  uuid := auth.uid();
  v_username text;
  v_rank     integer;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select p.username
  into v_username
  from public.profiles p
  where p.id = v_user_id;

  if v_username is null then
    raise exception 'username required' using errcode = '22023';
  end if;

  if p_score is null or p_score < 0 or p_score > 9999999 then
    raise exception 'invalid score' using errcode = '22023';
  end if;

  if not exists (select 1 from public.games where id = p_game_id) then
    raise exception 'unknown game' using errcode = '22023';
  end if;

  insert into public.scores (game_id, player, score, user_id)
  values (p_game_id, v_username, p_score, v_user_id);

  update public.games
  set plays = plays + 1
  where id = p_game_id;

  select pb.rank
  into v_rank
  from public.player_bests pb
  where pb.game_id = p_game_id
    and pb.player = v_username;

  return v_rank;
end;
$$;

revoke all on function public.submit_score(text, integer) from public, anon;
grant execute on function public.submit_score(text, integer) to authenticated;
