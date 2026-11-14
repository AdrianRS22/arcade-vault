# SPEC GJ-slide-core-02 — SLIDE RUSH: timed variant

> **Status:** Draft
> **Depends on:** SPEC 06, SPEC 07, SPEC 08, SPEC 11, GJ-slide-core-01
> **Date:** 2026-11-13
> **Objective:** Add SLIDE RUSH, the same 4x4 merge-slide board played against a clock where every merge buys time, as a second catalog row with its own leaderboard at `/games/slide-core-rush/play`.

## Why this spec exists

SLIDE CORE (spec 01) is open-ended and has no pressure. This spec adds the twist from the game jam direction: a timed variant. It reuses the engine and the rules of spec 01, so the only new code is a clock, a merge bonus, a clock bar and a registry entry.

It is a separate catalog row, not a mode switch, for one reason: the `scores` table and `submit_score` key only on `game_id`. A timed run and a classic run would otherwise land on one leaderboard with numbers that cannot be compared. Two rows keep each leaderboard honest, and the cost is one seed row and one registry entry.

## Scope

**In:**

- Seed migration `supabase/migrations/20261113120100_seed_slide_core_rush.sql` with the `games` row (`id = 'slide-core-rush'`, `title = 'SLIDE RUSH'`, `category = 'PUZZLE'`, `cover = 'cover-slide-rush'`, `color = 'magenta'`, `plays = 0`, `sort_order = 7`).
- Rush mode in the existing engine `lib/games/slide-core/` (`mode: "rush"`): a countdown clock, a merge bonus, a clock bar drawn on the canvas, and game over when the clock reaches 0.
- Rush snapshot: the classic fields plus `time`, the whole seconds left.
- Registry entry `slide-core-rush`: HUD TIME and TOP, the same controls and touch layout as spec 01, aria label.
- New cover class `cover-slide-rush`, designed with `/frontend-design`.

**Out of scope (for future specs):**

- Changing the classic rules, the classic leaderboard or the classic cover.
- A mode switch inside one catalog row (see Why).
- Power-ups, time freezes, combos and extra modes (for example a move budget).
- Sound and the shared audio module.
- Skins beyond what spec 01 already shares through `lib/games/slide-core/skins.ts`.
- Gamepad controls and anti-cheat or server-verified scores.
- Schema changes, a plugin system beyond the registry, redirects.
- Any change to `references/`.

## Data model

No schema change: `scores` and `submit_score` are generic per `game_id`. The row `slide-core-rush` gets its own leaderboard by its id.

Seed:

```sql
-- supabase/migrations/20261113120100_seed_slide_core_rush.sql
insert into public.games (id, title, short, long, category, cover, color, plays, sort_order)
values (
  'slide-core-rush',
  'SLIDE RUSH',
  'Slide tiles against the clock; every merge buys time.',
  'The SLIDE CORE board with a clock. It runs down while you play, and every merge adds a second, so keep tiles combining or the run ends. The score is still the sum of every merge, and there is no move counter.',
  'PUZZLE',
  'cover-slide-rush',
  'magenta',
  0,
  7
);
```

Types (extends spec 01):

```ts
// lib/games/slide-core/types.ts (additions)
export type SlideRushSnapshot = SlideCoreSnapshot & {
  time: number; // whole seconds left, 0..RUSH.max, rounded up
};
// SlideCoreOptions.mode === "rush" makes the engine emit SlideRushSnapshot.
```

Constants (added to `constants.ts`):

```ts
export const RUSH = {
  start: 60, // s on the clock at the start of a run and after PLAY AGAIN
  mergeBonus: 1, // s added for each merge (each merged pair, not each move)
  max: 90, // s, the clock never holds more than this
};
export const CLOCK_BAR = { y: 562, h: 8 }; // px, under the board (board ends at y = 538)
```

Conventions:

- The clock is counted in playing time. It runs down with `dt` (capped at `MAX_DT`) only while the state is `playing` and the loop is running, so pause, tab switch and the GAME OVER modal stop it.
- Invalid moves cost nothing. Spawns cost nothing. Only a valid move that merges at least one pair adds `mergeBonus` per pair, capped at `max`.
- `time` is the clock rounded up to whole seconds. `onChange` fires when `time` changes, so at most once per second while playing, plus on merges and on game over.
- The clock bar width is `W_board × clock / max`, where `W_board = 476` (the board width from spec 01). It is drawn in magenta with `shadowBlur` only on the bar. It is a bar, not text.
- Scoring, slides, merges, spawns, input, pause and restart are the spec 01 rules, unchanged.
- Canvas draws no TIME, TOP, GAME OVER or restart text.

## Implementation plan

1. **Seed migration.** Write `20261113120100_seed_slide_core_rush.sql`, run `npm run db:push`, then `npm run db:types`. Check with Supabase MCP `execute_sql`: `games` has `slide-core` and `slide-core-rush`, and `scores` has no `slide-core-rush` rows. Add `'slide-core-rush'` to the seeded list in `supabase/checks/verify-prod.sql` and update the count. Restart the dev server if the cached list does not show it. Check: `/games` lists SLIDE RUSH, and `/games/slide-core-rush/play` shows "NOT PLAYABLE YET".
2. **Cover.** Add the `cover-slide-rush` class to `app/globals.css`, designed with `/frontend-design`: the `cover-slide` tile grid (spec 01) with a magenta clock bar across the bottom, palette tokens only. Check: the card on `/games` and the home rail show the cover without a broken layout.
3. **Rush constants and types.** Add `RUSH`, `CLOCK_BAR` and `SlideRushSnapshot`. Check: `npm run lint` passes.
4. **Rush mode in the engine.** When `options.mode === "rush"`, start the clock at `RUSH.start`, subtract `dt` each playing frame, add `mergeBonus` per merged pair (capped at `max`), set `time` to the rounded-up clock, and enter `gameover` when the clock reaches 0. Draw the clock bar. Check: `npm run build` passes, and the classic mode draws no bar and emits no `time`.
5. **Registry entry.** Add `slide-core-rush` to `lib/games/registry.ts`. `load` imports the same engine and creates it with `{ ...options, mode: "rush" }`. `initialSnapshot`: `score 0`, `top 0`, `free 16`, `time 60`, `state "playing"`. `hud` returns TIME (`${time}s`, magenta) and TOP (`String(top)`, yellow). `controls` and `touch` are the same as spec 01. `ariaLabel: "Slide Rush game"`. Check: `/games/slide-core-rush/play` runs the real game with no console errors, and `/games/slide-core/play` is unchanged.
6. **HUD and cover polish with `/frontend-design`.** Check the TIME and TOP stats at 375 px, and adjust only what looks broken. Check: the legend and the HUD fit without horizontal scroll.
7. **Verification pass.** Run `npm run lint` and `npm run build`, then every acceptance criterion below, including the classic regression from spec 01.

Before writing code, read `node_modules/next/dist/docs/` for Client Components and dynamic `import()`, and for `'use cache'` / `cacheTag` for the cached game list.

## Acceptance criteria

- [ ] `npm run lint` finishes with no errors.
- [ ] `npm run build` finishes with no errors.
- [ ] `supabase/migrations/` contains `20261113120100_seed_slide_core_rush.sql`, `npm run db:types` shows no diff, and `games` has the `slide-core-rush` row with 0 scores.
- [ ] `supabase/checks/verify-prod.sql` lists `slide-core-rush` in the seeded games.
- [ ] `/games` and `/games/slide-core-rush` show the title SLIDE RUSH and its description; the home "GAMES AVAILABLE NOW" rail lists it with the `cover-slide-rush` cover.
- [ ] `/games/slide-core-rush/play` runs the real engine with the listed controls.
- [ ] HUD values (TIME and TOP) always match the engine.
- [ ] A new run starts at `60s` with two tiles on the board.
- [ ] A valid merge of one pair adds 1 s to the clock; a merge of three pairs in one move adds 3 s; the clock never exceeds 90 s.
- [ ] Invalid moves and tile spawns do not change the clock.
- [ ] The clock runs down in real playing time: from 60 s, it reads 0 after about 60 s with no merges and no input.
- [ ] When the clock reaches 0, the GAME OVER modal opens with the same score as the HUD, and the board stops accepting moves.
- [ ] A board with no move left ends the run before the clock reaches 0, with the same modal and score.
- [ ] PAUSE, `P` and `Esc` freeze the clock and the tiles; resuming does not jump the clock or the tiles; switching tab pauses the clock.
- [ ] END opens the modal with the current score. PLAY AGAIN restarts at `60s`, score 0 and two tiles.
- [ ] The clock bar under the board shrinks with the clock (full at 90 s, empty at 0 s); no text is drawn on the canvas.
- [ ] Scoring is the spec 01 rule: each merge adds its new value, the score never exceeds 9,999,999 in the HUD or in the saved row.
- [ ] `onGameOver` is called once per run.
- [ ] SAVE SCORE shows `SAVING…` then `SAVED — RANK #N`; the score appears in the Hall of Fame tab for SLIDE RUSH, and not under SLIDE CORE; the game's plays go up by 1.
- [ ] `/games/slide-core/play` (classic) still plays and saves as in spec 01: no clock, no bar, no TIME stat.
- [ ] Touch emulation at 375×812: the D-pad slides the board, and the page does not scroll.
- [ ] Asteroids, Tetris, Arkanoid, Snake and TOAD ROAD still play and save exactly as before.
- [ ] No secret or service-role key is used.

## Decisions

- **Yes:** timed variant as the twist from the game jam direction. Provided (game jam: "a timed or move-budget mode"); the timed one was chosen. Agent's choice (game jam) for the choice of timed over a move budget.
- **No:** a move budget. A budget ends the run on a count of moves, which a player can plan for; a clock adds real pressure and fits the merge-driven pace. Agent's choice (game jam).
- **Yes:** a separate catalog row `slide-core-rush`. Scores key only on `game_id`, so one row would mix comparable and incomparable numbers on one leaderboard. Agent's choice (game jam).
- **No:** a mode switch inside `slide-core`. It needs a shared leaderboard split by mode, which the schema does not have, and it would hide the variant from the catalog. Agent's choice (game jam).
- **Yes:** `id = slide-core-rush`, title `SLIDE RUSH`, `PUZZLE`, `magenta`, `sort_order = 7`. Magenta differs from SLIDE CORE (cyan) and from its neighbour TETRIS (cyan) in the same category. Agent's choice (game jam).
- **Yes:** `cover-slide-rush` as a new class, a variant of `cover-slide` with a clock bar. Agent's choice (game jam).
- **Yes:** 60 s start, +1 s per merged pair, 90 s cap. These numbers give a run of about a minute with no merges and a steady pace with a merge every second or so. They are first values to tune in review. Agent's choice (game jam).
- **Yes:** the clock is playing time, so pause and the modal stop it. Agent's choice (game jam).
- **Yes:** `onChange` on whole seconds, not every frame, to keep the React state updates rare. Agent's choice (game jam).
- **Yes:** the clock bar is a canvas bar with no text, so the canvas draws no HUD. Agent's choice (game jam).
- **Yes:** the rush entry reuses the spec 01 engine and skins. One engine, two rows: a small surface and no duplicated rules. Agent's choice (game jam).
- **No:** power-ups, time freezes or combos. The variant is one twist; more would blur what it tests. Agent's choice (game jam).
- **No:** a distinct title that copies a known clone's name. The title stays original. Provided (game jam: keep original naming).

## Risks

| Risk                                                     | Mitigation                                                                                                           |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Clock keeps running while paused or in the modal         | The clock is driven by the same `dt` as the loop, which pause cancels; criteria check pause and the modal.           |
| Numbers too easy or too hard                             | Start 60 s, +1 s per merged pair and a 90 s cap are first values; tune them in review, not in code paths.            |
| `onChange` on every frame when the clock changes         | `onChange` fires only when the whole-second `time` changes, plus on merges and game over.                            |
| Rush and classic leaderboards mix                        | Two catalog rows with their own `game_id`; the criteria check that SLIDE RUSH scores do not appear under SLIDE CORE. |
| Shared engine file grows hard to follow                  | Rush code is limited to the clock, the bar and the bonus; the classic path stays unchanged and is criterion-checked. |
| Cover class clashes with another game                    | `cover-slide-rush` is checked against `globals.css` before writing.                                                  |
| Cached game list does not show the new row until rebuild | Plan step 1 restarts the dev server; production needs a rebuild or `games` tag invalidation.                         |
| Scores forgeable until Auth                              | Accepted in SPEC 07.                                                                                                 |

## What is **not** in this spec

- Changing SLIDE CORE (classic) rules, leaderboard or cover.
- A mode switch inside one catalog row.
- Power-ups, time freezes, combos and a move budget.
- Sound and the shared audio module.
- Gamepad controls, anti-cheat, server-verified scores and Auth.
- Schema changes, a plugin system beyond the registry, and redirects.
- Any change to `references/`.

Each one of those, if it lands, goes in its own spec.
