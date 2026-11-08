# SPEC 10 — Snake game

> **Status:** Approved
> **Depends on:** SPEC 06, SPEC 07, SPEC 08
> **Date:** 2026-11-08
> **Objective:** Create a Snake game as a typed engine played at `/games/snake/play`, using the pixel-art fruits from `references/source-assets/snake-assets/`, with its own leaderboard.

## Why this spec exists

Unlike Asteroids, Tetris and Arkanoid, Snake has no reference game to port. `references/source-assets/snake-assets/` holds only `fruits.png` (a sprite sheet) and `sprites.js` (an atlas of rectangles), so the game is designed from scratch and the snake itself is drawn procedurally.

The registry from SPEC 08 and the shared input and audio modules from SPEC 06 and SPEC 09 already exist. Adding the game is an engine, a registry entry and a seed migration.

Two things differ from the earlier games. First, Snake is grid-based and moves in fixed steps, so the loop uses a time accumulator instead of continuous physics. Second, `sprites.js` has stale names: its rectangles are right, but the labels are shifted against the image (`x: 34` is labelled `banana` and is an apple; `x: 186` is labelled `orange` and is a banana). The image wins, and this spec relabels the 22 rectangles.

The assets contain no sound, so the game is silent and has no MUTE button.

## Scope

**In:**

- Seed migration `supabase/migrations/20261108120000_seed_snake.sql` with the `games` row (`id = 'snake'`, `title = 'SNAKE'`, `category = 'ARCADE'`, `cover = 'cover-snake'`, `color = 'green'`, `plays = 0`, `sort_order = 3`).
- Typed engine in `lib/games/snake/` (no React, no globals) with: a 20×15 grid, a snake that grows, fixed-step movement, a turn queue, one fruit at a time, a random timed bonus fruit, levels that raise the speed, and wall and self collisions.
- Scoring: `10 × level` per fruit and `50 × level` per bonus fruit.
- Asset copied to `public/games/snake/fruits.png` (the pixel-art row only is used).
- Registry entry: HUD LENGTH, LEVEL and BONUS, controls legend, no `sound`.
- Cover: reuse the existing `cover-snake` class (no new CSS unless the implementer finds it broken).
- UI pieces (cover check, HUD check at 375 px) use the `/frontend-design` skill.

**Out of scope (for future specs):**

- Touch controls, gamepad and mouse.
- Anti-cheat, server-verified scores, Auth.
- Sound, music and MUTE (the assets have none).
- Wrap-around walls, extra lives, obstacles, multiple maps or a level editor.
- Different points per fruit type (all fruits score the same).
- Other power-ups beyond the bonus fruit.
- The flat and realistic rows of `fruits.png`.
- Sprites for the snake (it is drawn with canvas shapes).
- Any change to `references/`.
- Schema changes, a plugin system beyond the registry, redirects.

## Data model

No schema change: `scores` and `submit_score` are generic per `game_id`.

Seed:

```sql
-- supabase/migrations/20261108120000_seed_snake.sql
insert into public.games (id, title, short, long, category, cover, color, plays, sort_order)
values (
  'snake',
  'SNAKE',
  'Eat the fruit, grow longer, never bite yourself.',
  'Steer a neon snake around the grid and eat the fruit to grow. Every five fruits the game speeds up, and a bonus fruit sometimes appears for a few seconds. Hit a wall or your own tail and the run is over.',
  'ARCADE',
  'cover-snake',
  'green',
  0,
  3
);
```

Snake types:

```ts
// lib/games/snake/types.ts
export type SnakeState = "waiting" | "playing" | "gameover";
export type Dir = "up" | "down" | "left" | "right";
export type Cell = { x: number; y: number }; // grid coordinates, origin top-left

export type Fruit = { cell: Cell; sprite: number }; // index into FRUIT_SPRITES
export type Bonus = Fruit & { remaining: number }; // seconds left

export type SnakeSnapshot = {
  score: number; // 0..9_999_999, clamped
  length: number; // starts at 3
  level: number; // 1, 2, 3…
  bonusSeconds: number; // 0 = no bonus on screen, else ceil(remaining)
  state: SnakeState;
};
export type SnakeCallbacks = GameCallbacks<SnakeSnapshot>;
export function createSnakeGame(
  canvas: HTMLCanvasElement,
  callbacks: SnakeCallbacks,
): GameEngine;
```

Files in `lib/games/snake/`:

- `types.ts`: the types above.
- `constants.ts`: values below and `PALETTE`.
- `sprites.ts`: `FRUIT_SPRITES`, `loadImage(url): Promise<HTMLImageElement>` and `drawFruit(ctx, img, sprite, cell)`. The image is an argument, with no module state.
- `engine.ts`: pure state and step functions, collisions, scoring, levels, loop, draw and `createSnakeGame`.

Constants (`constants.ts`):

```ts
export const CELL = 40; // px
export const COLS = 20;
export const ROWS = 15;
export const W = COLS * CELL; // 800
export const H = ROWS * CELL; // 600
export const START_LENGTH = 3; // centered, facing right

export const BASE_SPEED = 8; // steps per second at level 1
export const SPEED_PER_LEVEL = 1; // +1 step/s per level
export const MAX_SPEED = 20; // steps per second
export const FRUITS_PER_LEVEL = 5;
// level = 1 + floor(fruitsEaten / FRUITS_PER_LEVEL)
// speed = min(MAX_SPEED, BASE_SPEED + SPEED_PER_LEVEL * (level - 1))

export const FRUIT_POINTS = 10; // × level when eaten
export const BONUS_POINTS = 50; // × level when eaten
export const BONUS_CHANCE = 0.15; // rolled once per normal fruit eaten
export const BONUS_LIFETIME = 5; // s
export const BONUS_BLINK = 1.5; // s, the bonus blinks during its last 1.5 s

export const TURN_QUEUE = 2; // max queued turns
export const MAX_DT = 0.05; // s
export const MAX_SCORE = 9_999_999;
```

`FRUIT_SPRITES` keeps the rectangles of `sprites.js` (all with `y: 136`, `h: 160`) under the names the image actually shows:

```ts
// x, w from sprites.js, in order; labels corrected against fruits.png
apple 34/110, banana 186/150, pineapple 378/110, grape 540/130,
pumpkin 712/130, turnip 894/110, eggplant 1066/110, strawberry 1228/130,
cherry 1400/130, carrot 1582/110, mushroom 1734/150, broccoli 1906/150,
watermelon 2068/170, pepper 2250/140, kiwi 2432/130, lemon 2604/130,
orange 2786/110, peach 2948/130, peanut 3110/150, raspberry 3302/110,
tomato 3454/150, salad 3637/130
```

`PALETTE` mirrors `app/globals.css` tokens (background, grid lines, snake body, snake head, "PRESS AN ARROW" banner in green neon, glow).

Conventions:

- Logical field `W = 800`, `H = 600`, origin top-left. It is already 4:3, so it fills the `.crt-screen` with no letterbox. Backing store scaled by `devicePixelRatio` (cap 2) and `imageSmoothingEnabled = false`.
- The loop uses a fixed-step accumulator: each frame adds `dt` (capped at `MAX_DT`), and the snake moves one cell for every `1 / speed` seconds accumulated. `resume()` and `restart()` reset `lastTime` and the accumulator.
- Controls: `←` `↑` `↓` `→` or `W` `A` `S` `D` turn the snake. Input uses the shared `createInput` with the arrow keys and Space prevented from scrolling. No mouse. `P` and `Esc` belong to the platform. `M` is not bound (the game has no sound).
- Turn queue: each key press is read with `pressed()` and pushed to a queue of at most `TURN_QUEUE` entries. A turn equal to or opposite to the direction it follows (the last queued one, or the current direction if the queue is empty) is dropped. Each step consumes one queued turn.
- `waiting` state: the snake (length 3, centered, facing right) and the first fruit are drawn and nothing moves. The canvas shows "PRESS AN ARROW". The first direction key press changes the state to `playing` and is applied as that turn (a press of left, the opposite of the starting direction, is ignored and does not start the run).
- Eating: the fruit grows the snake by 1, adds `FRUIT_POINTS × level` (level before the level-up) and counts toward `FRUITS_PER_LEVEL`. A new fruit appears on a random free cell with a random sprite. After that, with probability `BONUS_CHANCE`, and only if no bonus is on screen, a bonus appears on another random free cell with a sprite different from the normal fruit's.
- Bonus: grows the snake by 1, adds `BONUS_POINTS × level`, does not count toward the level, and disappears after `BONUS_LIFETIME` seconds (blinking during the last `BONUS_BLINK` seconds). Its timer runs only while the state is `playing` and the game is not paused.
- Game over: the head leaves the grid or enters a body cell. The cell the tail leaves in the same step does not count as a body cell. If no free cell is left for a new fruit, the run also ends. `onGameOver(score)` fires once.
- `onChange` fires only when `score`, `length`, `level`, `bonusSeconds` or `state` changes.
- The canvas draws only the background grid, the snake (green neon, head brighter), the fruit, the bonus and the "PRESS AN ARROW" banner while `waiting`. It draws no score, length, level, GAME OVER or restart text.
- Glow (`shadowBlur`) only on the snake's head, never on the body or the fruits.
- The sprite sheet is `public/games/snake/fruits.png`. The loop starts only after the image loads. If loading fails, the engine logs once, draws nothing and never calls `onGameOver`.
- Each fruit sprite is scaled to fit inside its 40 px cell, keeping its aspect ratio and centered.

## Implementation plan

1. **Seed migration.** Write `20261108120000_seed_snake.sql`, run `npm run db:push`, then `npm run db:types`. Check with Supabase MCP `execute_sql`: `games` has `asteroids`, `tetris`, `arkanoid` and `snake`, and `scores` has no `snake` rows. Restart the dev server if the cached list does not show it. Check: `/games` lists SNAKE with `cover-snake`, and `/games/snake/play` shows "NOT PLAYABLE YET".
2. **Asset.** Copy `references/source-assets/snake-assets/fruits.png` to `public/games/snake/fruits.png` (copy, never move). Check: `/games/snake/fruits.png` returns 200 on the dev server.
3. **Types, constants and sprites.** Create `types.ts`, `constants.ts` and `sprites.ts` in `lib/games/snake/`. Check: `npm run lint` passes, no file imports React, and drawing every entry of `FRUIT_SPRITES` once on a scratch canvas shows 22 complete fruits whose names match what is drawn.
4. **Game logic.** In `engine.ts`, add the pure state and step functions: initial state, free-cell picking, turn queue, one grid step, wall and body collision with the tail exception, eating, bonus spawn and expiry, scoring with the clamp, and level and speed. Check: `npm run build` passes (no loop yet).
5. **Loop, input, drawing and registry entry.** Add `createSnakeGame`: image preload, rAF loop with the accumulator and the `dt` cap, shared `createInput`, `draw`, `onChange` only on change, `onGameOver` once, and `pause`, `resume`, `end`, `restart`, `destroy`. Add `snake` to `lib/games/registry.ts`: `initialSnapshot` (`score 0`, `length 3`, `level 1`, `bonusSeconds 0`, `waiting`), `hud` returns LENGTH (green), LEVEL (`01`, yellow) and BONUS (`5s` while a bonus is on screen, `—` otherwise, magenta), `controls` (`←` `↑` `↓` `→` Move, `W` `A` `S` `D` Move), `ariaLabel: "Snake game"`, no `sound`. Check: `/games/snake/play` runs the real game.
6. **Cover and HUD polish with `/frontend-design`.** Check `cover-snake` on `/games`, `/games/snake` and the home rail, and adjust only if it looks broken. Check the HUD with three extra stats at 375 px.
7. **Verification pass.** Run `npm run lint` and `npm run build`, then every acceptance criterion below, including the Asteroids, Tetris and Arkanoid regression.

Before writing code, read `node_modules/next/dist/docs/` for Client Components, dynamic `import()` and lazy loading, static files in `public/`, and `'use cache'` / `cacheTag` for the cached game list.

## Acceptance criteria

- [ ] `npm run lint` finishes with no errors.
- [ ] `npm run build` finishes with no errors.
- [ ] `supabase/migrations/` contains `20261108120000_seed_snake.sql`, `npm run db:types` shows no diff, and `games` has the `snake` row with 0 scores.
- [ ] `/games` and `/games/snake` show the title SNAKE and its description; the home "GAMES AVAILABLE NOW" rail lists it with the `cover-snake` cover.
- [ ] `/games/snake/play` runs the real engine with the listed controls.
- [ ] HUD values (SCORE, LENGTH, LEVEL, BONUS) always match the engine.
- [ ] Hitting a wall or the snake's own body opens the GAME OVER modal with the same score as the HUD; END opens it with the current score; PLAY AGAIN restarts with score 0, length 3, level 1, no bonus and the `waiting` state.
- [ ] PAUSE, `P` and `Esc` freeze the game and show PAUSED; resuming does not make the snake skip cells or the bonus timer jump; switching tab pauses.
- [ ] Arrow keys and Space do not scroll the page while playing; typing initials in the modal (including `W`, `A`, `S`, `D`) does not affect the game.
- [ ] Leaving the play page and coming back runs a single loop (normal speed, no console errors).
- [ ] The canvas uses the neon palette (dark background, green neon snake), not plain white on black.
- [ ] At 375 px wide the canvas fits the CRT with no horizontal scroll, and the HUD does not overflow.
- [ ] SAVE SCORE shows `SAVING…` then `SAVED — RANK #N`; the score appears in the Hall of Fame tab for SNAKE, in the detail "TOP SCORES" and in home "LATEST SCORES"; the game's plays go up by 1; the Asteroids, Tetris and Arkanoid leaderboards are unchanged.
- [ ] Asteroids, Tetris and Arkanoid still play and save exactly as before; Arkanoid keeps its MUTE button and Snake shows none.
- [ ] No secret or service-role key is used.
- [ ] Assets: the network panel shows no 404 for `fruits.png`; blocking its URL leaves a blank canvas, no crash and no GAME OVER.
- [ ] A new run shows the snake (length 3, centered, facing right) and "PRESS AN ARROW", and nothing moves until a direction key is pressed; pressing `←` first does not start the run.
- [ ] At level 1 the snake moves 8 cells per second; each level adds 1; it never moves faster than 20 cells per second.
- [ ] Eating a fruit adds exactly `10 × level` points and 1 to LENGTH; LEVEL goes up after every 5 fruits (the bonus does not count).
- [ ] The next fruit never appears on a snake cell or on the bonus cell.
- [ ] A bonus can appear only right after eating a normal fruit, never two at once; it uses a different sprite from the normal fruit, adds `50 × level` points and 1 to LENGTH, disappears after 5 seconds, blinks during its last 1.5 seconds, and HUD BONUS counts down from `5s` to `1s` and then shows `—`.
- [ ] Pressing the direction opposite to the current one does nothing; pressing the same direction does nothing.
- [ ] Two direction presses made within one step are both applied, one per step, in order; a third press in the same step is dropped.
- [ ] Moving into the cell the tail leaves in the same step does not end the run.
- [ ] Hitting the wall ends the run and `onGameOver` is called once; the snake does not wrap around.
- [ ] The drawn fruit sprites are the pixel-art row, scaled with no blur, and each of the 22 entries of `FRUIT_SPRITES` is drawn as the fruit its name says.
- [ ] The score never exceeds 9,999,999 in the HUD or in the saved row.
- [ ] The canvas draws no SCORE, LENGTH, LEVEL, GAME OVER or restart text, and no key restarts the game.

## Decisions

- **Yes:** build from scratch as a typed engine in `lib/games/snake/`, as with the other games. No globals, clean mount and unmount, typed under `strict`.
- **No:** iframe to `public/` or `next/script`. The platform could not read the score, and globals and window listeners survive navigation.
- **Yes:** `id = snake`, title `SNAKE`. User's choice. The name is generic, not a trade name.
- **Yes:** `ARCADE`, `green`, reuse of `cover-snake`, `sort_order = 3`. User's choice; green is not used by the other games (yellow, cyan, magenta) and `cover-snake` was already drawn for it.
- **Yes:** platform HUD and modal; the canvas draws only the game and the "PRESS AN ARROW" banner. SCORE, LENGTH, LEVEL and BONUS are HUD stats (user's choice).
- **Yes:** the image wins over the stale names in `sprites.js`; the rectangles are kept and the 22 names are corrected.
- **Yes:** pixel-art row of `fruits.png` (user's choice). It matches the CRT look and `imageSmoothingEnabled = false`.
- **No:** the flat and realistic rows. They clash with the neon style and their rectangles would have to be measured again.
- **Yes:** draw the snake with canvas shapes. The assets have no snake sprites.
- **Yes:** `10 × level` per fruit, level up every 5 fruits, speed +1 step/s per level up to 20 (user's choice); better players always score more.
- **No:** a different value per fruit type. The fruit sprite is cosmetic, and it avoids 22 balance decisions.
- **Yes:** random bonus fruit, 15% chance per fruit eaten, worth `50 × level` for 5 seconds (user's choice).
- **No:** a bonus every fixed number of fruits. Rejected by the user in favor of a random chance.
- **Yes:** the bonus does not count toward the level, so luck does not accelerate the game.
- **Yes:** walls kill and there is one life (user's choice). It is the classic rule and gives every run a clear end.
- **No:** wrap-around walls and 3 lives. They change the difficulty and need their own tuning.
- **Yes:** a 20×15 grid of 40 px cells, 800×600. It is 4:3, so it fills the CRT with no letterbox.
- **Yes:** fixed-step accumulator with `MAX_DT = 0.05`. Movement stays on a grid and a tab switch cannot trigger a burst of steps.
- **Yes:** turn queue of 2 with 180° turns dropped (user's choice). Fast double turns are not lost, and the snake cannot reverse into itself.
- **No:** only the last turn per step. It drops legitimate quick turns.
- **Yes:** arrows and WASD, no mouse (user's choice).
- **Yes:** the run waits for the first direction key (user's choice), so the player is ready before the snake moves.
- **No:** auto-start after one second.
- **Yes:** no sound (user's choice). The assets have none, and the game does not declare `sound`, so `GamePlayer` shows no MUTE button.
- **No:** synthesized beeps or reusing the Arkanoid MP3s. They could go in a later spec.
- **Yes:** the tail cell that moves away does not count as a body cell. Otherwise a snake following its own tail in a tight loop would die unfairly.
- **Yes:** a full board ends the run. It is a theoretical case, but the engine must not loop forever looking for a free cell.
- **Yes:** seed migration first in the plan. The registry already exists, so the play URL shows "NOT PLAYABLE YET" until step 5.
- **Yes:** `sprites.ts` takes the image as an argument. No module state survives between mounts.
- **Yes:** seed only; no schema change. `games`, `scores`, `submit_score` and the views are generic per `game_id`.

## Risks

| Risk                                                         | Mitigation                                                                                                           |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| StrictMode double mount starts two loops                     | `destroy()` cancels the rAF and removes input; `GameCanvas` already guards with `cancelled`.                         |
| Input steals keys from the modal                             | Shared input ignores `input`, `textarea` and contenteditable targets.                                                |
| Blurry canvas or pixel art on high-DPI                       | Backing store scaled by `devicePixelRatio` (cap 2); `imageSmoothingEnabled = false`.                                 |
| `dt` jump after pause or tab switch fires many steps at once | `dt` cap of 0.05 s; `resume()` and `restart()` reset `lastTime` and the accumulator.                                 |
| `shadowBlur` cost                                            | Glow only on the snake's head.                                                                                       |
| Autoplay policy blocks audio                                 | Not applicable: the game has no sound.                                                                               |
| `fruits.png` 404 or slow load                                | Loop starts only after load; a failure logs once, draws nothing and calls no `onGameOver`.                           |
| Sprite rectangles off by a few pixels or wrongly labelled    | Step 3 draws all 22 on a scratch canvas and checks names against the image; a criterion repeats the check.           |
| The sheet comes from a ripped Google Snake sprite sheet      | `sprites.js` credits spriters-resource. User's explicit choice; noted here. Revisit before the platform goes public. |
| Fast key mashing produces a deadly 180° turn                 | The turn queue drops reversals against the last queued direction, covered by a criterion.                            |
| Random bonus adds variance between runs                      | Accepted (user's choice); the bonus is worth `50 × level` and expires in 5 s.                                        |
| Cached game list does not show the new row until rebuild     | Step 1 says to restart the dev server; production needs a rebuild or `games` tag invalidation.                       |
| Scores forgeable until Auth                                  | Accepted in SPEC 07.                                                                                                 |

## What is **not** in this spec

- Touch controls, gamepad and mouse.
- Anti-cheat, server-verified scores and Auth.
- Sound, music and MUTE.
- Wrap-around walls, extra lives, obstacles, multiple maps and a level editor.
- Per-fruit-type points and other power-ups.
- The flat and realistic sprite rows and snake sprites.
- Schema changes, a plugin system beyond the registry, and redirects.
- Any change to `references/`.

Each one of those, if it lands, goes in its own spec.
