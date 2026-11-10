# SPEC GJ-toadroad-01 — TOAD ROAD: core

> **Status:** Draft
> **Depends on:** SPEC 06, SPEC 07, SPEC 08
> **Date:** 2026-11-09
> **Objective:** Create TOAD ROAD, a hop-across-traffic-and-river game, as a typed engine played at `/games/toadroad/play` with its own leaderboard, playable from the first hop to GAME OVER.

## Why this spec exists

The game jam description asks for a frog that crosses a road with traffic and then a river (logs and turtles to ride) to reach goal slots at the top, without getting run over or drowning. This is a genre-level take on that idea. It does not use the name, characters, art, music or levels of any existing commercial game: the title is TOAD ROAD and every sprite is drawn with canvas shapes, so there are no assets to import.

The registry from SPEC 08 and the shared input module from SPEC 06 already exist. Adding the game is an engine, a registry entry and a seed migration. The `cover-rana` class already exists in `app/globals.css` (a green dot over cyan lane stripes) and fits the game, so no new cover CSS is planned.

This spec delivers the whole core loop at constant difficulty: lanes of traffic, lanes of logs and turtles, five goal slots, three lives, a per-attempt timer, scoring and GAME OVER. Round-after-round it repeats at the same speed, so a better player always scores more. Levels, speed ramp, extra lives, bonus fly, diving turtles and sound come in `02-toadroad-progression.md`.

Two things differ from the earlier games. First, the frog moves in discrete hops (one key press, one cell), but on the river its horizontal position is continuous because it is carried by the platform under it. Second, the lanes are wrap-around conveyor belts of objects, so the engine keeps one `offset` per lane instead of a list of moving entities.

## Scope

**In:**

- Seed migration `supabase/migrations/20261109120000_seed_toadroad.sql` with the `games` row (`id = 'toadroad'`, `title = 'TOAD ROAD'`, `category = 'ARCADE'`, `cover = 'cover-rana'`, `color = 'cyan'`, `plays = 0`, `sort_order = 4`).
- Typed engine in `lib/games/toadroad/` (no React, no globals): a 16×12 grid of 50 px cells, hop movement, 4 road lanes with cars and trucks, 5 river lanes with logs and turtles, a safe median and start row, a goal row with 5 slots, drowning, run-over, being swept off-screen, a 30 s timer per attempt, 3 lives and round clear.
- Scoring: `10` per new row reached in an attempt, `50 + 10 × seconds left` per slot filled, `1000` per round clear.
- Registry entry: HUD LIVES, HOME and TIME, controls legend, no `sound`.
- Cover: reuse the existing `cover-rana` class (no new CSS unless the implementer finds it broken).
- UI pieces (cover check, HUD check at 375 px) use the `/frontend-design` skill.

**Out of scope (for future specs):**

- Levels, speed ramp, shorter timer per level, extra lives, bonus fly, diving turtles, sound and MUTE (all in `02-toadroad-progression.md`).
- Crocodiles, otters, snakes and other special enemies.
- Touch controls, gamepad and mouse.
- Two-player mode.
- Sprite assets (everything is drawn with canvas shapes).
- Anti-cheat, server-verified scores, Auth.
- Any change to `references/`.
- Schema changes, a plugin system beyond the registry, redirects.

## Data model

No schema change: `scores` and `submit_score` are generic per `game_id`.

Seed:

```sql
-- supabase/migrations/20261109120000_seed_toadroad.sql
insert into public.games (id, title, short, long, category, cover, color, plays, sort_order)
values (
  'toadroad',
  'TOAD ROAD',
  'Cross the road and the river without becoming a pancake.',
  'Hop a neon toad across four lanes of traffic, then ride logs and turtles over the river to fill all five goal slots. Get run over, drown or run out of time and you lose a life. Clear the round and the toad goes again.',
  'ARCADE',
  'cover-rana',
  'cyan',
  0,
  4
);
```

TOAD ROAD types:

```ts
// lib/games/toadroad/types.ts
export type ToadRoadState = "playing" | "gameover";
export type LaneKind = "safe" | "road" | "river" | "goal";
export type ObjectKind = "car" | "truck" | "log" | "turtles";
export type DeathCause = "run-over" | "drowned" | "swept" | "bushed" | "time";

export type Lane = {
  row: number; // 0 = top (goal), 11 = bottom (start)
  kind: LaneKind;
  dir: 1 | -1; // 1 = moves right; ignored for safe and goal rows
  speed: number; // px/s, always positive
  object: ObjectKind | null;
  width: number; // px of one object
  count: number; // objects in the loop
  spacing: number; // px between the left edges of consecutive objects
};

export type ToadRoadSnapshot = {
  score: number; // 0..9_999_999, clamped
  lives: number; // starts at 3
  home: number; // goal slots filled, 0..5
  time: number; // ceil(seconds left in this attempt)
  state: ToadRoadState;
};
export type ToadRoadCallbacks = GameCallbacks<ToadRoadSnapshot>;
export function createToadRoadGame(
  canvas: HTMLCanvasElement,
  callbacks: ToadRoadCallbacks,
): GameEngine;
```

Files in `lib/games/toadroad/`:

- `types.ts`: the types above.
- `constants.ts`: values below and `PALETTE`.
- `lanes.ts`: the `LANES` table (12 entries) and pure helpers: `objectLeft(lane, offset, i)`, `platformAt(lane, offset, x)` and `snapToCell(x)`.
- `engine.ts`: pure state and step functions, collisions, scoring, loop, draw and `createToadRoadGame`.

Constants (`constants.ts`):

```ts
export const CELL = 50; // px
export const COLS = 16;
export const ROWS = 12;
export const W = COLS * CELL; // 800
export const H = ROWS * CELL; // 600

export const START_ROW = 11;
export const START_X = 375; // center of column 7
export const FROG_SIZE = 34; // hitbox, px, centered in its cell
export const OBJECT_INSET = 5; // objects are CELL - 2 * OBJECT_INSET = 40 px tall
export const X_MIN = 25; // hop is blocked if the new center leaves [25, 775]
export const X_MAX = 775;

export const GOAL_ROW = 0;
export const SLOT_COUNT = 5;
export const SLOT_CENTERS = [80, 240, 400, 560, 720]; // px
export const SLOT_HALF_WIDTH = 40; // landing counts if |x - center| <= 40

export const LIVES = 3;
export const ATTEMPT_TIME = 30; // s per attempt
export const DEATH_DURATION = 0.9; // s, splat or splash animation, input ignored
export const CLEAR_DURATION = 0.6; // s, round-clear flash, input ignored

export const ROW_POINTS = 10; // per new best row in an attempt
export const SLOT_POINTS = 50; // plus TIME_POINTS × ceil(seconds left)
export const TIME_POINTS = 10;
export const CLEAR_POINTS = 1000;

export const HOP_ANIM = 0.09; // s, visual only, logic is instant
export const MAX_DT = 0.05; // s
export const MAX_SCORE = 9_999_999;
```

Lane table (`LANES`, row 0 at the top). `count × spacing` is the loop length and is always at least `W + width`, so the lane never shows a gap that is not a real gap:

| Row | Kind  | Dir   | Speed px/s | Object  | Width px | Count | Spacing px |
| --- | ----- | ----- | ---------- | ------- | -------- | ----- | ---------- |
| 0   | goal  | none  | 0          | none    | 0        | 0     | 0          |
| 1   | river | right | 90         | log     | 150      | 3     | 380        |
| 2   | river | left  | 70         | turtles | 100      | 4     | 300        |
| 3   | river | right | 110        | log     | 250      | 3     | 400        |
| 4   | river | left  | 80         | turtles | 150      | 3     | 360        |
| 5   | river | right | 60         | log     | 150      | 3     | 380        |
| 6   | safe  | none  | 0          | none    | 0        | 0     | 0          |
| 7   | road  | left  | 150        | car     | 50       | 4     | 300        |
| 8   | road  | right | 100        | truck   | 100      | 3     | 400        |
| 9   | road  | left  | 120        | car     | 50       | 4     | 290        |
| 10  | road  | right | 80         | car     | 50       | 4     | 280        |
| 11  | safe  | none  | 0          | none    | 0        | 0     | 0          |

`PALETTE` mirrors `app/globals.css` tokens, since a canvas cannot read CSS variables:

```ts
export const PALETTE = {
  bg: "#0a0a0f", // --bg, safe rows and background
  road: "#15151f", // --bg-3, road lanes
  laneDash: "#4a4f70", // --ink-faint, dashed lane separators
  water: "#04243a", // --cyan at about 12% over --bg, river lanes
  wave: "rgba(0, 245, 255, 0.18)", // --line, wave strokes on the river
  grass: "#0b2a1c", // --green at about 15% over --bg, median and start rows
  bush: "#007a44", // --green dimmed, goal row between slots
  slot: "#00f5ff", // --cyan, slot outline
  frog: "#00ff88", // --green, glow only on the live frog
  frogEye: "#e6e9ff", // --ink
  carA: "#ff006e", // --magenta
  carB: "#f5ff00", // --yellow
  carC: "#00f5ff", // --cyan
  truck: "#d97a3a", // --bronze
  log: "#d97a3a", // --bronze, lighter stripe
  logDark: "#7a4320", // --bronze darkened, log body
  turtle: "#00ff88", // --green, shell outline
  turtleBody: "#0b5a3a", // --green darkened, shell fill
  splat: "#ff006e", // --magenta, run-over animation
  splash: "#00f5ff", // --cyan, drowning animation
} as const;
```

Conventions:

- Logical field `W = 800`, `H = 600`, origin top-left. It is already 4:3, so it fills the `.crt-screen` with no letterbox. Backing store scaled by `devicePixelRatio` (cap 2).
- Speeds are px/s and `dt` is in seconds, capped at `MAX_DT = 0.05`. `resume()` and `restart()` reset `lastTime`.
- Lanes: each lane keeps `offset` (px, starts at 0). Every frame `offset += dir × speed × dt`. Object `i` has its left edge at `wrap(offset + i × spacing, count × spacing) − width`, where `wrap` maps into `[0, count × spacing)`. Objects therefore leave one side and re-enter from the other, forever.
- The frog has a continuous `x` (px, center), an integer `row` and `bestRow` (smallest row reached in this attempt, starts at `START_ROW`). Its hitbox is a `FROG_SIZE` square centered at `(x, row × CELL + CELL / 2)`.
- Hops: each key press is one hop of one cell, read with `pressed()`. Holding a key does not repeat. At most one hop is applied per frame, in this priority order: up, down, left, right; the other presses of that frame are dropped. Up and down change `row` by 1 (down is blocked at `START_ROW`). Left and right change `x` by 50 px and are blocked if the new `x` leaves `[X_MIN, X_MAX]`. The logic is instant; `HOP_ANIM` only drives a visual squash and a short slide of the sprite.
- Landing on a `safe` row snaps `x` to the nearest cell center (`25 + 50 × round((x − 25) / 50)`, clamped to `[X_MIN, X_MAX]`). Landing on a river row keeps the exact `x`.
- Road rows: the frog dies (`run-over`) if its hitbox overlaps any car or truck rectangle (`OBJECT_INSET` from the top and bottom of the row). Checked every frame and at every landing.
- River rows: the frog is supported if its center `x` lies inside `[left, left + width]` of any object of that lane (a platform). Not supported: it dies (`drowned`). Supported: `x += dir × speed × dt` each frame. If `x < 0` or `x > W`, it dies (`swept`). Checked every frame and at every landing.
- Goal row (`GOAL_ROW`): reaching it resolves at once. If `x` is within `SLOT_HALF_WIDTH` of a slot center and that slot is empty, the slot is filled. Otherwise the frog dies (`bushed`, which includes a filled slot).
- Timer: `ATTEMPT_TIME` seconds per attempt, counting down only while the frog is alive and the game is not paused. At 0 the frog dies (`time`).
- Death: lives drop by 1 at once (HUD updates), the frog plays `DEATH_DURATION` seconds of animation (magenta splat for `run-over`, cyan ripples for the others), input is ignored and lanes keep moving. Then, with lives left, a new attempt starts (frog at `START_X`, `START_ROW`, `bestRow = START_ROW`, timer `ATTEMPT_TIME`). With 0 lives, `onGameOver(score)` fires once at the end of the animation.
- Round clear: filling the fifth slot adds `CLEAR_POINTS`, keeps the five frogs drawn for `CLEAR_DURATION` seconds (input ignored, timer stopped), then empties all slots (`home = 0`) and starts a new attempt. Difficulty does not change in this spec.
- Controls: `←` `↑` `↓` `→` or `W` `A` `S` `D`. Input uses the shared `createInput` with the arrow keys and Space prevented from scrolling. No mouse. `P` and `Esc` belong to the platform. `M` is not bound (no sound yet).
- `onChange` fires only when `score`, `lives`, `home`, `time` or `state` changes (`time` changes once per second).
- The canvas draws the background bands, lane dashes, river waves, goal bushes and slots, filled-slot frogs, cars, trucks, logs, turtles and the frog. It draws no score, lives, time, GAME OVER or restart text, and no key restarts the game.
- Glow (`shadowBlur`) only on the live frog, never on vehicles, platforms or the filled-slot frogs.
- No assets: everything is a canvas shape, so there is nothing to preload and the loop starts at once.

## Implementation plan

1. **Seed migration.** Write `20261109120000_seed_toadroad.sql`, run `npm run db:push`, then `npm run db:types`. Check with Supabase MCP `execute_sql`: `games` has `asteroids`, `tetris`, `arkanoid`, `snake` and `toadroad`, and `scores` has no `toadroad` rows. Restart the dev server if the cached list does not show it. Check: `/games` lists TOAD ROAD with `cover-rana`, and `/games/toadroad/play` shows "NOT PLAYABLE YET".
2. **Types, constants and lanes.** Create `types.ts`, `constants.ts` and `lanes.ts` in `lib/games/toadroad/`. Check: `npm run lint` passes, no file imports React, every lane in `LANES` has `count × spacing >= W + width`, and `objectLeft` for lane 1 at `offset = 0` returns `[-150, 230, 610]`.
3. **Game logic.** In `engine.ts`, add the pure state and step functions: initial state, lane advance, hop with bounds and snap, support check, vehicle collision, goal resolution, timer, death, new attempt, round clear, scoring with the clamp. Check: `npm run build` passes (no loop yet).
4. **Loop, input, drawing and registry entry.** Add `createToadRoadGame`: rAF loop with the `dt` cap, shared `createInput`, `draw`, `onChange` only on change, `onGameOver` once, and `pause`, `resume`, `end`, `restart`, `destroy`. Add `toadroad` to `lib/games/registry.ts`: `initialSnapshot` (`score 0`, `lives 3`, `home 0`, `time 30`, `playing`), `hud` returns LIVES (`♥` symbols, magenta), HOME (`2/5`, green) and TIME (`28s`, yellow), `controls` (`←` `↑` `↓` `→` Hop, `W` `A` `S` `D` Hop), `ariaLabel: "Toad Road game"`, no `sound`. Check: `/games/toadroad/play` runs the real game.
5. **Cover and HUD polish with `/frontend-design`.** Check `cover-rana` on `/games`, `/games/toadroad` and the home rail, and adjust only if it looks broken. Check the HUD with three extra stats at 375 px.
6. **Verification pass.** Run `npm run lint` and `npm run build`, then every acceptance criterion below, including the Asteroids, Tetris, Arkanoid and Snake regression.

Before writing code, read `node_modules/next/dist/docs/` for Client Components, dynamic `import()` and lazy loading, and `'use cache'` / `cacheTag` for the cached game list.

## Acceptance criteria

- [ ] `npm run lint` finishes with no errors.
- [ ] `npm run build` finishes with no errors.
- [ ] `supabase/migrations/` contains `20261109120000_seed_toadroad.sql`, `npm run db:types` shows no diff, and `games` has the `toadroad` row with 0 scores.
- [ ] `/games` and `/games/toadroad` show the title TOAD ROAD and its description; the home "GAMES AVAILABLE NOW" rail lists it with the `cover-rana` cover.
- [ ] `/games/toadroad/play` runs the real engine with the listed controls.
- [ ] HUD values (SCORE, LIVES, HOME, TIME) always match the engine.
- [ ] Losing the last life opens the GAME OVER modal with the same score as the HUD; END opens it with the current score; PLAY AGAIN restarts with score 0, 3 lives, HOME `0/5`, TIME `30s`, an empty goal row and the frog at the start.
- [ ] PAUSE, `P` and `Esc` freeze the game and show PAUSED; resuming does not make cars or logs jump, and the timer does not lose time while paused; switching tab pauses.
- [ ] Arrow keys and Space do not scroll the page while playing; typing initials in the modal (including `W`, `A`, `S`, `D`) does not affect the game.
- [ ] Leaving the play page and coming back runs a single loop (normal speed, no console errors).
- [ ] The canvas uses the neon palette (dark background, cyan river, magenta/yellow/cyan cars, green toad), not plain white on black.
- [ ] At 375 px wide the canvas fits the CRT with no horizontal scroll, and the HUD does not overflow.
- [ ] SAVE SCORE shows `SAVING…` then `SAVED — RANK #N`; the score appears in the Hall of Fame tab for TOAD ROAD, in the detail "TOP SCORES" and in home "LATEST SCORES"; the game's plays go up by 1; the Asteroids, Tetris, Arkanoid and Snake leaderboards are unchanged.
- [ ] Asteroids, Tetris, Arkanoid and Snake still play and save exactly as before; Arkanoid keeps its MUTE button and TOAD ROAD shows none.
- [ ] No secret or service-role key is used.
- [ ] The network panel shows no request for images or sounds from `/games/toadroad/` (there are no assets).
- [ ] A new run shows the toad at the bottom row, column 7 (`x = 375`), 12 rows (goal, 5 river, median, 4 road, start), 5 empty slots and moving traffic from the first frame.
- [ ] One key press moves the toad exactly one cell; holding a key does not repeat; pressing `←` or `→` at the screen edge does nothing; pressing `↓` on the start row does nothing; `W` `A` `S` `D` behave like the arrows.
- [ ] Hopping up onto a row it has not reached in this attempt adds exactly 10 points; going back and hopping up again to the same row adds nothing.
- [ ] Touching a car or truck loses a life, shows the magenta splat and HUD LIVES drops at once; passing through a gap between vehicles is safe.
- [ ] Hopping onto river water with no log or turtle under the toad's center loses a life with cyan ripples.
- [ ] Standing on a log or turtles with no key pressed moves the toad sideways at that lane's speed, in that lane's direction; riding it past the left or right edge of the field loses a life.
- [ ] Hopping from a river row to the median (row 6) puts the toad on a cell center (`(x − 25) % 50 === 0`).
- [ ] Reaching the goal row inside an empty slot adds `50 + 10 × ceil(seconds left)` points, raises HOME by 1, draws a toad in that slot and starts a new attempt at the start row with TIME `30s`.
- [ ] Reaching the goal row between slots, or in an already filled slot, loses a life.
- [ ] TIME counts down once per second from `30s` while the toad lives; at `0s` the toad dies and the next attempt starts at `30s`.
- [ ] After a death the toad respawns at the start after about 0.9 s; key presses during that time are ignored; the lanes keep moving.
- [ ] Filling the fifth slot adds 1000 points, shows five toads for about 0.6 s, then empties the slots (HOME `0/5`) and play continues at the same lane speeds.
- [ ] Lanes never run empty: after 5 minutes of play every road and river lane still has objects crossing the screen and re-entering from the opposite side.
- [ ] The score never exceeds 9,999,999 in the HUD or in the saved row.
- [ ] The canvas draws no SCORE, LIVES, TIME, GAME OVER or restart text, and no key restarts the game.
- [ ] Only the live toad has glow; vehicles, logs and turtles are drawn without `shadowBlur`.

## Decisions

- **Yes:** a typed engine in `lib/games/toadroad/`, as with the other games. No globals, clean mount and unmount, typed under `strict`. Provided (game jam): a canvas game on the platform.
- **No:** iframe to `public/` or `next/script`. The platform could not read the score, and globals and window listeners survive navigation.
- **Yes:** the player crosses a road with traffic, then a river with logs and turtles, to reach goal slots at the top without being run over or drowning. Provided (game jam).
- **Yes:** `id = toadroad`, title `TOAD ROAD`. Agent's choice (game jam). The description names a specific commercial game, so this spec makes a genre-level take with its own name. The id has no hyphen so it is a plain URL segment.
- **Yes:** `ARCADE`. Agent's choice (game jam). `VERSUS` is for multiplayer and `PUZZLE` and `SHOOTER` mislabel a reflex-and-timing game, even though `ARCADE` already holds two games.
- **Yes:** `color = cyan`. Agent's choice (game jam). The neighbour in `sort_order` is Snake (green), and cyan matches the river and the `cover-rana` stripes.
- **Yes:** reuse `cover-rana`. Agent's choice (game jam). The class already exists and shows a green dot over cyan lane stripes.
- **Yes:** `sort_order = 4`. Agent's choice (game jam). It is the next free value.
- **Yes:** platform HUD and modal; the canvas draws only the game. SCORE, LIVES, HOME and TIME are HUD stats. Agent's choice (game jam).
- **Yes:** a 16×12 grid of 50 px cells, 800×600. Agent's choice (game jam). It is 4:3, so it fills the CRT with no letterbox, and 12 rows fit goal, 5 river lanes, median, 4 road lanes and start.
- **Yes:** all art drawn with canvas shapes, no assets. Agent's choice (game jam). It keeps the spec self-contained and avoids copying anyone's sprites.
- **Yes:** instant logical hops with a visual-only tween. Agent's choice (game jam). Collisions stay deterministic and input never feels late.
- **No:** hop repeat on held keys. It makes precise timing harder and the frog would run into traffic.
- **Yes:** the frog dies if its hitbox overlaps a vehicle, but river support uses its center point. Agent's choice (game jam). Vehicles feel fair with a slightly smaller hitbox (34 of 50 px), and platforms forgive an edge landing.
- **Yes:** riding off-screen kills. Agent's choice (game jam). It is the classic risk of a slow log and keeps the river lethal.
- **Yes:** landing on a safe row snaps to a cell center. Agent's choice (game jam). The land rows are grid-aligned and the next hops stay predictable.
- **Yes:** goal row resolves on arrival; bushes and filled slots kill. Agent's choice (game jam). Aiming at the slot is the final skill check.
- **Yes:** 3 lives, 30 s per attempt. Agent's choice (game jam). It gives a clear run end and a reason not to wait.
- **Yes:** `10` per new row, `50 + 10 × seconds left` per slot, `1000` per round clear. Agent's choice (game jam). The score is open-ended because rounds repeat, and speed makes it rise with skill.
- **Yes:** the round repeats at the same difficulty in this spec. Agent's choice (game jam). The ramp is the first item of spec 02 so each spec stays small and playable.
- **Yes:** lanes as conveyor belts with one `offset` per lane. Agent's choice (game jam). No entity spawning, no allocation per frame and no empty lanes.
- **No:** random traffic. A fixed table is easier to tune and to verify.
- **Yes:** no sound in this spec. Agent's choice (game jam). The game declares no `sound`, so `GamePlayer` shows no MUTE button; spec 02 adds it.
- **Yes:** seed only; no schema change. `games`, `scores`, `submit_score` and the views are generic per `game_id`.

## Risks

| Risk                                                     | Mitigation                                                                                              |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| StrictMode double mount starts two loops                 | `destroy()` cancels the rAF and removes input; `GameCanvas` already guards with `cancelled`.            |
| Input steals keys from the modal                         | Shared input ignores `input`, `textarea` and contenteditable targets.                                   |
| Blurry canvas on high-DPI                                | Backing store scaled by `devicePixelRatio` (cap 2).                                                     |
| `dt` jump after pause or tab switch moves lanes far      | `dt` cap of 0.05 s; `resume()` and `restart()` reset `lastTime`.                                        |
| `shadowBlur` cost                                        | Glow only on the live frog.                                                                             |
| Autoplay policy blocks audio                             | Not applicable: the game has no sound in this spec.                                                     |
| "Frogger" is a commercial name and a known design        | Own title, own art, own lane table; only the genre idea (provided by the description) is used.          |
| A lane combination can make the river impassable         | Gaps are at least 150 px and every lane loops forever; step 2 checks the loop lengths.                  |
| Floating-point drift in `offset` after a long session    | `offset` is reduced modulo the loop length every frame.                                                 |
| Frog carried off-screen while a death animation plays    | `x` stops updating once the frog dies; the animation draws at the death position, clamped to the field. |
| Round repeats forever at one speed, so runs may not end  | Accepted for this spec: 30 s per attempt and 3 lives still end the run; spec 02 adds the ramp.          |
| Cached game list does not show the new row until rebuild | Step 1 says to restart the dev server; production needs a rebuild or `games` tag invalidation.          |
| Scores forgeable until Auth                              | Accepted in SPEC 07.                                                                                    |

## What is **not** in this spec

- Levels, speed ramp, shorter timer per level, extra lives, bonus fly, diving turtles, sound and MUTE.
- Crocodiles, otters, snakes and other special enemies.
- Touch controls, gamepad and mouse.
- Two-player mode.
- Sprite assets.
- Anti-cheat, server-verified scores and Auth.
- Schema changes, a plugin system beyond the registry, and redirects.
- Any change to `references/`.

Each one of those, if it lands, goes in its own spec.
