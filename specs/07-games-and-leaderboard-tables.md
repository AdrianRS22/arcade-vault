# SPEC 07 — Games and leaderboard tables

> **Status:** Approved
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-11-07
> **Objective:** Replace every mock in `app/data/` with Supabase tables `games` (holding only Asteroids) and `scores`, so the catalog, leaderboards and home activity show only real data and SAVE SCORE persists the score and shows its rank.

## Why this spec exists

SPEC 05 left Supabase connected with no schema. SPEC 06 delivered the first real game, but its score is lost on GAME OVER. Everything else is hand-written mock data: seven fake games, 96 fake scores, fake home activity and a fake "YOUR BEST" row. That makes the platform look full but none of it is true. This spec removes the fakes and leaves the platform showing only what really exists: one game and the scores people save. Auth is still a client-side mock, so writes go through one validated Postgres function instead of open table permissions.

## Scope

**In:**

- Migration with tables `games` and `scores`, RLS enabled, views `games_with_best`, `player_bests`, `top_players_today`, and function `submit_score`.
- Seed migration with a single game, `asteroids`, using its current text from `app/data/games.ts`. `plays` starts at 0. No scores are seeded.
- Regenerated `types/supabase.ts`.
- `lib/supabase/public.ts`: cookie-less client for cached reads.
- `app/data/categories.ts`: `CATEGORIES` moved out of `app/data/games.ts` so Client Components can import it. `games.ts` now uses server-only APIs (`next/cache`, Supabase).
- `app/_components/empty-board.tsx` and the `.empty-board` class in `app/globals.css`: one shared empty state for every score board (title, one sentence, optional action).
- `export const ensureStatic = "navigation"` in `app/games/[id]/page.tsx` and `app/games/[id]/play/page.tsx`, so unknown game ids answer 404 on the first request. In the same two pages, `params` is read inside `<Suspense>` (inner components `GameDetail` and `Player`, fallback `app/_components/page-loading.tsx`) so `next dev` shows no Instant Navigation error.
- `app/data/games.ts`, `app/data/scores.ts` and `app/data/activity.ts` read from Supabase. Every hard-coded array (`GAMES`, `ROWS`, `RECENT_SCORES`, `TOP_PLAYERS_TODAY`) and the mock `getPlayerBest` are deleted.
- Cached reads with `'use cache'` plus `cacheTag('games')` and `cacheTag('scores')`.
- `best` derived from `max(scores.score)`. `plays` is an integer column, shown formatted (`1.2K`), and goes up by 1 on each saved score.
- Leaderboard = best score per player per game (on a tie, the earlier score wins). Top 12 on Hall of Fame, top 10 on the detail page.
- Home "LATEST SCORES" = latest 7 rows of `scores`, with `ago` computed from `created_at`.
- Home "TOP PLAYERS · TODAY" = sum of each player's best per game over the last 24 h, top 5.
- Empty states wherever the data can now be empty: detail "TOP SCORES", Hall of Fame podium and table, home "LATEST SCORES" and "TOP PLAYERS · TODAY".
- Remove the fake arena path from `app/_components/game-player.tsx`: the random score ticker, `.game-arena` markup and the `isReal` branches. The player always runs the real engine.
- Server Action `saveScore` in `app/games/[id]/play/actions.ts`, calling `submit_score` and invalidating both tags.
- GAME OVER modal: SAVE SCORE always persists. States: idle → `SAVING…` → `SAVED — RANK #N` with a link to `/hall-of-fame`, or an error message with retry. One save per game over.
- Hall of Fame "YOUR BEST IN …" row: the real best and rank for the session `user.name`, loaded by a Server Action `getMyBests(player)`. Hidden if that player has no score in the game.

**Out of scope (for future specs):**

- Supabase Auth, replacing `session-provider.tsx`, `proxy.ts`.
- Anti-cheat, server-verified scores and rate limiting.
- New real games (each one gets its own spec and its own row in `games`).
- Redirects for the removed game URLs (`/games/block-buster` and the others return 404).
- Removing the now-unused `cover-*` classes and the fake-arena classes (`.game-arena`, `.enemy`, `.player-ship`, `.grid-floor`) from `globals.css`.
- Rewriting the home marketing copy ("THOUSANDS OF PLAYS", "EVERY DAY", "GLOBAL RANKING").
- Admin UI to edit games.
- Pagination beyond top 12, per-period leaderboards (weekly, monthly) and realtime updates.

## Data model

```sql
-- supabase/migrations/<timestamp>_games_and_scores.sql
create table public.games (
  id         text primary key,                 -- slug, e.g. 'asteroids'
  title      text not null,
  short      text not null,
  long       text not null,
  category   text not null check (category in ('ARCADE','PUZZLE','SHOOTER','VERSUS')),
  cover      text not null,                    -- CSS class, e.g. 'cover-rocas'
  color      text not null check (color in ('cyan','magenta','yellow','green')),
  plays      integer not null default 0 check (plays >= 0),
  sort_order integer not null default 0,       -- catalog order
  created_at timestamptz not null default now()
);

create table public.scores (
  id         bigint generated always as identity primary key,
  game_id    text not null references public.games(id) on delete cascade,
  player     text not null check (player ~ '^[A-Z0-9_]{1,10}$'),
  score      integer not null check (score between 0 and 9999999),
  created_at timestamptz not null default now()
);
create index scores_game_score_idx on public.scores (game_id, score desc);
create index scores_created_idx on public.scores (created_at desc);
```

- RLS on both tables. `anon` and `authenticated` get `SELECT` only. No `INSERT`, `UPDATE` or `DELETE` policies.
- Views created `with (security_invoker = true)`:
  - `games_with_best`: every `games` column plus `best` (`coalesce(max(score), 0)`).
  - `player_bests`: `game_id, player, score, achieved_at, rank`. One row per (game, player) with that player's max score, ranked with `rank()` over `game_id` ordered by `score desc, achieved_at asc`.
  - `top_players_today`: `player, total`. Sum of each player's best per game where `created_at > now() - interval '24 hours'`, ordered by `total desc`.
- `submit_score(p_game_id text, p_player text, p_score integer) returns integer`, the new rank in `player_bests`. It is `security definer` with `set search_path = ''`. It raises if the game does not exist or a check fails. It inserts the row and runs `plays = plays + 1` in one transaction. `execute` is granted to `anon` and `authenticated` only.

Seed (`supabase/migrations/<timestamp>_seed_asteroids.sql`): one `games` row with `id = 'asteroids'`, `title = 'ASTEROIDS'`, the current `short` and `long`, `category = 'SHOOTER'`, `cover = 'cover-rocas'`, `color = 'yellow'`, `plays = 0`, `sort_order = 0`.

TypeScript (public shapes of `app/data/*` after the change):

```ts
// app/data/games.ts
export type Game = {
  id: string;
  title: string;
  short: string;
  long: string;
  category: GameCategory;
  cover: string;
  color: GameColor;
  best: number; // derived, 0 when there are no scores
  plays: number; // was a display string; format with formatPlays()
};
export function formatPlays(n: number): string; // 0 → "0", 1240 → "1.2K"

// app/data/scores.ts — ScoreEntry unchanged: { rank, player, score, date: "DD/MM/YYYY" }
export async function getLeaderboard(
  gameId: string,
  limit?: number,
): Promise<ScoreEntry[]>;
export async function getPlayerBests(
  player: string,
): Promise<Record<string, ScoreEntry>>; // uncached

// app/data/activity.ts — RecentScore and TopPlayer keep their shapes; `ago` computed from created_at
```

```ts
// app/games/[id]/play/actions.ts
type SaveScoreResult =
  { ok: true; rank: number } | { ok: false; error: string };
export async function saveScore(
  gameId: string,
  player: string,
  score: number,
): Promise<SaveScoreResult>;
```

## Implementation plan

1. Write the schema migration (tables, indexes, RLS, views, `submit_score`, grants). Run `npm run db:push`, then `npm run db:types`. Check with Supabase MCP `get_advisors` (security) that there are no warnings on the new objects.
2. Write the Asteroids seed migration and push it. Check with MCP `execute_sql`: `games` has 1 row and `scores` has 0.
3. Create `lib/supabase/public.ts`: `createPublicClient()` with `@supabase/supabase-js` `createClient<Database>`, values from `lib/supabase/env.ts`, no cookies, no session persistence. Safe inside `'use cache'`.
4. Rewrite `app/data/games.ts` on `games_with_best` (ordered by `sort_order`), cached with `cacheTag('games')` and `cacheTag('scores')`. Delete `GAMES`. Add `formatPlays` and use it in `app/games/[id]/page.tsx`. Move `CATEGORIES` to `app/data/categories.ts` and update the import in `app/_components/library-browser.tsx` (a Client Component cannot import `games.ts` any more). Add `export const ensureStatic = "navigation"` to `app/games/[id]/page.tsx` and `app/games/[id]/play/page.tsx`. Check: `/games` shows only ASTEROIDS and the other category chips show the existing empty state. `/games/block-buster` returns 404 on the first request.
5. Rewrite `app/data/scores.ts` on `player_bests` (cached, `cacheTag('scores')`), with `date` formatted `DD/MM/YYYY`. Delete `ROWS` and `getPlayerBest`. Add `getPlayerBests(player)` (not cached). Create `app/_components/empty-board.tsx` and use it for the detail "TOP SCORES" block and the Hall of Fame podium and table. Because `getPlayerBest` is gone, `app/hall-of-fame/page.tsx` stops loading player bests now, and `hall-of-fame-board.tsx` loses its `playerBests` prop and the "YOUR BEST" row until step 10 brings it back with real data.
6. Rewrite `app/data/activity.ts` on `scores` joined with `games` (latest scores) and on `top_players_today`. Cache with `cacheTag('scores')` and `cacheLife('minutes')` (revalidate 1 min, expire 1 h) so `ago` and "today" do not go stale for hours. Never go below that: a profile with `expire` under 5 minutes becomes a dynamic hole and breaks the build on the home page, which has no `Suspense`. Delete both arrays. Add empty states with `EmptyBoard` to "LATEST SCORES" (with a PLAY button for the first game) and "TOP PLAYERS · TODAY" on the home.
7. Remove the fake arena from `app/_components/game-player.tsx`: the random score interval, the `.game-arena` markup, the `isReal` flag and its branches. The player always mounts `AsteroidsCanvas`, and the Power-up stat, the controls legend and the single pause text are always shown. The `realLevel` state becomes `level`, because the score-derived level for fake games is gone. Check: `/games/asteroids/play` plays exactly as in SPEC 06.
8. Create `app/games/[id]/play/actions.ts` with `saveScore`. It normalizes the player (trim, uppercase, max 10), validates it against `^[A-Z0-9_]{1,10}$` and the score range, calls `submit_score` with the server client, invalidates the `games` and `scores` tags with `updateTag` and returns the result shape. It logs the real error server-side and returns a generic message. Validation errors tell the player what to fix ("Use 1 to 10 letters, numbers or underscores for your initials."); every other failure says "Could not save your score. Try again." Check, without writing anything: `submit_score` called with the publishable key rejects an unknown game, the players `ab` and `TOO_LONG_NAME1`, and the scores `-1` and `10000000`, each with HTTP 400.
9. Wire the GAME OVER modal: SAVE SCORE calls `saveScore` with the idle, saving, saved-with-rank and error-retry states, plus a link to `/hall-of-fame`. Use the `/frontend-design` skill for the new states.
10. Hall of Fame: `app/_components/hall-of-fame-board.tsx` (which lost its "YOUR BEST" row in step 5) calls a Server Action `getMyBests(user.name)` when a user is signed in and renders "YOUR BEST IN …" from it, hidden when there is no entry. Use the `/frontend-design` skill for the empty states from steps 5, 6 and 10.

Before writing code, read `node_modules/next/dist/docs/` for `'use cache'`, `cacheTag`, `cacheLife`, `updateTag` / `revalidateTag`, Server Actions and `generateStaticParams` under `cacheComponents`.

## Acceptance criteria

- [ ] `npm run lint` finishes with no errors.
- [ ] `npm run build` finishes with no errors.
- [ ] `supabase/migrations/` contains the schema and seed migrations, and `npm run db:types` shows no diff on a clean tree.
- [ ] Right after the seed, `games` has exactly 1 row (`asteroids`) and `scores` has 0 rows.
- [ ] `app/data/*.ts` contain no hard-coded game, score or activity arrays.
- [ ] `app/_components/game-player.tsx` contains no random score ticker and no `.game-arena` markup.
- [ ] With the publishable key, `insert`, `update` and `delete` on `games` and `scores` are rejected.
- [ ] Supabase security advisors report no issue on `games`, `scores` and the three views. The only warnings on `submit_score` are the expected `SECURITY DEFINER` ones (`anon` and `authenticated` can execute it), which stay until the Auth spec.
- [ ] `submit_score` rejects an unknown game id, a player like `ab` or `TOO_LONG_NAME1`, and a score of `-1` or `10000000`.
- [ ] `/games` shows only ASTEROIDS. Selecting ARCADE, PUZZLE or VERSUS shows the existing empty state.
- [ ] `/games/block-buster`, `/games/drop`, `/games/rocks` and any unknown id, on both `/games/[id]` and `/games/[id]/play`, return status 404 on the very first request (`next start`, one `curl` per id, no repeats).
- [ ] In `next dev`, loading every route (`/`, `/games`, `/games/asteroids`, `/games/asteroids/play`, `/hall-of-fame`, `/about`, `/login`) prints no `instant-shell-url-data` error in the terminal and shows no Instant Navigation insight in the dev overlay.
- [ ] The home "GAMES AVAILABLE NOW" rail shows only ASTEROIDS, and the stat shows `1 GAMES`.
- [ ] With no scores, `/games/asteroids` shows best `0`, plays `0` and an empty-state message in "TOP SCORES".
- [ ] With no scores, `/hall-of-fame` shows an empty-state message instead of an empty podium and table.
- [ ] With no scores, the home "LATEST SCORES" and "TOP PLAYERS · TODAY" show empty-state messages.
- [ ] On `/games/asteroids/play`, saving a score shows `SAVING…`, then `SAVED — RANK #N`, with N equal to the player's position on `/hall-of-fame`.
- [ ] After saving, reloading `/hall-of-fame`, `/games/asteroids` and `/` shows the new score without restarting the server, and Asteroids plays go up by 1.
- [ ] Saving twice with the same initials keeps one leaderboard row for that player, with the higher score.
- [ ] With the network blocked, SAVE SCORE shows an error and can be retried.
- [ ] SAVE SCORE cannot be pressed twice for the same game over.
- [ ] The home "LATEST SCORES" shows the newly saved score first, and "TOP PLAYERS · TODAY" lists that player.
- [ ] Signed in as a player with a saved score, Hall of Fame shows "YOUR BEST IN ASTEROIDS" with the real score and rank. Signed in as a player with no score, the row is hidden.
- [ ] No secret or service-role key is used anywhere.

## Decisions

- **Yes:** Supabase tables `games` and `scores`. User's choice; first real data for the platform.
- **Yes:** remove every mock and seed only Asteroids. User's choice; the platform shows only what really exists.
- **No:** seeding the seven fake games or the 96 fake scores. Fake data hides what is real.
- **Yes:** no seeded scores; leaderboards start empty with empty states. The first real save becomes rank #1.
- **Yes:** remove the fake arena from `GamePlayer`. No fake game can reach it any more; keeping it would be dead code.
- **No:** deleting the fake-arena CSS (`.game-arena`, `.enemy`, `.player-ship`, `.grid-floor`) in this spec. It is unused but harmless, and it belongs to the same cosmetic cleanup as the `cover-*` classes.
- **No:** a `playable` column. Every row in `games` is a real game, so the flag would always be true.
- **No:** redirects for removed game URLs. Mock catalog, no real users or links.
- **Yes:** writes only through `submit_score` (`security definer`). The insert and `plays + 1` stay atomic, and `anon` gets no table write permission.
- **No:** a direct `INSERT` policy for `anon`. It exposes more surface and splits the `plays` update.
- **Yes:** Server Action `saveScore` in front of the RPC. It validates, invalidates cache tags and keeps the client thin.
- **Yes:** `updateTag` for the invalidation. It only works in Server Actions, which is where this runs, and the next request waits for fresh data: the read-your-own-writes behavior the "reload shows the new score" criterion needs.
- **No:** `revalidateTag(tag, "max")`. It serves stale data while it refreshes, so a player could save a score, open the Hall of Fame and not see it.
- **Yes:** the action validates with the same rules as `submit_score` before calling the database, and the database checks them again and stays the authority. The modal has no separate client-side check: its errors come back from the action.
- **Yes:** best score per player per game. One row per player is the classic arcade table.
- **No:** every game session as its own row. A single player could fill the top 12.
- **Yes:** `best` derived, `plays` stored as an integer starting at 0. Both reflect only real activity.
- **Yes:** `'use cache'` with tags, invalidated on save. Keeps prerendering and shows new scores on reload.
- **No:** fully dynamic reads. Loses prerendering for no gain.
- **Yes:** cookie-less `lib/supabase/public.ts` for cached reads. `lib/supabase/server.ts` calls `cookies()` and cannot run inside `'use cache'`.
- **Yes:** "TOP PLAYERS · TODAY" over the last 24 h, with an empty state. Keeps the label honest.
- **Yes:** derive home activity from `scores`. One source of truth.
- **Yes:** real "YOUR BEST" by session name via Server Action. The session lives on the client, so the server cannot know it at render time.
- **Yes:** player name rule `^[A-Z0-9_]{1,10}$`. Matches the current initials input (uppercase, max 10) and blocks markup.
- **No:** Auth in this spec. It needs its own spec; scores stay forgeable until then.
- **No:** rewriting the home marketing copy. It is copy, not data, and belongs to a content pass.
- **Yes:** read `params` inside `<Suspense>` on both `[id]` pages (`GameDetail` and `Player` inner components, with `app/_components/page-loading.tsx` as the fallback). With Partial Prefetching on, Next 16.4 reports an Instant Navigation insight in `next dev` when `await params` sits at the top of the page, because it ties the App Shell to one id. The docs recommend Suspense for it; the user hit this error in the dev overlay and terminal.
- **No:** `export const instant = false` to silence that insight. It opts the route out of validation instead of fixing it, and the project wants instant navigations.
- **Yes:** keep `ensureStatic = "navigation"` together with the Suspense boundary. Checked with `next start`: unknown ids still answer 404 on the first request, because the complete page is built before the response.
- **Yes:** `ensureStatic = "navigation"` on the two `[id]` pages. The project has `partialPrefetching: true`, so an id missing from `generateStaticParams` first gets the App Shell with status 200 and `notFound()` only shows later (a soft 404). `'navigation'` makes Next wait for the complete page, so the 404 status is right on the first request.
- **No:** `dynamicParams = false` for the same problem. The docs say it is not available with Cache Components.
- **No:** a Proxy check on the slug. Heavier than one line of route config, and it would duplicate the catalog lookup outside the page.
- **Yes:** move `CATEGORIES` to `app/data/categories.ts`. `games.ts` imports `cacheTag` and the Supabase client, so a Client Component that imports a value from it breaks the build.
- **Yes:** one shared `EmptyBoard` component, styled with the existing neon tokens and the `_` cursor the home already uses. Three boards need the same message pattern; copy says what is missing and what to do next.
- **Yes:** drop the "YOUR BEST" row between step 5 and step 10. Its only data source (`getPlayerBest`) is deleted in step 5, and a fake value there would break the "no mocks" goal.
- **Yes:** Hall of Fame asks for the top 12 per game (`getLeaderboard(g.id, 12)`), matching the scope. The old mock page loaded all 12 rows without a limit.
- **Yes:** `cacheLife('minutes')` on the home activity reads. `ago` is computed inside the cache, so it must refresh often, but the Next.js docs say an `expire` under 5 minutes is excluded from prerenders and the home has no `Suspense` to hold the hole.
- **No:** the `seconds` profile or a custom `revalidate: 0`. Both fail the build for the reason above; a minute of lag is acceptable for a "latest scores" ticker, and every save invalidates the `scores` tag anyway.
- **Yes:** the "LATEST SCORES" empty state links to `games[0]`, not to a hard-coded id. The catalog is the source of truth, so the link follows it when more games arrive.
- **Yes:** list keys for latest scores include the index. `RecentScore` keeps its shape (no `id`), and one player can now appear several times for the same game.

## Risks

| Risk                                                                                                                 | Mitigation                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Anyone can submit a fake score through the publishable key                                                           | Accepted until Auth. `submit_score` caps the range and validates the name; noted here.                                  |
| Different people sharing the same initials                                                                           | Accepted without Auth; the leaderboard groups by name.                                                                  |
| `cookies()` inside a `'use cache'` scope breaks the build                                                            | Cached reads use only `lib/supabase/public.ts`.                                                                         |
| `ago` and "today" go stale inside cached output                                                                      | `cacheLife('minutes')` on activity reads (1 min revalidate), and invalidation on every save.                            |
| `security definer` function with a mutable `search_path`                                                             | `set search_path = ''` and fully qualified names; the advisors check it.                                                |
| Views bypass RLS                                                                                                     | Created with `security_invoker = true`.                                                                                 |
| Supabase down, so catalog pages fail                                                                                 | The error shows at build or request time. There is no silent fallback because the mocks are deleted.                    |
| `generateStaticParams` now hits the database at build time                                                           | Uses the cached public client; the build criterion checks it.                                                           |
| Pages built for many items (podium, rail, tabs) look broken with one game and few scores                             | Empty states and acceptance criteria for the zero-score case.                                                           |
| `ensureStatic = "navigation"` fails the build if the two `[id]` pages read uncached data or a very short `cacheLife` | Every read those pages make (steps 5 and 7) uses `'use cache'` with `cacheLife("hours")`; `npm run build` validates it. |

## What is **not** in this spec

- Supabase Auth and replacing the session.
- Anti-cheat, rate limiting and realtime.
- New real games and redirects for removed game URLs.
- Cleaning up unused `cover-*` classes and the home marketing copy.
- Admin editing of games and per-period leaderboards.

Each one of those, if it lands, goes in its own spec.
