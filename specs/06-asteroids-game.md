# SPEC 06 — Asteroids game

> **Status:** Approved
> **Depends on:** SPEC 01
> **Date:** 2026-11-06
> **Objective:** Port the vanilla canvas game in `references/started-games/02-asteroids/` to a typed TypeScript engine that is played for real at `/games/asteroids/play`, inside the platform's CRT player, HUD and GAME OVER modal.

## Why this spec exists

The platform has a catalog and a player, but every game is a fake animation with a random score. Asteroids is the first real game. It already works as a single global-scope `game.js`. That shape breaks inside React (globals, window listeners never removed, a loop that keeps running after navigation). This spec defines how a real game plugs into the player, so later games follow the same pattern.

## Scope

**In:**

- Rename the catalog entry `rocks` → `asteroids` (id and title `ASTEROIDS`) in `app/data/games.ts`, `app/data/scores.ts` and `app/data/activity.ts`.
- Rewrite `short` and `long` of that entry to describe the real game (splitting asteroids, triple shot, Nova bomb). `category`, `cover`, `color`, `best` and `plays` stay the same.
- TypeScript port of `game.js` in `lib/games/asteroids/` with no React and no globals: ship, bullets, asteroids, particles, triple-shot power-up, Nova bomb, lives, levels, invincibility on respawn, torus wrapping, same speeds, sizes and points.
- Neon palette on the canvas, taken from the `globals.css` tokens.
- Client Component `app/_components/games/asteroids-canvas.tsx` that mounts the engine on a `<canvas>` and destroys it on unmount.
- `GamePlayer` renders the real canvas when `game.id === "asteroids"` and keeps the fake arena for every other game.
- Platform HUD shows the real score, lives, level, and a power-up stat (`TRIPLE 3s`, `NOVA [B]`).
- PAUSE button, `P` and `Esc` toggle pause. The game auto-pauses when the tab is hidden.
- END forces game over with the current score. Game over opens the existing modal. PLAY AGAIN restarts the engine.
- A keyboard controls legend under the CRT.

**Out of scope (for future specs):**

- Saving scores (Supabase `scores` table, RLS). SAVE SCORE stays a mock.
- Touch / on-screen controls and gamepad.
- Sound.
- Redirect from `/games/rocks` (it 404s).
- Renaming the `cover-rocas` CSS class.
- A generic game-plugin registry for other games.
- Any change to `references/`.

## Data model

No database data. New engine types:

```ts
// lib/games/asteroids/types.ts
export type AsteroidsState = "playing" | "dead" | "gameover";

export type AsteroidsSnapshot = {
  score: number;
  lives: number; // starts at 3
  level: number; // starts at 1
  tripleTimer: number; // seconds left, 0 when inactive
  novaBombs: number; // 0 or 1
  state: AsteroidsState;
};

export type AsteroidsCallbacks = {
  onChange: (s: AsteroidsSnapshot) => void; // only when a field changes, never every frame
  onGameOver: (finalScore: number) => void;
};

// lib/games/asteroids/engine.ts
export type AsteroidsGame = {
  pause(): void;
  resume(): void;
  end(): void; // forces gameover
  restart(): void; // same as initGame()
  destroy(): void; // cancels rAF, removes listeners
};
export function createAsteroidsGame(
  canvas: HTMLCanvasElement,
  callbacks: AsteroidsCallbacks,
): AsteroidsGame;
```

Files in `lib/games/asteroids/`:

- `constants.ts`: `W = 800`, `H = 600`, `RADII`, `SPEEDS`, `POINTS`, power-up constants, and `PALETTE` (hex values that mirror `--cyan`, `--magenta`, `--yellow` and friends in `app/globals.css`).
- `entities.ts`: `Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp`. Each `draw(ctx)` receives the context instead of using a global.
- `input.ts`: keyboard state (`keys`, one-shot `pressed()`), attached to `window` and detachable.
- `engine.ts`: game state, update, draw, loop and the public `createAsteroidsGame`.
- `types.ts`: the types above.

Conventions (same as `game.js`):

- Logical field 800×600, origin top-left. The canvas backing store is scaled by `devicePixelRatio`; CSS size fills the 4:3 `.crt-screen`.
- Speeds in px/s, `dt` in seconds capped at 0.05.
- Controls: `←` `→` rotate, `↑` thrust, `Space` shoot, `B` Nova bomb, `P` / `Esc` pause.

## Implementation plan

1. Rename `rocks` → `asteroids` in `app/data/games.ts`, `scores.ts` and `activity.ts`, and rewrite `short` / `long`. Check: `/games/asteroids` shows ASTEROIDS; `/games/asteroids/play` still shows the fake player.
2. Create `lib/games/asteroids/types.ts`, `constants.ts` and `input.ts`. `input.ts` ignores events whose target is an `input` or `textarea`, and only calls `preventDefault` for arrows and Space.
3. Port the entities to `lib/games/asteroids/entities.ts`, typed and with `ctx` passed in. `Ship.tryShoot` receives `tripleTimer` as a parameter instead of reading a global. Colors come from `PALETTE` (ship cyan, asteroids yellow, bullets magenta, thrust and triple orange/magenta, soft `shadowBlur` glow).
4. Port state, update and draw to `lib/games/asteroids/engine.ts` behind `createAsteroidsGame`. Remove the canvas HUD, the GAME OVER overlay and the Space-to-restart. Emit `onChange` when a snapshot field changes and `onGameOver` once on game over. `resume()` resets `lastTime` so there is no `dt` jump. `destroy()` cancels the rAF and detaches input.
5. Create `app/_components/games/asteroids-canvas.tsx` (`"use client"`). It creates the engine in `useEffect`, destroys it in the cleanup (safe under StrictMode double mount), and exposes `pause`, `resume`, `end`, `restart` to the parent through a ref (React 19 `ref` prop).
6. Wire `GamePlayer`: when `game.id === "asteroids"` render `AsteroidsCanvas` instead of `.game-arena`, skip the fake score interval, and drive score, lives, level and `over` from the snapshot. PAUSE / END / PLAY AGAIN call the engine. Add `P` / `Esc` and `visibilitychange` pause. Add the power-up HUD stat and the controls legend. Use the `/frontend-design` skill for the HUD stat and legend.

Before writing code, read `node_modules/next/dist/docs/` for Client Components and anything about `"use client"` and refs under React 19.3 / Next 16.4.5.

## Acceptance criteria

- [ ] `npm run lint` finishes with no errors.
- [ ] `npm run build` finishes with no errors.
- [ ] `/games/asteroids` shows the title ASTEROIDS and the rewritten description; no text mentions UFOs.
- [ ] `/games/rocks` returns 404.
- [ ] `/games/asteroids/play` shows a real ship in the CRT that rotates with `←` `→`, thrusts with `↑` and shoots with `Space`.
- [ ] Destroying a large asteroid adds 20 points, a medium one 50, a small one 100, and the HUD score updates.
- [ ] A large asteroid splits into two medium ones; a medium one into two small ones; a small one disappears.
- [ ] Ship, bullets and asteroids wrap on both edges.
- [ ] Hitting an asteroid removes one life in the HUD; the ship respawns after 2 s, blinking and invincible for 3 s.
- [ ] Clearing all asteroids raises the HUD level by 1 and spawns `3 + level` large asteroids.
- [ ] Picking up the triple-shot item shows `TRIPLE Ns` in the HUD and fires 3 bullets for 5 s.
- [ ] Picking up the Nova item shows `NOVA [B]`; pressing `B` clears every asteroid, adds their points and flashes the screen.
- [ ] Losing the last life opens the GAME OVER modal with the same final score as the HUD.
- [ ] END opens the GAME OVER modal with the current score.
- [ ] PLAY AGAIN starts a new game with score 0, 3 lives and level 1.
- [ ] PAUSE, `P` and `Esc` freeze the game and show PAUSED; pressing again resumes without the objects jumping.
- [ ] Switching to another tab pauses the game.
- [ ] Typing initials with Space or arrows in the modal input does not scroll the page or affect the game.
- [ ] Arrow keys and Space do not scroll the page while playing.
- [ ] Leaving the play page and coming back runs a single game loop (speed is normal, no console errors).
- [ ] The canvas uses the neon palette, not plain white.
- [ ] At 375 px wide the canvas fits the CRT with no horizontal scroll.
- [ ] Every other game's play page still shows the fake player and behaves as before.

## Decisions

- **Yes:** reuse and rename the `rocks` entry. It already described this game; two asteroid games in the catalog would be confusing.
- **Yes:** title `ASTEROIDS`. User's choice; it matches the reference game's name.
- **No:** redirect from `/games/rocks`. Mock catalog, no real users or links.
- **Yes:** TypeScript port with a pure engine in `lib/games/asteroids/`. Typed under `strict`, no globals, clean mount and unmount.
- **No:** iframe to `public/`. The platform could not read score, lives or game over.
- **No:** loading `game.js` with `next/script`. Globals and window listeners survive navigation and duplicate loops.
- **Yes:** platform HUD and modal; the canvas draws only the game. One HUD, consistent with the rest of the player.
- **Yes:** keep triple shot and Nova bomb. They are in the reference code; its README/CLAUDE.md notes saying they were removed are stale.
- **Yes:** `onChange` only on change. Avoids a React re-render every frame.
- **Yes:** dispatch in `GamePlayer` on `game.id === "asteroids"`. Smallest change; a generic registry waits until a second real game exists.
- **No:** a static `app/games/asteroids/play` route. Duplicates the player and the HUD.
- **Yes:** neon palette from the `globals.css` tokens, mirrored as hex in `PALETTE`. Canvas cannot use CSS variables directly.
- **Yes:** SAVE SCORE stays a mock. Persisting scores needs its own Supabase spec.
- **Yes:** `P` / `Esc` plus auto-pause on tab hidden. Standard for keyboard games; avoids dying while away.
- **No:** touch controls. Widens the spec; goes in its own spec.
- **No:** renaming `cover-rocas`. Pure cosmetics, not visible to the user.

## Risks

| Risk                                                         | Mitigation                                                                                    |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| StrictMode mounts effects twice and starts two loops         | `destroy()` cancels the rAF and removes listeners; acceptance criterion checks a single loop. |
| Window key listeners steal Space/arrows from the modal input | `input.ts` ignores events from `input` / `textarea`; the engine is stopped on game over.      |
| Blurry canvas on high-DPI screens                            | Backing store scaled by `devicePixelRatio`, logical size stays 800×600.                       |
| Large `dt` after pause or tab switch                         | `dt` cap of 0.05 s kept; `resume()` resets `lastTime`.                                        |
| `shadowBlur` glow costs frame rate with many particles       | Glow only on ship, bullets and asteroids, not particles.                                      |
| "Asteroids" is the original arcade's trade name              | User's explicit choice; noted here. Revisit if the platform goes public.                      |

## What is **not** in this spec

- Saving scores to Supabase.
- Touch controls, gamepad and sound.
- Redirect from `/games/rocks`.
- A generic registry for real games.

Each one of those, if it lands, goes in its own spec.
