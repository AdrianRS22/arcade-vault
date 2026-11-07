# SPEC 09 — Arkanoid game

> **Status:** Approved
> **Depends on:** SPEC 06, SPEC 07, SPEC 08
> **Date:** 2026-11-07
> **Objective:** Port the vanilla canvas Arkanoid in `references/started-games/04-arkanoid/` to a typed engine played at `/games/arkanoid/play`, with its own leaderboard and the platform's first shared sound module.

## Why this spec exists

Arkanoid comes from `references/started-games/04-arkanoid/`, three global-scope scripts (`assets/spritesheet.js`, `levels.js`, `game.js`) with their own HUD, "Game Over / ¡Has ganado!" overlay and a Space/click restart. Like SPEC 06 and SPEC 08, it must become a pure engine with no globals and no listeners left behind, and the platform owns the HUD, pause, GAME OVER modal and score saving.

The registry from SPEC 08 already exists. Adding the game is an engine, a registry entry and a seed migration.

Two things are new. First, the reference has **no score**, so this spec defines one. Second, it is the first game with sound (paddle bounce, brick break), so it bootstraps `lib/games/shared/audio.ts` and a MUTE control that later games reuse.

The reference ends the run with a win after level 3. Here the three layouts loop forever and get faster each pass, so a run only ends by losing every life and the leaderboard stays open-ended.

## Scope

**In:**

- Seed migration `supabase/migrations/20261107120300_seed_arkanoid.sql` with the `games` row (`id = 'arkanoid'`, `title = 'ARKANOID'`, `category = 'ARCADE'`, `cover = 'cover-bricks'`, `color = 'magenta'`, `plays = 0`, `sort_order = 2`).
- Typed engine in `lib/games/arkanoid/` (no React, no globals) with: paddle, one ball, 10-column brick wall, 3 lives, timed serve, wall/ceiling/paddle/brick collisions, 4-frame brick explosions, the 3 reference layouts and the "LEVEL N" intro freeze.
- Scoring by brick color plus a level-clear bonus.
- Endless levels: after layout 3 comes layout 1 again, with the ball 10% faster per loop, capped at 2×.
- Assets copied to `public/games/arkanoid/` (spritesheet) and `public/games/arkanoid/sounds/` (both MP3s).
- Shared audio module `lib/games/shared/audio.ts` and a MUTE/UNMUTE button plus `M` key in `GamePlayer` for games that declare sound.
- Registry entry: HUD LIVES and LEVEL, controls legend, `sound: true`.
- Cover: reuse the existing `cover-bricks` class (no new CSS unless the implementer finds it broken).
- UI pieces (MUTE button, HUD check, cover check) use the `/frontend-design` skill.

**Out of scope (for future specs):**

- Touch controls and gamepad.
- Anti-cheat, server-verified scores, Auth.
- Power-ups, capsules, multi-ball, lasers, enemies, unbreakable or multi-hit bricks (the reference has none).
- Paddle-angle bounce (the reference reflects flat; the port keeps that).
- A final "win" state, extra lives or a level editor.
- Background music and volume sliders.
- Any change to `references/`.
- Schema changes, a plugin system beyond the registry, redirects.

## Data model

No schema change: `scores` and `submit_score` are generic per `game_id`.

Seed:

```sql
-- supabase/migrations/20261107120300_seed_arkanoid.sql
insert into public.games (id, title, short, long, category, cover, color, plays, sort_order)
values (
  'arkanoid',
  'ARKANOID',
  'Smash every brick with a bouncing ball.',
  'Slide the paddle to keep the ball in play and break every brick on the wall. Three layouts loop forever, each pass faster than the last, and you only get three lives.',
  'ARCADE',
  'cover-bricks',
  'magenta',
  0,
  2
);
```

Arkanoid types:

```ts
// lib/games/arkanoid/types.ts
export type ArkanoidState = "playing" | "gameover";

export type ArkanoidSnapshot = {
  score: number; // 0..9_999_999, clamped
  lives: number; // starts at 3
  level: number; // 1, 2, 3, 4… (layout = (level - 1) % 3)
  state: ArkanoidState;
};
export type ArkanoidCallbacks = GameCallbacks<ArkanoidSnapshot>;
export function createArkanoidGame(
  canvas: HTMLCanvasElement,
  callbacks: ArkanoidCallbacks,
): GameEngine;
```

Files in `lib/games/arkanoid/`:

- `types.ts`: the types above, plus `Brick` (`{ x, y, color: BrickColor, alive }`), `Explosion` (`{ x, y, color, t }`, `t` in seconds) and `BrickColor` (`"red" | "yellow" | "cyan" | "magenta" | "hotpink" | "green"`).
- `constants.ts`: values below and `PALETTE`.
- `levels.ts`: `BRICK_COLORS` (letter → color) and `LEVELS` (the 3 reference layouts, copied verbatim).
- `sprites.ts`: `SPRITES` and `EXPLOSION_FRAMES` rectangles from `assets/spritesheet.js`, `loadSpritesheet(url): Promise<HTMLImageElement>`, `drawSprite` and `drawFrame` taking the image as an argument (no module state).
- `engine.ts`: bricks, paddle, ball, collisions, scoring, levels, loop, draw and `createArkanoidGame`.

Constants kept from the reference (`constants.ts`):

```ts
export const W = 800;
export const H = 600;
export const PADDLE = { w: 120, h: 16, y: 560, speed: 600 }; // px, px/s
export const BALL = { size: 16, speed: 360 }; // px, px/s (base speed)
export const BRICKS = { cols: 10, w: 64, h: 32, gap: 4, top: 80 }; // wall left = 62
export const START_LIVES = 3;
export const SERVE_DELAY = 1; // s, ball rests on the paddle, then launches at 45° up-right
export const LEVEL_INTRO = 1.5; // s, everything frozen, "LEVEL N" banner
export const EXPLOSION_FRAME = 0.15; // s per frame, 4 frames
export const MAX_DT = 0.05; // s (the reference used 1/30; the platform contract wins)
export const MAX_STEP = 8; // px, ball movement per sub-step (anti-tunnelling)
```

New constants (scoring and loop):

```ts
export const BRICK_POINTS: Record<BrickColor, number> = {
  red: 70,
  yellow: 60,
  cyan: 50,
  magenta: 40,
  hotpink: 30,
  green: 20,
};
export const LEVEL_CLEAR_BONUS = 1_000; // multiplied by the level just cleared
export const SPEED_STEP = 0.1; // +10% ball speed per full loop of the 3 layouts
export const MAX_SPEED_FACTOR = 2; // 720 px/s
// speedFactor(level) = min(MAX_SPEED_FACTOR, 1 + SPEED_STEP * floor((level - 1) / LEVELS.length))
```

Shared audio (new, `lib/games/shared/audio.ts`; shape, exact API decided in step 6):

```ts
export function isMuted(): boolean; // default true; reads localStorage "av:muted" ("0" | "1") in try/catch
export function setMuted(muted: boolean): void; // writes "av:muted" in try/catch, notifies listeners
export function subscribe(listener: () => void): () => void; // for useSyncExternalStore
export type SoundBank<K extends string> = {
  play(name: K): void; // no-op while muted, before unlock, or after destroy
  suspend(): void; // on engine pause
  resume(): void; // on engine resume
  destroy(): void; // stops sounds, removes gesture listeners, releases buffers
};
export function createSoundBank<K extends string>(
  urls: Record<K, string>,
): SoundBank<K>;
```

- Web Audio: the `AudioContext` is created lazily on the first `pointerdown` or `keydown` (autoplay policy), then the MP3s are fetched and decoded. A failed fetch or decode logs once and leaves that sound silent.
- `GameDefinition` gains `sound?: boolean`. When true, `GamePlayer` shows MUTE/UNMUTE and handles `M`.

Conventions:

- Logical field `W = 800`, `H = 600`, origin top-left. It is already 4:3, so it fills the `.crt-screen` with no letterbox. Backing store scaled by `devicePixelRatio` (cap 2).
- Speeds in px/s, `dt` in seconds capped at `MAX_DT`. `resume()` and `restart()` reset `lastTime`. Ball movement is split into sub-steps of at most `MAX_STEP` px, so at 720 px/s it cannot pass through the 16 px paddle or a brick.
- Controls: `←` `→` or `A` `D` move the paddle. Moving the mouse over the canvas puts the paddle center under the pointer (CSS px mapped to logical px through `getBoundingClientRect`). The keyboard takes priority until the mouse moves again, as in the reference. `P` and `Esc` belong to the platform. `M` is handled by `GamePlayer`, never by the engine. Space and click no longer restart.
- Physics as in the reference: walls and ceiling reflect, the paddle reflects only a falling ball and always sends it straight up-mirrored (flat), and at most one brick is hit per sub-step, with the bounce axis taken from the smaller overlap.
- Clearing a layout: ball and paddle freeze until the explosions finish. Then add `LEVEL_CLEAR_BONUS × level`, increment `level`, load layout `(level - 1) % 3`, recenter the paddle, start the `LEVEL_INTRO` freeze and the serve.
- Losing a ball: `lives - 1`. If lives reach 0, the state becomes `gameover` and `onGameOver(score)` fires once. Otherwise the ball goes back to the serve.
- `onChange` fires only when `score`, `lives`, `level` or `state` changes.
- Canvas draws only the background, bricks, explosions, paddle, ball and the "LEVEL N" banner during the intro. It draws no score, lives, GAME OVER or restart text.
- Sprites come from `public/games/arkanoid/spritesheet-breakout.png` with `imageSmoothingEnabled = false`. The loop starts only after the image loads. If loading fails, the engine logs once, draws nothing and never calls `onGameOver`.
- `PALETTE` mirrors `app/globals.css` tokens for the background, the "LEVEL N" banner (magenta neon) and the glow. Glow (`shadowBlur`) only on the ball and the paddle, never on bricks or explosions.

## Implementation plan

1. **Seed migration.** Write `20261107120300_seed_arkanoid.sql`, run `npm run db:push`, then `npm run db:types`. Check with Supabase MCP `execute_sql`: `games` has `asteroids`, `tetris` and `arkanoid`, and `scores` has no `arkanoid` rows. Restart the dev server if the cached list does not show it. Check: `/games` lists ARKANOID with `cover-bricks`, and `/games/arkanoid/play` shows "NOT PLAYABLE YET".
2. **Assets.** Copy `references/started-games/04-arkanoid/assets/spritesheet-breakout.png` to `public/games/arkanoid/` and both MP3s to `public/games/arkanoid/sounds/` (copy, never move). Check: `/games/arkanoid/spritesheet-breakout.png` and `/games/arkanoid/sounds/ball-bounce.mp3` return 200 on the dev server.
3. **Types, constants, levels and sprites.** Create `types.ts`, `constants.ts`, `levels.ts` and `sprites.ts` in `lib/games/arkanoid/`. Check: `npm run lint` passes, and no file imports React.
4. **Game logic.** In `engine.ts`, add the pure state and update functions: `createBricks(layout)`, paddle movement with the keyboard/mouse priority, serve, ball sub-stepping, wall/ceiling/paddle/brick collisions, explosions, scoring with the clamp, lives, level clear and loop, and `speedFactor`. Check: `npm run build` passes (no loop yet).
5. **Loop, input, drawing and registry entry.** Add `createArkanoidGame`: spritesheet preload, rAF loop with the `dt` cap, shared `createInput` (default prevented keys), mouse listener on the canvas, `draw`, `onChange` only on change, `onGameOver` once, and `pause`, `resume`, `end`, `restart`, `destroy`. Add `arkanoid` to `registry.ts`: `initialSnapshot` (`score 0`, `lives 3`, `level 1`, `playing`), `hud` returns LIVES (`♥` symbols, magenta) and LEVEL (`01`, yellow), `controls` (`← →` / `A D` Move paddle, `Mouse` Move paddle), `ariaLabel: "Arkanoid game"`. Check: `/games/arkanoid/play` runs the real game, silent.
6. **Shared audio module.** Create `lib/games/shared/audio.ts` as in the Data model. The engine creates a sound bank with `bounce` and `break`, plays `bounce` on a paddle hit and `break` on a brick hit, suspends on `pause()`, resumes on `resume()` and destroys on `destroy()`. Check: `npm run lint` and `npm run build` pass; with `localStorage["av:muted"] = "0"` set by hand, the sounds play after the first key press.
7. **MUTE control.** Add `sound?: boolean` to `GameDefinition` and `sound: true` to the Arkanoid entry. In `GamePlayer`, when `definition.sound` is true, show a MUTE/UNMUTE button in `hud-actions` (state read with `useSyncExternalStore(subscribe, isMuted, () => true)`) and toggle on `M` (ignoring `e.repeat` and text targets, like `P`). Add a `M` "Mute" row to the controls legend only for sound games. Use `/frontend-design` for the button. Check: Asteroids and Tetris show no MUTE button; Arkanoid starts muted and `M` toggles it.
8. **Cover and HUD polish with `/frontend-design`.** Check `cover-bricks` on `/games`, `/games/arkanoid` and the home rail, and adjust only if it looks broken. Check the HUD with the MUTE button at 375 px.
9. **Verification pass.** Run `npm run lint` and `npm run build`, then every acceptance criterion below, including the Asteroids and Tetris regression.

Before writing code, read `node_modules/next/dist/docs/` for Client Components, `useSyncExternalStore` and hydration in Client Components, dynamic `import()` and lazy loading, static files in `public/`, and `'use cache'` / `cacheTag` for the cached game list.

## Acceptance criteria

- [ ] `npm run lint` finishes with no errors.
- [ ] `npm run build` finishes with no errors.
- [ ] `supabase/migrations/` contains `20261107120300_seed_arkanoid.sql`, `npm run db:types` shows no diff, and `games` has the `arkanoid` row with 0 scores.
- [ ] `/games` and `/games/arkanoid` show the title ARKANOID and its description; the home "GAMES AVAILABLE NOW" rail lists it with the `cover-bricks` cover.
- [ ] `/games/arkanoid/play` runs the real engine with the listed controls.
- [ ] HUD values (SCORE, LIVES, LEVEL) always match the engine.
- [ ] Losing the last life opens the GAME OVER modal with the same score as the HUD; END opens it with the current score; PLAY AGAIN restarts with score 0, 3 lives, level 1 and the full layout 1.
- [ ] PAUSE, `P` and `Esc` freeze the game and show PAUSED; resuming does not make the ball jump; switching tab pauses.
- [ ] Arrow keys and Space do not scroll the page while playing; typing initials in the modal (including `M`, `A`, `D`) does not affect the game or the mute state.
- [ ] Leaving the play page and coming back runs a single loop (normal ball speed, no console errors).
- [ ] The canvas uses the neon palette (dark background, magenta "LEVEL N"), not plain white text on black.
- [ ] At 375 px wide the canvas fits the CRT with no horizontal scroll.
- [ ] SAVE SCORE shows `SAVING…` then `SAVED — RANK #N`; the score appears in the Hall of Fame tab for ARKANOID, in the detail "TOP SCORES" and in home "LATEST SCORES"; the game's plays go up by 1; the Asteroids and Tetris leaderboards are unchanged.
- [ ] Asteroids and Tetris still play and save exactly as before, with no MUTE button.
- [ ] No secret or service-role key is used.
- [ ] Sound: on a fresh browser profile the game is muted; MUTE/UNMUTE and `M` toggle it; the choice survives a reload (`localStorage["av:muted"]`); no audio plays after leaving the page or while PAUSED; the console shows no autoplay errors.
- [ ] Unmuted, hitting the paddle plays `ball-bounce.mp3` and breaking a brick plays `break-sound.mp3`.
- [ ] Assets: the network panel shows no 404 for the spritesheet or the sounds; blocking the spritesheet URL leaves a blank canvas, no crash and no GAME OVER.
- [ ] `←` `→` and `A` `D` move the paddle at 600 px/s and it never leaves the field; moving the mouse over the canvas centers the paddle under the pointer.
- [ ] At the start of each level, the field is frozen for 1.5 s with a "LEVEL N" banner. Then the ball rests on the paddle for 1 s and launches up-right at 45°.
- [ ] The ball bounces off the side walls, the ceiling and the paddle, and only a falling ball bounces off the paddle.
- [ ] Breaking a brick adds exactly its color points (red 70, yellow 60, cyan 50, magenta 40, hotpink 30, green 20) and plays a 4-frame explosion.
- [ ] Clearing a layout adds `1,000 × level` points, increments LEVEL and loads the next layout (level 4 uses layout 1 again).
- [ ] At level 4 the ball moves 10% faster than at level 1, at level 7 it moves 20% faster, and it never exceeds 720 px/s.
- [ ] At 720 px/s the ball never passes through the paddle or a brick.
- [ ] Losing a ball removes one life and returns to the serve; at 0 lives `onGameOver` is called once.
- [ ] The score never exceeds 9,999,999 in the HUD or in the saved row.
- [ ] The canvas draws no SCORE, LIVES, GAME OVER, "won" or restart text, and Space or a click on the canvas does not restart.

## Decisions

- **Yes:** port to a typed engine in `lib/games/arkanoid/`, as with Asteroids and Tetris. No globals, clean mount and unmount, typed under `strict`.
- **No:** iframe to `public/` or `next/script` for `game.js`. The platform could not read the score, and globals and window listeners survive navigation.
- **Yes:** platform HUD and modal; the canvas draws only the game and the "LEVEL N" banner. SCORE, LIVES and LEVEL are HUD stats (user's choice).
- **Yes:** keep the "LEVEL N" intro banner on the canvas. It is part of the game's pacing (a 1.5 s freeze), not a stat; the HUD still shows LEVEL.
- **Yes:** `id = arkanoid`, title `ARKANOID`. User's choice. It is a trade name (see Risks).
- **Yes:** `ARCADE`, `magenta`, reuse of `cover-bricks`, `sort_order = 2`. User's choice; magenta differs from ASTEROIDS (yellow) and TETRIS (cyan), and `cover-bricks` was already drawn for a brick game.
- **Yes:** points by brick color (70 to 20) plus `1,000 × level` per cleared layout. User's choice; the reference has no score.
- **Yes:** endless loop of the 3 layouts with +10% ball speed per loop, capped at 2×. User's choice; a run ends only by losing, so better players always score more.
- **No:** a win state after level 3. With a leaderboard, a hard ceiling would make every winner tie.
- **Yes:** ball sub-steps of at most 8 px. At 720 px/s and the 0.05 s `dt` cap, one step is 36 px, more than the 32 px paddle plus ball overlap.
- **Yes:** `MAX_DT = 0.05` instead of the reference's 1/30. Platform contract; the sub-steps keep collisions correct.
- **Yes:** port the controls as-is: keyboard, `A` `D` and mouse with keyboard priority, flat paddle reflection, auto-serve (user's choice).
- **No:** paddle-angle bounce. It changes the feel and the spec asks for a port.
- **No:** Space/click restart. PLAY AGAIN in the platform modal replaces it.
- **Yes:** keep both sounds and bootstrap `lib/games/shared/audio.ts` (user's choice). Later games reuse the module and the MUTE button.
- **Yes:** Web Audio with lazy unlock instead of `new Audio().cloneNode()`. One context can be suspended on pause and closed on destroy; cloned `<audio>` elements cannot be stopped as a group.
- **Yes:** muted by default, `localStorage` key `av:muted`. Platform contract; a page that makes noise on its own is hostile.
- **Yes:** `M` and the MUTE button live in `GamePlayer`, driven by `sound?: boolean` in the registry. Mute is platform UI like pause; engines only ask `isMuted()`.
- **Yes:** `useSyncExternalStore` with a muted server snapshot. The button renders "UNMUTE" on the server and on the first client render, so there is no hydration mismatch.
- **Yes:** seed migration first in the plan. The registry already exists, so the play URL shows "NOT PLAYABLE YET" until step 5 instead of running another game.
- **Yes:** `sprites.ts` takes the image as an argument instead of the reference's module-level `ssImg`. No module state survives between mounts.
- **Yes:** seed only; no schema change. `games`, `scores`, `submit_score` and the views are generic per `game_id`.
- **No:** the reference's gray brick and `.claude/skills/assets/` copy. No layout uses gray, and the copy is identical to `assets/`.

## Risks

| Risk                                                        | Mitigation                                                                                                                                |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| StrictMode double mount starts two loops or two audio banks | `destroy()` cancels the rAF, removes input and mouse listeners and destroys the sound bank; `GameCanvas` already guards with `cancelled`. |
| Input steals keys from the modal                            | Shared input and the `M` handler ignore `input`, `textarea` and contenteditable targets.                                                  |
| Blurry canvas or pixel art on high-DPI                      | Backing store scaled by `devicePixelRatio` (cap 2); `imageSmoothingEnabled = false`.                                                      |
| `dt` jump after pause or tab switch                         | `dt` cap of 0.05 s; `resume()` and `restart()` reset `lastTime`.                                                                          |
| Ball tunnels through the paddle or bricks at high speed     | Sub-steps of at most 8 px and a 2× speed cap; covered by a criterion.                                                                     |
| `shadowBlur` cost                                           | Glow only on the ball and the paddle.                                                                                                     |
| Autoplay policy blocks audio                                | `AudioContext` created on the first user gesture; muted by default; a failed decode only logs.                                            |
| Audio keeps playing after leaving the page                  | `destroy()` closes the context; pause suspends it; criterion checks silence after navigation.                                             |
| Spritesheet 404 or slow load                                | Loop starts only after load; a failure logs once, draws nothing and calls no `onGameOver`.                                                |
| Mouse mapping off when the CRT is scaled                    | Map with `getBoundingClientRect` on every move; the canvas fills the 4:3 screen with no letterbox.                                        |
| Endless loop makes runs very long                           | Accepted; the speed cap keeps the game playable and the score clamp keeps the row valid.                                                  |
| "Arkanoid" is a trade name                                  | User's explicit choice; noted here. Revisit if the platform goes public.                                                                  |
| Cached game list does not show the new row until rebuild    | Step 1 says to restart the dev server; production needs a rebuild or `games` tag invalidation.                                            |
| Scores forgeable until Auth                                 | Accepted in SPEC 07.                                                                                                                      |

## What is **not** in this spec

- Touch controls and gamepad.
- Anti-cheat, server-verified scores and Auth.
- Power-ups, multi-ball, lasers, enemies and special bricks.
- Paddle-angle bounce, a win state, extra lives and a level editor.
- Background music and volume sliders.
- Schema changes, a plugin system beyond the registry, and redirects.
- Any change to `references/`.

Each one of those, if it lands, goes in its own spec.
