# SPEC GJ-neon-duel-01 — NEON DUEL: core

> **Status:** Draft
> **Depends on:** SPEC 06, SPEC 07, SPEC 08, SPEC 11
> **Date:** 2026-11-11
> **Objective:** Create NEON DUEL, a single-player paddle duel against a CPU opponent with spin and rally scoring, as a typed engine played at `/games/neon-duel/play` with its own leaderboard, playable from the first serve to GAME OVER.

## Why this spec exists

The game jam description asks for a single-player paddle duel against an adaptive CPU, with spin and rally streaks, in the VERSUS category. This is a genre-level take on the classic paddle-and-ball duel. It uses its own name, a neon look and no imported art or sound: every shape is drawn with canvas shapes, so there are no assets to import.

The registry from SPEC 08, the shared input module from SPEC 06 and the touch layout from SPEC 11 already exist. Adding the game is an engine, a registry entry and a seed migration. The `cover-duelo` class already exists in `app/globals.css` (a cyan paddle, a magenta paddle and a yellow ball over a dashed centre line) and fits the game, so no new cover CSS is planned.

Platform fit: VERSUS in the catalog is normally head to head, but here the opponent is the CPU, so the run needs a clear end and an open-ended score. The player has 3 lives (a life is lost each time the CPU scores), and the player's score grows with every point won and every long rally. A match has no fixed length: the run lasts until the lives run out.

This spec delivers the whole core loop: two paddles, a ball with angle and spin, a CPU opponent whose speed grows with the player's points, serves, lives, rally and point scoring, and GAME OVER. The truly adaptive CPU (skill that follows the player's performance), levels, win streak multiplier, spin bonus, extra lives, sound and MUTE come in `02-neon-duel-progression.md`.

Two things differ from the earlier games. First, the ball is fast (up to 900 px/s) and the paddle is thin (14 px), so physics runs in fixed sub-steps of 1/120 s to avoid tunnelling. Second, the ball has a spin value that curves its path, fed by the paddle's own velocity at the moment of contact.

## Scope

**In:**

- Seed migration `supabase/migrations/20261111120000_seed_neon_duel.sql` with the `games` row (`id = 'neon-duel'`, `title = 'NEON DUEL'`, `category = 'VERSUS'`, `cover = 'cover-duelo'`, `color = 'cyan'`, `plays = 0`, `sort_order = 5`).
- Typed engine in `lib/games/neon-duel/` (no React, no globals): player paddle (left), CPU paddle (right), ball with paddle-offset bounce angle, spin, growing speed per hit, wall bounces, serves, 3 lives, point and rally scoring, GAME OVER.
- CPU opponent in `cpu.ts` whose speed grows with the points the player has won (fixed ramp; the adaptive version is spec 02).
- Scoring: `100 + 10 × rally` per point won, where `rally` is the number of paddle hits in that point.
- Registry entry: HUD LIVES, WON and RALLY, controls legend, `touch` layout (up and down), no `sound`.
- Cover: reuse the existing `cover-duelo` class (no new CSS unless the implementer finds it broken).
- UI pieces (cover check, HUD check at 375 px) use the `/frontend-design` skill.

**Out of scope (for future specs):**

- Levels, serve speed ramp, adaptive CPU skill, win streak multiplier, spin bonus, extra lives, sound and MUTE (all in `02-neon-duel-progression.md`).
- Power-ups, obstacles, multi-ball and special paddles.
- Two-player mode (local or online).
- Mouse and gamepad controls.
- Skins (`classic`, `neon`, `retro`): the engine ignores `GameOptions` and sets no `skins`; the `skin-designer` agent adds them afterwards.
- Sprite and sound assets (everything is drawn with canvas shapes; sound is spec 02).
- Anti-cheat, server-verified scores, Auth.
- Any change to `references/`.
- Schema changes, a plugin system beyond the registry, redirects.

## Data model

No schema change: `scores` and `submit_score` are generic per `game_id`.

Seed:

```sql
-- supabase/migrations/20261111120000_seed_neon_duel.sql
insert into public.games (id, title, short, long, category, cover, color, plays, sort_order)
values (
  'neon-duel',
  'NEON DUEL',
  'Out-rally a CPU that learns, and curve the ball.',
  'Take the left paddle in a neon duel against the CPU. Hit the ball off the edge of the paddle to change its angle, and move as you hit to add spin. Every point you win scores more the longer the rally. Let the CPU score three times and the run is over.',
  'VERSUS',
  'cover-duelo',
  'cyan',
  0,
  5
);
```

Types:

```ts
// lib/games/neon-duel/types.ts
export type NeonDuelState = "waiting" | "playing" | "gameover";

export type Paddle = { y: number; vy: number }; // y = top edge, vy = px/s this frame
export type Ball = {
  x: number;
  y: number;
  vx: number; // px/s
  vy: number; // px/s
  speed: number; // px/s, |v| is kept equal to this
  spin: number; // px/s², added to vy, decays over time
};

export type NeonDuelSnapshot = {
  score: number; // 0..9_999_999, clamped
  lives: number; // starts at 3
  won: number; // points won by the player this run
  rally: number; // paddle hits in the current (or last) point
  state: NeonDuelState;
};
export type NeonDuelCallbacks = GameCallbacks<NeonDuelSnapshot>;
export function createNeonDuelGame(
  canvas: HTMLCanvasElement,
  callbacks: NeonDuelCallbacks,
  options?: GameOptions,
): GameEngine;
```

Files in `lib/games/neon-duel/`:

- `types.ts`: the types above.
- `constants.ts`: values below and `PALETTE`.
- `cpu.ts`: `cpuSpeed(won)`, `pickAimError()` and `cpuTargetY(ball, aimError)`; pure functions, no module state.
- `engine.ts`: pure state and step functions (serve, sub-step physics, paddle hit, wall bounce, scoring, lives), the loop, draw and `createNeonDuelGame`.

Constants (`constants.ts`):

```ts
export const W = 800;
export const H = 600;

export const PADDLE_W = 14;
export const PADDLE_H = 100;
export const PADDLE_MARGIN = 30; // px between a paddle and its wall
export const PLAYER_X = PADDLE_MARGIN; // 30, left edge of the player paddle
export const CPU_X = W - PADDLE_MARGIN - PADDLE_W; // 756, left edge of the CPU paddle
export const PLAYER_SPEED = 520; // px/s

export const BALL_R = 8;
export const SERVE_SPEED = 380; // px/s
export const SERVE_MAX_ANGLE = 0.35; // rad (~20°), random in ±this
export const SERVE_DELAY = 1.0; // s between a point and the next serve
export const MAX_BOUNCE_ANGLE = 0.96; // rad (~55°), at the very edge of a paddle
export const RALLY_SPEEDUP = 1.04; // × per paddle hit
export const MAX_BALL_SPEED = 900; // px/s
export const MIN_VX_RATIO = 0.3; // |vx| >= 0.3 × speed, so the ball never goes vertical

export const SPIN_FACTOR = 0.8; // spin = paddle vy × this at contact
export const MAX_SPIN = 500; // px/s²
export const SPIN_DECAY = 0.6; // per second, spin *= exp(-SPIN_DECAY × dt)
export const SPIN_WALL_KEEP = 0.5; // spin × this on a wall bounce

export const PHYSICS_STEP = 1 / 120; // s, fixed sub-step

export const CPU_BASE_SPEED = 300; // px/s with 0 points won
export const CPU_SPEED_PER_POINT = 10; // px/s per point won by the player
export const CPU_MAX_SPEED = 560; // px/s
export const CPU_AIM_ERROR = 30; // px, ± random offset chosen per player hit
export const CPU_REACT_X = 250; // the CPU tracks only once ball.x passes this
export const CPU_DEAD_ZONE = 6; // px, the CPU does not move inside this
export const CPU_IDLE_FACTOR = 0.5; // × speed when returning to the centre

export const START_LIVES = 3;
export const POINT_POINTS = 100; // per point won
export const RALLY_POINTS = 10; // × rally hits in that point
export const TRAIL_LENGTH = 8; // drawn positions behind the ball

export const MAX_DT = 0.05; // s
export const MAX_SCORE = 9_999_999;
// cpuSpeed(won) = min(CPU_MAX_SPEED, CPU_BASE_SPEED + CPU_SPEED_PER_POINT * won)
```

`PALETTE` mirrors `app/globals.css` tokens: background `--bg` (`#0a0a0f`), centre line `--line` (`rgba(0, 245, 255, 0.18)`), player paddle `--cyan` (`#00f5ff`), CPU paddle `--magenta` (`#ff006e`), ball `--yellow` (`#f5ff00`), ball trail (yellow at low alpha), banner text `--ink` (`#e6e9ff`).

Conventions:

- Logical field `W = 800`, `H = 600`, origin top-left. It is already 4:3, so it fills the `.crt-screen` with no letterbox. Backing store scaled by `devicePixelRatio` (cap 2).
- Units: positions in px, velocities in px/s, spin in px/s², time in seconds. The loop caps `dt` at `MAX_DT = 0.05` and runs the physics in a fixed-step accumulator of `PHYSICS_STEP`, so the ball moves at most 7.5 px per sub-step. `resume()` and `restart()` reset `lastTime` and the accumulator.
- Controls: `↑` `↓` or `W` `S` move the player paddle while held (read from `input.keys`). Space also starts the first serve. Input uses the shared `createInput` with the arrow keys and Space prevented from scrolling. No mouse. `P` and `Esc` belong to the platform. `M` is not bound (the game has no sound).
- Paddles: the player paddle is at `PLAYER_X`, the CPU paddle at `CPU_X`. Both start vertically centred and are clamped to `0..H - PADDLE_H`. `Paddle.vy` is the signed velocity actually applied this frame (zero when clamped).
- `waiting` state: both paddles and the ball (centred) are drawn and nothing moves, except the player paddle. The canvas shows "PRESS ↑ OR ↓ TO SERVE". The first press of `↑`, `↓`, `W`, `S` or Space changes the state to `playing` and starts the serve countdown.
- Serve: the ball sits at the centre for `SERVE_DELAY` seconds (blinking), then launches at `SERVE_SPEED` with a random angle in `±SERVE_MAX_ANGLE`. The first serve goes to the CPU; later serves go toward the side that just lost the point. The countdown runs only while `playing` and not paused. `rally` resets to 0 when the ball launches.
- Paddle hit: the ball hits a paddle when it moves toward it, overlaps it in x, and `|ball.y - paddleCentre| <= PADDLE_H / 2 + BALL_R`. A ball whose centre is already behind the paddle's centre line cannot be hit any more. On a hit: the ball is placed in front of the paddle face; the offset `r = clamp((ball.y - paddleCentre) / (PADDLE_H / 2), -1, 1)`; the new angle is `r × MAX_BOUNCE_ANGLE`, away from the paddle; `speed = min(MAX_BALL_SPEED, speed × RALLY_SPEEDUP)`; `spin = clamp(paddle.vy × SPIN_FACTOR, -MAX_SPIN, MAX_SPIN)`; `rally += 1`; and the CPU picks a new aim error if the hit was the player's.
- Spin: each sub-step adds `spin × PHYSICS_STEP` to `vy`, then the velocity is rescaled to `speed` and the `MIN_VX_RATIO` rule is applied (keeping the sign of `vx`). `spin` decays by `exp(-SPIN_DECAY × PHYSICS_STEP)` per sub-step. A paddle moving up (negative `vy`) curves the ball up, and moving down curves it down.
- Walls: the ball bounces off the top (`y - BALL_R < 0`) and bottom (`y + BALL_R > H`) edges with `vy` flipped and `spin × SPIN_WALL_KEEP`.
- Point: when the ball centre passes `x < -BALL_R` the CPU scores: the player loses 1 life. When it passes `x > W + BALL_R` the player scores: `won += 1` and `score += 100 + 10 × rally`, clamped to `MAX_SCORE`. After a point the ball is reset to the centre, the serve countdown restarts, and the paddles keep their positions.
- Game over: the CPU scores while `lives` is 1, so `lives` becomes 0. `onGameOver(score)` fires once. `end()` forces game over with the current score.
- CPU: it moves at `cpuSpeed(won)` px/s. While the ball moves toward it and `ball.x > CPU_REACT_X`, its target is `cpuTargetY(ball, aimError)`, the ball's current y plus the aim error, and it moves its paddle centre toward the target, staying still inside `CPU_DEAD_ZONE`. Otherwise it returns to the vertical centre at `CPU_IDLE_FACTOR × cpuSpeed`. It does not predict wall bounces, so steep shots can fool it.
- `onChange` fires only when `score`, `lives`, `won`, `rally` or `state` changes.
- The canvas draws only the background, the dashed centre line, the two paddles, the ball with a short trail, and the "PRESS ↑ OR ↓ TO SERVE" banner while `waiting`. It draws no score, lives, rally, GAME OVER or restart text, and no key restarts the game.
- Glow (`shadowBlur`) only on the ball, never on the paddles or the trail.

## Implementation plan

1. **Seed migration.** Write `20261111120000_seed_neon_duel.sql`, run `npm run db:push`, then `npm run db:types`. Check with Supabase MCP `execute_sql`: `games` has `neon-duel` (and the earlier rows), and `scores` has no `neon-duel` rows. Restart the dev server if the cached list does not show it. Check: `/games` lists NEON DUEL with `cover-duelo`, and `/games/neon-duel/play` shows "NOT PLAYABLE YET".
2. **Types and constants.** Create `types.ts` and `constants.ts` in `lib/games/neon-duel/`. Check: `npm run lint` passes and no file imports React.
3. **CPU.** Create `cpu.ts` with `cpuSpeed`, `pickAimError` and `cpuTargetY`. Check: `cpuSpeed(0) = 300`, `cpuSpeed(10) = 400`, `cpuSpeed(100) = 560`; `npm run build` passes.
4. **Game logic.** In `engine.ts`, add the pure state and step functions: initial state, serve, one physics sub-step, paddle hit with angle, speed and spin, wall bounce, point and life handling, scoring with the clamp. Check: `npm run build` passes (no loop yet).
5. **Loop, input, drawing and registry entry.** Add `createNeonDuelGame`: rAF loop with the sub-step accumulator and the `dt` cap, shared `createInput`, `draw`, `onChange` only on change, `onGameOver` once, and `pause`, `resume`, `end`, `restart`, `destroy`. Add `neon-duel` to `lib/games/registry.ts`: `initialSnapshot` (`score 0`, `lives 3`, `won 0`, `rally 0`, `waiting`), `hud` returns LIVES (`♥ ♥ ♥`, magenta), WON (cyan) and RALLY (yellow), `controls` (`↑` `↓` Move paddle, `W` `S` Move paddle, `Space` Start), `ariaLabel: "Neon Duel game"`, `touch: { dpad: ["up", "down"], buttons: [] }`, no `sound`. Check: `/games/neon-duel/play` runs the real game.
6. **Cover and HUD polish with `/frontend-design`.** Check `cover-duelo` on `/games`, `/games/neon-duel` and the home rail, and adjust only if it looks broken. Check the HUD with three extra stats at 375 px.
7. **Verification pass.** Run `npm run lint` and `npm run build`, then every acceptance criterion below, including the Asteroids, Tetris, Arkanoid and Snake regression.

Before writing code, read `node_modules/next/dist/docs/` for Client Components, dynamic `import()` and lazy loading, and `'use cache'` / `cacheTag` for the cached game list.

## Acceptance criteria

- [ ] `npm run lint` finishes with no errors.
- [ ] `npm run build` finishes with no errors.
- [ ] `supabase/migrations/` contains `20261111120000_seed_neon_duel.sql`, `npm run db:types` shows no diff, and `games` has the `neon-duel` row with 0 scores.
- [ ] `/games` and `/games/neon-duel` show the title NEON DUEL and its description; the home "GAMES AVAILABLE NOW" rail lists it with the `cover-duelo` cover; the VERSUS filter in `/games` shows it.
- [ ] `/games/neon-duel/play` runs the real engine with the listed controls.
- [ ] HUD values (SCORE, LIVES, WON, RALLY) always match the engine.
- [ ] Losing the last life opens the GAME OVER modal with the same score as the HUD; END opens it with the current score; PLAY AGAIN restarts with score 0, 3 lives, WON 0, RALLY 0 and the `waiting` state.
- [ ] PAUSE, `P` and `Esc` freeze the game and show PAUSED; resuming does not make the ball or paddles jump; switching tab pauses.
- [ ] Arrow keys and Space do not scroll the page while playing; typing initials in the modal (including `W` and `S`) does not affect the game.
- [ ] Leaving the play page and coming back runs a single loop (normal speed, no console errors).
- [ ] The canvas uses the neon palette (dark background, cyan player paddle, magenta CPU paddle, yellow ball), not plain white on black.
- [ ] At 375 px wide the canvas fits the CRT with no horizontal scroll, and the HUD does not overflow.
- [ ] SAVE SCORE shows `SAVING…` then `SAVED — RANK #N`; the score appears in the Hall of Fame tab for NEON DUEL, in the detail "TOP SCORES" and in home "LATEST SCORES"; the game's plays go up by 1; the other leaderboards are unchanged.
- [ ] Asteroids, Tetris, Arkanoid and Snake still play and save exactly as before; Arkanoid keeps its MUTE button and NEON DUEL shows none.
- [ ] No secret or service-role key is used.
- [ ] A new run shows both paddles centred, the ball at the centre and "PRESS ↑ OR ↓ TO SERVE"; nothing but the player paddle moves until `↑`, `↓`, `W`, `S` or Space is pressed.
- [ ] After the first press the ball blinks at the centre for about 1 second and then launches toward the CPU at 380 px/s.
- [ ] The player paddle moves at 520 px/s while `↑` / `W` or `↓` / `S` is held, stops when released, and never leaves the field.
- [ ] A ball hitting the centre of the paddle leaves almost horizontally; a ball hitting its top edge leaves upward at about 55°, and its bottom edge downward at about 55°.
- [ ] Each paddle hit raises HUD RALLY by 1 and the ball speed by 4%, up to 900 px/s; the ball never goes faster.
- [ ] Hitting the ball while the paddle moves up curves it upward, and while it moves down curves it downward; hitting it with a still paddle leaves it straight; the curve fades over about 2 seconds.
- [ ] The ball never passes through a paddle at top speed, and a ball that already went behind a paddle cannot be hit.
- [ ] The ball bounces off the top and bottom edges and never leaves the field vertically; it never travels vertically (always at least 30% of its speed along x).
- [ ] When the ball passes the CPU, score goes up by exactly `100 + 10 × RALLY` (for example a point after 7 hits adds 170), WON goes up by 1 and the ball serves again after 1 second toward the CPU.
- [ ] When the ball passes the player, LIVES drops by 1, the score does not change, and the next serve goes toward the player.
- [ ] RALLY resets to 0 when the next ball launches.
- [ ] The third CPU point ends the run and `onGameOver` is called once.
- [ ] The CPU paddle moves slower than the player's at the start (300 px/s) and gets faster by 10 px/s for every point won, up to 560 px/s.
- [ ] The CPU sometimes misses: a run of 10 points won in a row is reachable by a strong player, and a still player loses all 3 lives.
- [ ] The score never exceeds 9,999,999 in the HUD or in the saved row.
- [ ] The canvas draws no SCORE, LIVES, WON, RALLY, GAME OVER or restart text, and no key restarts the game.
- [ ] On a touch device the on-screen D-pad shows only up and down, and holding either moves the paddle and starts the first serve.

## Decisions

- **Yes:** build from scratch as a typed engine in `lib/games/neon-duel/`, as with the other games. No globals, clean mount and unmount, typed under `strict`. Agent's choice (game jam).
- **No:** iframe to `public/` or `next/script`. The platform could not read the score, and globals and window listeners survive navigation.
- **Yes:** `id = neon-duel`, title `NEON DUEL`. Provided (game jam). The name is generic, not a trade name, and the game is a genre-level take with no existing art, characters or music.
- **Yes:** `VERSUS`, `cyan`. Provided (game jam). `VERSUS` is the thinnest category and fits a duel.
- **Yes:** `cover-duelo`, `sort_order = 5`. Agent's choice (game jam). `cover-duelo` already exists with a cyan paddle, a magenta paddle and a yellow ball, and 5 is the next free order after Toad Road (4).
- **Yes:** single-player against a CPU with spin and rally scoring. Provided (game jam).
- **Yes:** 3 lives, one lost per CPU point, no fixed match length. Agent's choice (game jam). It gives a clear game over and an open-ended score, which a first-to-N match would not.
- **No:** first-to-N matches. The score would be capped by the match length and the run would not be open-ended.
- **Yes:** scoring `100 + 10 × rally` per point won. Agent's choice (game jam). The description gives rally streaks but no values; long rallies pay more and the ball speed rises with each hit, so they are riskier.
- **Yes:** in the core the CPU speed grows by a fixed 10 px/s per point won, up to 560. Agent's choice (game jam). It keeps spec 01 playable and finite on its own; spec 02 replaces the ramp with the adaptive skill.
- **Yes:** the adaptive CPU, levels and the streak multiplier go in spec 02. Agent's choice (game jam). The core delivers a complete game; adaptation is progression.
- **Yes:** the player is on the left, the CPU on the right, and the field is 800×600. Agent's choice (game jam). It is 4:3, so it fills the CRT with no letterbox.
- **Yes:** physics in fixed sub-steps of 1/120 s with `MAX_DT = 0.05`. Agent's choice (game jam). The ball moves at most 7.5 px per sub-step against a 14 px paddle, so it cannot tunnel, and a tab switch cannot trigger a burst.
- **Yes:** bounce angle from the offset on the paddle (up to ~55°), `+4%` speed per hit up to 900 px/s. Agent's choice (game jam). It gives the player aim and makes rallies progressively harder.
- **Yes:** spin from the paddle's velocity at contact, curving `vy` and fading over time. Agent's choice (game jam). The description names spin without a model; this one needs no extra key and rewards moving into the hit.
- **No:** a dedicated spin key or the mouse. It would add inputs that touch devices do not have.
- **Yes:** keyboard only: arrows and `W` `S`, plus Space to start. Agent's choice (game jam). None of them is `P`, `Esc` or `M`, and the touch D-pad only needs up and down.
- **Yes:** the run waits for the first key press, as Snake does. Agent's choice (game jam). The player is ready before the ball moves.
- **Yes:** the CPU does not predict wall bounces and picks a new aim error per player hit. Agent's choice (game jam). It stays beatable with angled shots and does not look robotic.
- **Yes:** the engine takes the optional `GameOptions` and ignores it. Agent's choice (game jam). `GameDefinition.load` passes it; skins are a later `skin-designer` job.
- **Yes:** platform HUD and modal; the canvas draws only the game and the serve banner. SCORE, LIVES, WON and RALLY are HUD stats. Agent's choice (game jam).
- **Yes:** no sound in the core, so `sound` is not declared and `GamePlayer` shows no MUTE. Agent's choice (game jam). Sound lands in spec 02.
- **Yes:** seed migration first in the plan. The registry already exists, so the play URL shows "NOT PLAYABLE YET" until step 5.
- **Yes:** seed only; no schema change. `games`, `scores`, `submit_score` and the views are generic per `game_id`.

## Risks

| Risk                                                                    | Mitigation                                                                                                                                  |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| StrictMode double mount starts two loops                                | `destroy()` cancels the rAF and removes input; `GameCanvas` already guards with `cancelled`.                                                |
| Input steals keys from the modal                                        | Shared input ignores `input`, `textarea` and contenteditable targets.                                                                       |
| Blurry canvas on high-DPI                                               | Backing store scaled by `devicePixelRatio` (cap 2).                                                                                         |
| `dt` jump after pause or tab switch                                     | `dt` cap of 0.05 s; `resume()` and `restart()` reset `lastTime` and the accumulator; the input is reset on pause so no key stays stuck.   |
| `shadowBlur` cost                                                       | Glow only on the ball.                                                                                                                      |
| Autoplay policy blocks audio                                            | Not applicable: the core has no sound.                                                                                                      |
| Ball tunnels through a paddle at 900 px/s                               | Fixed 1/120 s sub-steps (7.5 px max); a criterion checks top speed.                                                                         |
| Ball stuck in an endless near-vertical bounce                           | `MIN_VX_RATIO = 0.3` keeps at least 30% of the speed along x.                                                                               |
| Rally never ends with a perfect player                                  | Speed grows to 900 px/s, the CPU gets faster only up to 560, and steep, spun shots exceed its reach; a perfect run is legitimately a high score. |
| Ball hit from behind the paddle after going past it                     | A ball whose centre is behind the paddle's centre line cannot be hit; covered by a criterion.                                               |
| `VERSUS` category suggests multiplayer                                  | The description and the long text say the opponent is the CPU.                                                                              |
| Cached game list does not show the new row until rebuild                | Step 1 says to restart the dev server; production needs a rebuild or `games` tag invalidation.                                              |
| Scores forgeable until Auth                                             | Accepted in SPEC 07.                                                                                                                        |

## What is **not** in this spec

- Levels, serve speed ramp, adaptive CPU skill, win streak multiplier, spin bonus and extra lives (spec 02).
- Sound and MUTE (spec 02).
- Power-ups, obstacles, multi-ball and special paddles.
- Two-player mode, mouse and gamepad.
- Skins and sprite or sound assets.
- Anti-cheat, server-verified scores and Auth.
- Schema changes, a plugin system beyond the registry, and redirects.
- Any change to `references/`.

Each one of those, if it lands, goes in its own spec.
