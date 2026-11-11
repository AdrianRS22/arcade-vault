# SPEC GJ-lane-surge-01 — LANE SURGE: core

> **Status:** Approved
> **Depends on:** SPEC 06, SPEC 07, SPEC 08, SPEC 11
> **Date:** 2026-11-11
> **Objective:** Create LANE SURGE, a five-lane dodger with energy cells, as a typed engine played at `/games/lane-surge/play` with its own leaderboard, playable from the first lane change to GAME OVER.

## Why this spec exists

The game jam theme is LANE SURGE, picked from the pending list of `references/game-suggestions-todo.md` (ARCADE, green): a ship sits in one of five lanes while rows of blocks scroll down toward it, and energy cells sit in the open gaps. Touch one block and the run is over. The title, category and colour come from that entry, and the name, art and levels are our own. No existing commercial game is recreated.

The registry from SPEC 08, the shared input module from SPEC 06 and the touch layout from SPEC 11 already exist. Adding the game is an engine, a registry entry and a seed migration, plus one new cover class.

This spec delivers the classic rules at constant speed: lanes, rows, energy cells, scoring, one life and GAME OVER. `02-lane-surge-surge.md` adds the speed ramp, levels, the SURGE twist and sound.

Two things differ from the earlier games. First, the ship moves by one lane per key press, like a hop, so its logic is discrete while the rows scroll continuously. Second, the rows are generated on the fly, and the generator keeps one lane always open so that every row is survivable.

## Scope

**In:**

- Seed migration `supabase/migrations/20261111120000_seed_lane_surge.sql` with the `games` row (`id = 'lane-surge'`, `title = 'LANE SURGE'`, `category = 'ARCADE'`, `cover = 'cover-lanes'`, `color = 'green'`, `plays = 0`, `sort_order = 5`).
- Typed engine in `lib/games/lane-surge/` (no React, no globals): five lanes, a ship that changes lane on key press, rows of blocks that scroll down, a generator that always leaves one lane open, energy cells, rows counted as dodged, one life, GAME OVER.
- Scoring: `10` per row that passes the ship, `50` per energy cell collected.
- Skins: `skins.ts` with `classic` (default), `neon` and `retro`, selected through `options.skin`, `skins` and `setSkin`, as every game must (`lib/games/shared/skins.ts`).
- Registry entry: HUD CELLS and ROWS, controls legend, touch layout with the two lane keys, no `sound`.
- Cover: a new `cover-lanes` class in `app/globals.css`, designed with `/frontend-design`.
- HUD and cover polish at 375 px with `/frontend-design`.

**Out of scope (for future specs):**

- Speed ramp, levels, level bonus and any change of difficulty with time (`02-lane-surge-surge.md`).
- The SURGE meter, the Space key and the surge twist (`02-lane-surge-surge.md`).
- Sound, sound effects and MUTE (`02-lane-surge-surge.md`).
- Extra lives, shields, multipliers and any other power-up.
- Smooth lane-to-lane movement held by a key (the ship changes lane once per press).
- Multiplayer and the VERSUS mode.
- Touch gestures beyond the on-screen lane buttons from SPEC 11, gamepad and mouse.
- Anti-cheat, server-verified scores, Auth.
- Any change to `references/`.
- Schema changes, a plugin system beyond the registry, redirects.

## Data model

No schema change: `scores` and `submit_score` are generic per `game_id`.

Seed:

```sql
-- supabase/migrations/20261111120000_seed_lane_surge.sql
insert into public.games (id, title, short, long, category, cover, color, plays, sort_order)
values (
  'lane-surge',
  'LANE SURGE',
  'Slip between the blocks and collect every energy cell.',
  'Steer a neon ship across five lanes while rows of blocks rush toward you. Every row you slip past scores, and energy cells in the open gaps add more. One block and the run is over.',
  'ARCADE',
  'cover-lanes',
  'green',
  0,
  5
);
```

LANE SURGE types:

```ts
// lib/games/lane-surge/types.ts
export type LaneSurgeState = "playing" | "gameover";

export type Row = {
  y: number; // px, vertical center of the row; the ship sits at SHIP_Y
  index: number; // 0 for the first row ever spawned, then 1, 2…
  blocks: boolean[]; // length 5, true = a block in that lane
  cell: number | null; // lane of an energy cell not yet collected
  passed: boolean; // true once the row has crossed the ship and was counted
};

export type LaneSurgeSnapshot = {
  score: number; // 0..9_999_999, clamped
  cells: number; // energy cells collected in this run
  rows: number; // rows that passed the ship
  state: LaneSurgeState;
};
export type LaneSurgeCallbacks = GameCallbacks<LaneSurgeSnapshot>;
export function createLaneSurgeGame(
  canvas: HTMLCanvasElement,
  callbacks: LaneSurgeCallbacks,
  options: GameOptions,
): GameEngine; // exposes skins and setSkin
```

Files in `lib/games/lane-surge/`:

- `types.ts`: the types above.
- `constants.ts`: the values below.
- `skins.ts`: `SKINS: Record<SkinId, LaneSurgePalette>` with the palettes below.
- `rows.ts`: pure generator, `nextGap(gap, random)` and `makeRow(index, gap, random)`. `random` is an argument (`() => number`), so tests can pass a fixed sequence.
- `engine.ts`: pure state and step functions, collisions, scoring, loop, draw and `createLaneSurgeGame`.

Constants (`constants.ts`):

```ts
export const W = 800; // px
export const H = 600; // px
export const LANE_COUNT = 5;
export const LANE_W = 160; // W / LANE_COUNT
export const LANE_CENTERS = [80, 240, 400, 560, 720]; // px
export const START_LANE = 2; // the middle lane

export const SHIP_Y = 500; // px, vertical center of the ship
export const SHIP_HIT_W = 32; // px, hitbox centered on the lane center
export const SHIP_HIT_H = 24; // px
export const SHIP_SLIDE = 14; // 1/s, visual slide toward the lane center; logic is instant

export const BLOCK_H = 40; // px
export const BLOCK_INSET = 10; // px, block width = LANE_W - 2 × BLOCK_INSET = 140
export const CELL_SIZE = 22; // px, diamond, hitbox is the same square

export const SCROLL_SPEED = 260; // px/s
export const ROW_GAP = 130; // px between row centers, so a row reaches the ship every 0.5 s
export const SAFE_ROWS = 3; // rows 0, 1 and 2 never have blocks or cells
export const BLOCK_CHANCE = 0.6; // per lane that is not the gap of the row
export const CELL_CHANCE = 0.4; // per row, outside the safe rows

export const ROW_POINTS = 10; // per row that passes the ship
export const CELL_POINTS = 50; // per energy cell collected
export const MAX_DT = 0.05; // s
export const MAX_SCORE = 9_999_999;
```

Row generator (`rows.ts`):

- Every row has a `gap` lane that is never a block. The first row (index 0) has gap `START_LANE`.
- `nextGap(gap, random)` returns `clamp(gap + d, 0, 4)`, where `d` is `-1`, `0` or `+1` with equal chance. Consecutive rows therefore never move the gap by more than one lane.
- A row with index below `SAFE_ROWS` has no blocks and no cell.
- For every other lane that is not the gap, the block chance is `BLOCK_CHANCE`. The row can have 0 to 4 blocks, never 5.
- With `CELL_CHANCE`, one cell is placed in a random lane that has no block in this row (the gap included).

Palettes (`skins.ts`). Canvas cannot read CSS variables, so each skin is a hex table; `classic` mirrors `app/globals.css`:

```ts
export type LaneSurgePalette = {
  bg: string;
  laneTint: string; // alternating lane fill
  dash: string; // lane separators
  ship: string;
  shipCore: string;
  block: string;
  cell: string;
  glow: boolean; // false draws no shadowBlur at all
};
// classic: bg #0a0a0f (--bg), laneTint #0d1a18 (--green at 6% over --bg),
//          dash #4a4f70 (--ink-faint), ship #00ff88 (--green), shipCore #e6e9ff (--ink),
//          block #ff006e (--magenta), cell #f5ff00 (--yellow), glow true
// neon:    bg #05050a, laneTint #0a1a24, dash #00f5ff, ship #00ff88, shipCore #ffffff,
//          block #ff006e, cell #f5ff00, glow true
// retro:   bg #0b1a0e, laneTint #10261a, dash #2f6b3f, ship #b6ff9e, shipCore #0b1a0e,
//          block #3f9a57, cell #e8ff7a, glow false
```

Conventions:

- Logical field `W = 800`, `H = 600`, origin top-left. It is already 4:3, so it fills the `.crt-screen` with no letterbox. Backing store scaled by `devicePixelRatio` (cap 2).
- Speeds are px/s and `dt` is in seconds, capped at `MAX_DT = 0.05`. `resume()` and `restart()` reset `lastTime`.
- Rows scroll down at `SCROLL_SPEED`. A row is counted as passed the first frame its `y` reaches `SHIP_Y`. A new row spawns at `topmost.y - ROW_GAP` each time the topmost row's `y` reaches 0 or more, so the spacing is exactly `ROW_GAP`. The first row starts at `y = 0`. Rows are removed once `y > H + BLOCK_H`.
- Lane change: one key press moves the ship one lane (`pressed()`, so holding does not repeat). If left and right are pressed in the same frame, only left applies. Lanes are clamped to `0..4`: a press at the edge does nothing. The logic is instant; the ship's drawn x slides toward the lane center at `SHIP_SLIDE`.
- Collisions use the logical lane center, not the drawn x. A block collides when its rectangle (`lane left + BLOCK_INSET` to `lane right - BLOCK_INSET`, `row.y ± BLOCK_H / 2`) overlaps the ship hitbox. Checked every frame.
- Energy cell: collected when its square (`CELL_SIZE`, centered at `(LANE_CENTERS[cell], row.y)`) overlaps the ship hitbox. It adds `CELL_POINTS`, increments `cells` and clears `row.cell`.
- Passing a row adds `ROW_POINTS` and increments `rows`.
- Score is `rows × ROW_POINTS + cells × CELL_POINTS`, clamped to `MAX_SCORE`.
- Game over: a block touches the ship. The run ends that frame (no death animation in this spec). `onGameOver(score)` fires once. `end()` forces game over with the current score.
- Controls: `←` `→` or `A` `D` change lane. Input uses the shared `createInput` with `ArrowLeft` and `ArrowRight` prevented from scrolling. No mouse. `P` and `Esc` belong to the platform. `M` is not bound (no sound yet). Space is not bound in this spec.
- `onChange` fires only when `score`, `cells`, `rows` or `state` changes.
- The canvas draws the lanes, dashes, blocks, energy cells and the ship. It draws no score, cells, rows, GAME OVER or restart text, and no key restarts the game.
- Glow (`shadowBlur`) only on the ship and only when the skin has `glow: true`. Blocks and cells are drawn without glow.
- No assets: everything is drawn with canvas shapes, so there is nothing to preload and the loop starts at once.
- The game starts immediately in `playing` with the ship in `START_LANE`. There is no waiting state.

## Implementation plan

1. **Seed migration.** Write `20261111120000_seed_lane_surge.sql`, run `npm run db:push`, then `npm run db:types`. Check with Supabase MCP `execute_sql`: `games` has `asteroids`, `tetris`, `arkanoid`, `snake`, `toadroad` and `lane-surge`, and `scores` has no `lane-surge` rows. Restart the dev server if the cached list does not show it. Check: `/games` lists LANE SURGE, and `/games/lane-surge/play` shows "NOT PLAYABLE YET".
2. **Types, constants, skins and generator.** Create `types.ts`, `constants.ts`, `skins.ts` and `rows.ts` in `lib/games/lane-surge/`. Check: `npm run lint` passes, no file imports React, and with a fixed `random` sequence `makeRow` never produces 5 blocks, never blocks the gap, and keeps consecutive gaps within one lane.
3. **Game logic.** In `engine.ts`, add the pure state and step functions: initial state, lane change with clamp, row scroll and spawn with exact `ROW_GAP` spacing, pass counting, block and cell collisions, scoring with the clamp, and game over. Check: `npm run build` passes (no loop yet).
4. **Loop, input, drawing and registry entry.** Add `createLaneSurgeGame`: rAF loop with the `dt` cap, shared `createInput` with the arrow keys prevented, `draw`, `onChange` only on change, `onGameOver` once, `pause`, `resume`, `end`, `restart`, `destroy`, `skins` and `setSkin`. Add `"lane-surge"` to `lib/games/registry.ts`: `initialSnapshot` (`score 0`, `cells 0`, `rows 0`, `playing`), `hud` returns CELLS (`0`, cyan) and ROWS (`0`, green), `controls` (`←` `→` Lane, `A` `D` Lane), `ariaLabel: "Lane Surge game"`, no `sound`, and `touch: { dpad: ["left", "right"], buttons: [] }`. Check: `/games/lane-surge/play` runs the real game.
5. **Cover with `/frontend-design`.** Add `.cover-lanes` to `app/globals.css`: five dim lane stripes on a dark green gradient, a green ship chevron near the bottom and a yellow energy cell above it. The cover is 4:3 and matches the other `cover-*` classes. Check: the cover shows on `/games`, `/games/lane-surge` and the home rail.
6. **HUD polish with `/frontend-design`.** Check the HUD at 375 px with the touch lane buttons under the CRT, and adjust only if it overflows.
7. **Verification pass.** Run `npm run lint` and `npm run build`, then every acceptance criterion below, including the Asteroids, Tetris, Arkanoid, Snake and Toad Road regression.

Before writing code, read `node_modules/next/dist/docs/` for Client Components, dynamic `import()` and lazy loading, static files in `public/`, and `'use cache'` / `cacheTag` for the cached game list.

## Acceptance criteria

- [ ] `npm run lint` finishes with no errors.
- [ ] `npm run build` finishes with no errors.
- [ ] `supabase/migrations/` contains `20261111120000_seed_lane_surge.sql`, `npm run db:types` shows no diff, and `games` has the `lane-surge` row with 0 scores.
- [ ] `/games` and `/games/lane-surge` show the title LANE SURGE and its description; the home "GAMES AVAILABLE NOW" rail lists it with the `cover-lanes` cover.
- [ ] `/games/lane-surge/play` runs the real engine with the listed controls.
- [ ] HUD values (SCORE, CELLS, ROWS) always match the engine.
- [ ] Hitting a block opens the GAME OVER modal with the same score as the HUD; END opens it with the current score; PLAY AGAIN restarts with score 0, cells 0, rows 0, the ship in the middle lane and `playing`.
- [ ] PAUSE, `P` and `Esc` freeze the game and show PAUSED; resuming does not make rows jump; switching tab pauses.
- [ ] Arrow keys do not scroll the page while playing; typing initials in the modal (including `A`, `D`) does not move the ship.
- [ ] Leaving the play page and coming back runs a single loop (normal speed, no console errors).
- [ ] The canvas uses the neon palette (dark background, green ship, magenta blocks, yellow cell), not plain white on black.
- [ ] At 375 px wide the canvas fits the CRT with no horizontal scroll, and the HUD does not overflow.
- [ ] SAVE SCORE shows `SAVING…` then `SAVED — RANK #N`; the score appears in the Hall of Fame tab for LANE SURGE, in the detail "TOP SCORES" and in home "LATEST SCORES"; the game's plays go up by 1; the other games' leaderboards are unchanged.
- [ ] Asteroids, Tetris, Arkanoid, Snake and Toad Road still play and save exactly as before.
- [ ] No secret or service-role key is used.
- [ ] A new run shows the ship in the middle lane (`x = 400`), no blocks in the first three rows, and rows arriving every 0.5 s.
- [ ] The first row with blocks reaches the ship about 3.4 s after the start.
- [ ] One key press moves the ship exactly one lane; holding a key does not repeat; `←` in the left lane and `→` in the right lane do nothing; `A` and `D` behave like the arrows.
- [ ] Rows move at 260 px/s and the spacing between two consecutive rows is exactly 130 px.
- [ ] Every row has at least one lane without a block; no row has 5 blocks (checked by a unit check of `makeRow` with 1000 random seeds).
- [ ] The gap lane of consecutive rows never differs by more than one lane.
- [ ] An energy cell is never placed in a lane that has a block in the same row, and a collected cell disappears.
- [ ] Each row passing the ship adds exactly 10 points and 1 to ROWS; each energy cell adds exactly 50 points and 1 to CELLS.
- [ ] Touching a block ends the run at once, with no death animation, and `onGameOver` is called once.
- [ ] The score never exceeds 9,999,999 in the HUD or in the saved row.
- [ ] The canvas draws no SCORE, CELLS, ROWS, GAME OVER or restart text, and no key restarts the game.
- [ ] Only the ship has glow; blocks and cells are drawn without `shadowBlur`.
- [ ] The touch lane buttons (`dpad` left and right) appear only on coarse-pointer devices and at 375×812 they do not overlap the CRT.
- [ ] Skins: `classic`, `neon` and `retro` are selectable and saved per game; switching redraws at once, also while paused.

## Decisions

- **Yes:** build from scratch as a typed engine in `lib/games/lane-surge/`, as with the other games. No globals, clean mount and unmount, typed under `strict`. Agent's choice (game jam).
- **No:** iframe to `public/` or `next/script`. The platform could not read the score, and globals and window listeners survive navigation. Agent's choice (game jam).
- **Yes:** a five-lane dodger with energy cells, as the to-do entry describes it. Provided (game jam).
- **Yes:** `id = lane-surge`, title `LANE SURGE`, `ARCADE`, `green`. Provided (game jam), taken from the pending entry in `references/game-suggestions-todo.md`.
- **Yes:** the hyphen in the id is kept, since the entry names it and dynamic routes accept any slug. Agent's choice (game jam).
- **Yes:** `sort_order = 5`, the next free value. Agent's choice (game jam).
- **Yes:** a new cover class `cover-lanes`, designed with `/frontend-design`. Agent's choice (game jam). `cover-invaders` is kept free for GRID INVASION, which is also green and pending, so the two covers stay distinct.
- **Yes:** one life. Agent's choice (game jam). A dodger ends at the first mistake, which gives every run a clear end and keeps the rules readable.
- **No:** extra lives, shields or a hit point bar in this spec. They change the difficulty and belong to the progression spec or to their own.
- **Yes:** the ship changes lane once per key press. Agent's choice (game jam). It matches the discrete hop of the other lane games and makes each dodge a deliberate decision.
- **No:** holding a key to glide between lanes. It makes the position harder to read and it moves the ship past the generator's guarantee.
- **Yes:** rows scroll at a constant 260 px/s with rows 130 px apart. Agent's choice (game jam). The spec is classic and steady, and spec 02 adds the ramp.
- **Yes:** a row always keeps one free lane, and the free lane moves at most one lane between rows. Agent's choice (game jam). This guarantees that every row is survivable with one lane change per row, so a loss is the player's fault and not the generator's.
- **Yes:** the first three rows are empty. Agent's choice (game jam). The player sees the ship and the lanes before the first block.
- **Yes:** the game starts at once, with no "press a key" wait. Agent's choice (game jam). A dodger reads better when the rows are already moving; the first safe rows give the same settling time.
- **Yes:** scoring is `10` per row passed and `50` per energy cell. Agent's choice (game jam). Surviving longer always scores more, and cells reward moving toward the open gap. Open-ended by design.
- **No:** a multiplier on the row points in this spec. It would hide the balance until spec 02 defines the levels.
- **Yes:** no sound in this spec. Agent's choice (game jam). The game does not declare `sound`, so `GamePlayer` shows no MUTE button; spec 02 adds it.
- **Yes:** lane collisions use the logical lane center; the drawn slide is cosmetic. Agent's choice (game jam). A fair dodge follows the lane the player chose, not an animation in progress.
- **Yes:** seed only; no schema change. `games`, `scores`, `submit_score` and the views are generic per `game_id`.

## Risks

| Risk                                                        | Mitigation                                                                                                       |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| StrictMode double mount starts two loops                    | `destroy()` cancels the rAF and removes input; `GameCanvas` already guards with `cancelled`.                     |
| Input steals keys from the modal                            | Shared input ignores `input`, `textarea` and contenteditable targets.                                            |
| Blurry canvas on high-DPI                                   | Backing store scaled by `devicePixelRatio` (cap 2).                                                              |
| `dt` jump after pause or tab switch skips rows              | `dt` cap of 0.05 s; `resume()` and `restart()` reset `lastTime`.                                                 |
| `shadowBlur` cost                                           | Glow only on the ship, and only in skins that set `glow: true`.                                                  |
| Autoplay policy blocks audio                                | Not applicable: the game has no sound in this spec.                                                              |
| Random rows leave no way through                            | The generator keeps one free lane per row and moves it at most one lane per row; a unit check covers 1000 seeds. |
| A row with no blocks at all makes the game too easy to read | Accepted: `BLOCK_CHANCE` gives 0 to 4 blocks per row, and the check covers the empty-row case.                   |
| Name "LANE SURGE" clashes with a future game                | The id is unique; `lane-*` is checked against the pending list, which has no other `lane` entry.                 |
| Cached game list does not show the new row until rebuild    | Step 1 says to restart the dev server; production needs a rebuild or `games` tag invalidation.                   |
| Scores forgeable until Auth                                 | Accepted in SPEC 07.                                                                                             |

## What is **not** in this spec

- Speed ramp, levels, level bonus and the SURGE twist.
- Sound, sound effects and MUTE.
- Extra lives, shields and other power-ups.
- Smooth lane gliding held by a key.
- Multiplayer and VERSUS.
- Gamepad and mouse.
- Anti-cheat, server-verified scores and Auth.
- Schema changes, a plugin system beyond the registry, and redirects.
- Any change to `references/`.

Each one of those, if it lands, goes in its own spec.
