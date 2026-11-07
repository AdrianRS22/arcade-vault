# SPEC 08 — Tetris game

> **Status:** Approved
> **Depends on:** SPEC 06, SPEC 07
> **Date:** 2026-11-07
> **Objective:** Port the vanilla canvas Tetris in `references/started-games/03-tetris/` to a typed engine played at `/games/tetris/play`, with its own leaderboard, and generalize the player with a game registry now that it is the second real game.

## Why this spec exists

Tetris comes from `references/started-games/03-tetris/`, a global-scope `game.js` with its own HUD, pause menu, skins, theme toggle and local records. Like SPEC 06, it must become a pure engine with no globals and no window listeners left behind, and the platform must own the HUD, pause, GAME OVER modal and score saving.

Unlike Asteroids, it is a falling-block puzzle on a 10×20 board inside a 4:3 CRT, so the board is centered in an 800×600 logical field with the NEXT preview drawn beside it.

`GamePlayer` hard-codes `AsteroidsCanvas`, the HUD stats and the controls legend. Today any catalog row would run Asteroids and save its score under the wrong `game_id`. Tetris is the second real game, so this spec generalizes the player with a registry (see `/new-game` integration contract) before adding the game. After it, adding a game is an engine, a registry entry and a seed migration.

The reference code has more than its README says: eight pieces (an extra "N" nut piece), five power-ups every 5 lines (bomb, lightning, tint, gravity, freeze), a wild block, combo, four skins, a light theme, a start-level selector and local records. The code wins; this spec says which of these are kept.

## Scope

**In:**

- Seed migration `supabase/migrations/<timestamp>_seed_tetris.sql` with the `games` row (`id = 'tetris'`, `title = 'TETRIS'`, `category = 'PUZZLE'`, `cover = 'cover-tetro'`, `color = 'cyan'`, `plays = 0`, `sort_order = 1`).
- Registry bootstrap: `lib/games/types.ts` (`GameEngine`, `BaseSnapshot`, `GameCallbacks`), `lib/games/shared/input.ts` (moved from `lib/games/asteroids/input.ts`), `lib/games/registry.ts`, `app/_components/games/game-canvas.tsx` (replaces `asteroids-canvas.tsx`) and a generic `GamePlayer`. Asteroids moves onto the registry with identical behavior.
- "Not playable yet" state in the player for a catalog row with no registry entry.
- Typed engine in `lib/games/tetris/` (no React, no globals) with: 10×20 board, 7 standard pieces plus the N piece, clockwise rotation with horizontal kicks, soft drop, hard drop, ghost piece, NEXT preview, line clearing, scoring, levels and gravity speed.
- The five power-ups (bomb, lightning, tint, gravity, freeze) and the wild block, with their reference behavior.
- NEXT preview drawn inside the canvas.
- Platform HUD: SCORE, LINES, LEVEL and a POWER-UP stat (`FREEZE Ns` while frozen).
- Controls legend for Tetris.
- Neon `PALETTE` on the canvas, one single look.
- Cover: reuse the existing `cover-tetro` class (no new CSS unless the implementer finds it broken).
- UI pieces use the `/frontend-design` skill.

**Out of scope (for future specs):**

- Touch controls and gamepad.
- Anti-cheat, server-verified scores, Auth.
- Sound (the reference has none) and the shared audio module.
- The four skins, the light/dark theme toggle and the start-level selector.
- Combo tracking and local records (`tetris-records`): the platform leaderboard replaces them.
- Hold piece, SRS rotation, T-spins, lock delay and 7-bag randomizer (the reference uses a plain random piece).
- Any change to `references/`.
- Schema changes, a plugin system beyond the registry, redirects.

## Data model

No schema change: `scores` and `submit_score` are generic per `game_id`.

Seed:

```sql
-- supabase/migrations/<timestamp>_seed_tetris.sql  (timestamp greater than 20261107120100)
insert into public.games (id, title, short, long, category, cover, color, plays, sort_order)
values (
  'tetris',
  'TETRIS',
  'Stack falling blocks and clear lines.',
  'Rotate and drop the falling pieces to complete rows before the stack reaches the top. The game speeds up every 10 lines, and every 5 lines a power-up piece arrives: bomb, lightning, tint, gravity or freeze.',
  'PUZZLE',
  'cover-tetro',
  'cyan',
  0,
  1
);
```

Shared types (registry bootstrap):

```ts
// lib/games/types.ts
export type GameEngine = {
  pause(): void;
  resume(): void;
  end(): void; // forces game over with the current score
  restart(): void; // fresh run
  destroy(): void; // cancels rAF, detaches input
};
export type BaseSnapshot = { score: number; state: string };
export type GameCallbacks<S extends BaseSnapshot> = {
  onChange: (snapshot: S) => void; // only when a field changes, never every frame
  onGameOver: (finalScore: number) => void; // once per game over
};

// lib/games/registry.ts (shape; exact generics decided in step 2)
export type HudStat = {
  label: string;
  value: string | number;
  variant?: "cyan" | "magenta" | "yellow" | "green";
};
export type GameDefinition<S extends BaseSnapshot> = {
  load: () => Promise<{
    create: (canvas: HTMLCanvasElement, cb: GameCallbacks<S>) => GameEngine;
  }>;
  initialSnapshot: S;
  hud: (s: S) => HudStat[]; // every stat except SCORE, which GamePlayer shows from BaseSnapshot
  controls: { keys: string[]; action: string }[]; // game keys only; GamePlayer appends the Pause row
  ariaLabel: string;
};
export const registry: Record<string, GameDefinition<any>>; // typed through a defineGame<S>() helper, no `any` outside it
```

Tetris types:

```ts
// lib/games/tetris/types.ts
export type TetrisState = "playing" | "gameover";

export type TetrisSnapshot = {
  score: number; // 0..9_999_999, clamped
  lines: number; // total lines cleared, starts at 0
  level: number; // 1 + floor(lines / 10), starts at 1
  freezeSeconds: number; // whole seconds left (ceil), 0 when inactive
  state: TetrisState;
};
export type TetrisCallbacks = GameCallbacks<TetrisSnapshot>;
export function createTetrisGame(
  canvas: HTMLCanvasElement,
  callbacks: TetrisCallbacks,
): GameEngine;
```

Files in `lib/games/tetris/`:

- `types.ts`: the types above, plus `Piece` (`{ type, shape: number[][], x, y, power? }`).
- `constants.ts`: values below and `PALETTE`.
- `pieces.ts`: `PIECES` (index 1..8), `rotateCW`, `randomPiece`, `randomPowerup`.
- `engine.ts`: board, collision, lock, clear, power-ups, scoring, loop, draw and `createTetrisGame`.

Constants kept from the reference (`constants.ts`):

```ts
export const COLS = 10;
export const ROWS = 20;
export const LINE_SCORES = [0, 100, 300, 500, 800]; // multiplied by level
export const SOFT_DROP_POINTS = 1; // per row
export const HARD_DROP_POINTS = 2; // per cell dropped
export const LINES_PER_LEVEL = 10;
export const KICKS = [0, -1, 1, -2, 2]; // tried in this order on rotation
export const POWERUP_EVERY = 5; // lines
export const POWERUP_POINTS = 50; // multiplied by level
export const FREEZE_SECONDS = 5;
export const WILD = 9; // block value; board values 1..8 are pieces, 10..14 are power-ups
// dropInterval(level) seconds = max(0.1, 1 - (level - 1) * 0.09)
```

Power-up values (`POWERUP_BASE = 10`): 10 bomb 💣, 11 lightning ⚡, 12 tint 🎨, 13 gravity ⬇️, 14 freeze ❄️. A power-up piece is a single cell that spawns at column 5, falls like any piece, is **not** merged into the board when it lands, and applies its effect at the landing cell:

- **Bomb:** clears the 3×3 area around the cell.
- **Lightning:** clears the landing row and the landing column.
- **Tint:** turns every cell of one piece colour into wild blocks. The colour is the one directly below the landing cell, or the most frequent colour on the board if there is none.
- **Gravity:** every column collapses downward, removing gaps.
- **Freeze:** gravity stops for `FREEZE_SECONDS`. Movement, rotation, soft drop and hard drop still work.

Every power-up adds `POWERUP_POINTS × level`. A row clears when full, or when it has exactly one gap and contains a wild block.

Conventions:

- Logical field `W = 800`, `H = 600`, origin top-left. Backing store scaled by `devicePixelRatio` (cap 2); CSS fills the 4:3 `.crt-screen`.
- Layout: `BLOCK = 28`. Board 280×560 at `(BOARD_X = 260, BOARD_Y = 20)`. NEXT box at `(580, 20)`, 4×4 cells. The canvas draws only the grid, board, ghost, current piece, NEXT label and box, and the freeze tint (no text). It draws no score, lines or level.
- `dt` in seconds, capped at 0.05. `resume()` and `restart()` reset `lastTime`.
- Controls: `←` `→` move, `↑` or `X` rotate, `↓` soft drop, `Space` hard drop. `P` and `Esc` belong to the platform.
- `←` `→` `↓` repeat through the browser's key auto-repeat, as in the reference. `↑`, `X` and `Space` act once per press. After `resume()`, held-key repeats are ignored until the key is released (the reference's `resumeGuard`).
- Game over happens when a newly spawned piece collides at once. There is no win condition.
- PALETTE mirrors `app/globals.css` tokens: I cyan, O yellow, T purple `#aa00ff`, S green, Z magenta, J a blue, L orange `#ff7700`, N `ink`, wild white. The implementer matches them to the existing tokens and the `cover-tetro` colours. Glow only on the current piece, not on every board cell.

## Implementation plan

1. **Shared types and input.** Create `lib/games/types.ts`. Move `lib/games/asteroids/input.ts` to `lib/games/shared/input.ts` with `git mv`, make the prevented keys configurable (default unchanged), and update Asteroids imports. Add `pressedOrRepeat(code)` to `Input`: true once per `keydown` event, including browser auto-repeat. Check: `npm run lint` and `npm run build` pass; Asteroids plays as before.
2. **Registry, `GameCanvas` and generic `GamePlayer`.** Create `lib/games/registry.ts` with the `defineGame<S>()` helper and the Asteroids entry (`load`, `initialSnapshot`, `hud`, `controls`, `ariaLabel`). Create `app/_components/games/game-canvas.tsx` (same StrictMode-safe effect, callbacks in a ref, React 19 `ref` prop with `useImperativeHandle`, async load guarded by a `cancelled` flag) and delete `asteroids-canvas.tsx`. `GamePlayer` reads the definition by `game.id` and renders the HUD stats and controls legend from it, appending the Pause row. Pause, `visibilitychange`, END, PLAY AGAIN and the save flow stay unchanged. A game id with no entry shows a "NOT PLAYABLE YET" state with an EXIT link. Use `/frontend-design` for that state. Check: Asteroids HUD, controls, pause, game over and SAVE SCORE behave exactly as before.
3. **Seed migration.** Write `<timestamp>_seed_tetris.sql`, run `npm run db:push`, then `npm run db:types`. Check with Supabase MCP `execute_sql`: `games` has `asteroids` and `tetris`, and `scores` has no `tetris` rows. Restart the dev server if the cached list does not show it. `/games` lists TETRIS; `/games/tetris/play` shows the "NOT PLAYABLE YET" state.
4. **Types, constants and pieces.** Create `types.ts`, `constants.ts` and `pieces.ts` in `lib/games/tetris/`: piece matrices (I, O, T, S, Z, J, L, N), `rotateCW`, `randomPiece`, `randomPowerup`, `PALETTE`. Check: `npm run lint` passes; the file imports nothing from React or the DOM.
5. **Board logic.** In `engine.ts`, add the pure state: board, `collide`, `tryRotate` with kicks, `merge`, `clearLines` with the wild rule, scoring, level and `dropInterval`, `ghostY`, `spawn` with game-over detection. Check: `npm run build` passes (no loop yet).
6. **Power-ups.** Add `applyPowerup` for the five effects, the `powerupPending` counter every 5 lines and the freeze timer. Check: `npm run lint` and `npm run build` pass.
7. **Loop, input and drawing.** Add `createTetrisGame`: rAF loop with the `dt` cap, gravity accumulator, shared input with `pressedOrRepeat`, `draw` (grid, board, ghost at alpha 0.2, current piece, NEXT, freeze tint), HUD-free canvas, `onChange` only on change, `onGameOver` once, `pause`, `resume`, `end`, `restart`, `destroy`. Clamp the score to 9,999,999. Check: `npm run build` passes.
8. **Registry entry.** Add `tetris` to `registry.ts`: `hud` returns LINES, LEVEL and POWER-UP (`FREEZE 4s` or `—`), `controls` as in the Controls convention, `ariaLabel`. Check: `/games/tetris/play` runs the real game.
9. **Cover and HUD polish with `/frontend-design`.** Check `cover-tetro` on `/games`, `/games/tetris` and the home rail; adjust only if it looks broken. Check the HUD at 375 px and the NEXT box legibility inside the CRT.
10. **Verification pass.** Run `npm run lint` and `npm run build`, then every acceptance criterion below, including the Asteroids regression.

Before writing code, read `node_modules/next/dist/docs/` for Client Components, dynamic `import()` and lazy loading, refs as props under React 19.3, and `'use cache'` / `cacheTag` for the cached game list.

## Acceptance criteria

- [ ] `npm run lint` finishes with no errors.
- [ ] `npm run build` finishes with no errors.
- [ ] `supabase/migrations/` contains `*_seed_tetris.sql`, `npm run db:types` shows no diff, and `games` has the `tetris` row with 0 scores.
- [ ] `/games` and `/games/tetris` show the title TETRIS and its description; the home "GAMES AVAILABLE NOW" rail lists it with the `cover-tetro` cover.
- [ ] `/games/tetris/play` runs the real engine with the listed controls.
- [ ] HUD values (SCORE, LINES, LEVEL, POWER-UP) always match the engine.
- [ ] Losing opens the GAME OVER modal with the same score as the HUD; END opens it with the current score; PLAY AGAIN restarts with score 0, lines 0 and level 1.
- [ ] PAUSE, `P` and `Esc` freeze the game and show PAUSED; resuming does not drop the piece by a jump; switching tab pauses.
- [ ] Arrow keys and Space do not scroll the page while playing; typing initials in the modal does not affect the game.
- [ ] Leaving the play page and coming back runs a single loop (normal speed, no console errors).
- [ ] The canvas uses the neon palette, not plain white.
- [ ] At 375 px wide the canvas fits the CRT with no horizontal scroll.
- [ ] SAVE SCORE shows `SAVING…` then `SAVED — RANK #N`; the score appears in the Hall of Fame tab for TETRIS, in the detail "TOP SCORES" and in home "LATEST SCORES"; the game's plays go up by 1; the Asteroids leaderboard is unchanged.
- [ ] Asteroids still plays and saves exactly as before (HUD LIVES, LEVEL and power-up, controls legend, pause, END, PLAY AGAIN, SAVE SCORE).
- [ ] A catalog row with no registry entry shows "NOT PLAYABLE YET" at its play URL instead of crashing (check right after step 3, before step 8).
- [ ] No secret or service-role key is used.
- [ ] `lib/games/asteroids/input.ts` and `app/_components/games/asteroids-canvas.tsx` no longer exist; no file imports them.
- [ ] `←` and `→` move the piece one column per press and never into a wall or a locked block; holding the key keeps moving it.
- [ ] `↑` and `X` rotate the piece clockwise; a piece against the left or right wall that has room after a shift of up to 2 columns still rotates.
- [ ] Each `↓` press adds 1 point and moves the piece down one row; with the piece resting, `↓` locks it.
- [ ] `Space` drops the piece to the ghost position, adds 2 points per cell dropped and locks it at once.
- [ ] The ghost piece shows where the current piece lands, at 20% opacity, and follows moves and rotations.
- [ ] The NEXT box shows the piece that spawns after the current one.
- [ ] At level 1, clearing 1, 2, 3 and 4 lines at once adds 100, 300, 500 and 800 points (plus drop points); at level N, the line points are multiplied by N.
- [ ] LINES counts every cleared row, and LEVEL goes up by 1 at 10, 20, 30… lines.
- [ ] Gravity interval is 1.00 s at level 1, 0.91 s at level 2 and never below 0.10 s (`dropInterval` in `constants.ts`).
- [ ] After every 5th cleared line (counted by total, even if one clear crosses it), the NEXT box shows a power-up icon and that piece spawns as a single cell.
- [ ] A landed power-up is not left on the board, and adds 50 × level points.
- [ ] Bomb clears the 3×3 area, lightning clears the row and column, tint turns one colour into white wild blocks, gravity removes the gaps in every column.
- [ ] A row with one gap and a wild block clears; a row with two gaps and a wild block does not.
- [ ] Freeze stops the falling piece for 5 s, the HUD shows `FREEZE Ns` counting down to `—`, and movement, rotation and drops still work meanwhile.
- [ ] A new piece that collides on spawn opens GAME OVER once (`onGameOver` is called a single time per run).
- [ ] The score never exceeds 9,999,999 in the HUD or in the saved row.
- [ ] The canvas draws no SCORE, LINES, LEVEL, GAME OVER or restart text.
- [ ] Unfocusing the window (without hiding the tab) does not open any pause menu of its own; only the platform pause exists.

## Decisions

- **Yes:** port to a typed engine in `lib/games/tetris/`, as with Asteroids. No globals, clean mount and unmount, typed under `strict`.
- **No:** iframe to `public/` or `next/script` for `game.js`. The platform could not read the score, and globals and window listeners survive navigation.
- **Yes:** platform HUD and modal; the canvas draws only the game. SCORE, LINES, LEVEL and POWER-UP are HUD stats (user's choice). Combo is not shown.
- **Yes:** `id = tetris`, title `TETRIS`. User's choice. It is a trade name (see Risks).
- **Yes:** `PUZZLE`, `cyan`, reuse of `cover-tetro`. User's choice; cyan contrasts with ASTEROIDS (yellow).
- **Yes:** keep all power-ups, the N piece and the wild block. User's choice; they are in the code even though the README does not mention them. The README is stale.
- **No:** skins, theme toggle and start-level selector (user's choice). The platform has its own theme and pause menu; one neon look fits the CRT.
- **No:** combo and local records. The platform stores the score in Supabase and shows the ranking; local records would duplicate it.
- **Yes:** NEXT drawn inside the canvas with a 4:3 logical field. It uses the CRT's free side space and needs no second canvas or a custom HUD widget.
- **Yes:** same keys as the reference (`X` rotates too). `P` and `Esc` are dropped from the engine; the platform owns pause.
- **Yes:** `pressedOrRepeat` on the shared input. The reference relies on browser key auto-repeat for move and soft drop; the one-shot `pressed()` of Asteroids would make blocks crawl one cell per press.
- **No:** custom DAS/ARR timers. They change the feel of the reference and the spec asks for a port.
- **Yes:** keep the plain random piece generator. A 7-bag, hold or SRS would change the game.
- **No:** pausing on `window` blur. The platform already pauses on `visibilitychange`, and a second pause path conflicts with its PAUSED state.
- **Yes:** keep the emoji icons for power-ups. Same as the reference; if an emoji font is missing the implementer may draw a letter instead (see Risks).
- **Yes:** a registry instead of `if (game.id === ...)`. Second real game; one definition per game keeps `GamePlayer` free of game knowledge (the "generic registry" SPEC 06 deferred).
- **Yes:** the registry step comes before the seed migration in the plan. With the seed first, `/games/tetris/play` would run Asteroids and save its scores under `tetris`.
- **Yes:** registry `controls` hold only game keys and `GamePlayer` appends the Pause row, so no game redeclares `P` / `Esc`.
- **Yes:** `hud` returns every stat except SCORE; score comes from `BaseSnapshot` because every game has it.
- **No:** lives in Tetris. A run is a single life: it ends when a spawned piece collides, as in the reference. `BaseSnapshot` only requires `score` and `state`, so `lives` stays an Asteroids-only field and Tetris shows no LIVES stat.
- **Yes:** a lazy `load()` per game. One bundle per game; Tetris code is not downloaded for Asteroids players.
- **Yes:** clamp the score at 9,999,999 in the engine. It is the database check; an unsaved game over would be worse than a capped score.
- **Yes:** seed only; no schema change. `games`, `scores`, `submit_score` and the views are generic per `game_id`.
- **No:** a sound module. The reference has no audio.

## Risks

| Risk                                                                                  | Mitigation                                                                                                                                 |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| StrictMode double mount starts two loops                                              | `destroy()` cancels the rAF and removes input; `GameCanvas` guards the async load with a `cancelled` flag; criterion checks a single loop. |
| Input steals keys from the modal                                                      | Shared input ignores `input`, `textarea` and contenteditable targets; only game keys call `preventDefault`.                                |
| Blurry canvas on high-DPI                                                             | Backing store scaled by `devicePixelRatio` (cap 2); the logical field stays 800×600.                                                       |
| `dt` jump after pause or tab switch                                                   | `dt` cap of 0.05 s; `resume()` and `restart()` reset `lastTime`; held-key repeats are ignored after resume.                                |
| `shadowBlur` cost with a full board                                                   | Glow only on the current piece, never on every locked cell.                                                                                |
| Moving Asteroids onto the registry breaks it                                          | Step 2 keeps behavior identical and the criteria include an explicit Asteroids regression.                                                 |
| Browser auto-repeat rate depends on the OS                                            | Accepted; same as the reference.                                                                                                           |
| Emoji glyphs render differently or are missing on some systems                        | Draw them centered with `textBaseline = "middle"`; fall back to a letter if a glyph is missing.                                            |
| A catalog row has no engine (e.g. seeded before its code)                             | The "NOT PLAYABLE YET" state replaces a crash.                                                                                             |
| "Tetris" is a trade name                                                              | User's explicit choice; noted here. Revisit if the platform goes public.                                                                   |
| Cached game list does not show the new row until rebuild or restart                   | Step 3 says to restart the dev server; production needs a rebuild or `games` tag invalidation.                                             |
| Scores forgeable until Auth                                                           | Accepted in SPEC 07.                                                                                                                       |
| Power-ups make a row clear without a full line (wild rule) and confuse the line count | Only rows actually removed count toward LINES and score; covered by the wild-block criteria.                                               |

## What is **not** in this spec

- Touch controls and gamepad.
- Anti-cheat, server-verified scores and Auth.
- Sound.
- Skins, theme toggle, start-level selector, combo and local records.
- Hold piece, SRS, T-spins, lock delay and 7-bag.
- Schema changes, a plugin system beyond the registry, and redirects.
- Any change to `references/`.

Each one of those, if it lands, goes in its own spec.
