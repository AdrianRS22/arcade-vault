# Integration contract for a playable game

Distilled from SPEC 06 (Asteroids engine and player) and SPEC 07 (games and leaderboard tables). Every game spec written by `/new-game` must follow it. Verify against the real code before citing paths: if the code has moved on, the code wins.

## 1. Engine (`lib/games/<id>/`)

Files: `types.ts`, `constants.ts`, `entities.ts` (as needed), `engine.ts`. No React, no globals.

```ts
export function create<Name>Game(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks<Snapshot>,
  options: GameOptions, // { skin: SkinId }
): GameEngine; // pause, resume, end, restart, destroy, skins, setSkin
```

- Snapshot: `{ score: number; state: ...; ...game fields }`. `onChange(snapshot)` only when a field changes, never every frame. `onGameOver(finalScore)` once per game over.
- Logical field W×H (origin top-left). Backing store scaled by `devicePixelRatio` (capped at 2). CSS fills the 4:3 `.crt-screen`; letterbox if the game is not 4:3.
- Speeds in units/second, `dt` in seconds capped at 0.05. `resume()` and `restart()` reset `lastTime` so there is no `dt` jump.
- `end()` forces game over with the current score. `restart()` starts a fresh run. `destroy()` cancels the rAF, detaches input, stops audio, and is safe under StrictMode's double mount.
- Remove from the canvas everything the platform already shows: score/lives/level HUD, GAME OVER overlay, "press X to restart" and its key.
- Colors come from hex values mirroring `app/globals.css` tokens (canvas cannot read CSS variables). Glow (`shadowBlur`) only on key entities, never on particles.
- Skins: every game ships `lib/games/<id>/skins.ts` exporting `SKINS: Record<SkinId, ...>` with at least `classic` (the default, mirroring the `globals.css` tokens), `neon` and `retro` (`SKIN_IDS` in `lib/games/shared/skins.ts`). The engine reads `options.skin`, exposes `skins` and `setSkin(id)` (live swap and redraw, also while paused) and draws only with the active skin, so no fixed `PALETTE` is left. GamePlayer shows the SKIN selector and stores the pick per game in `av:skin:<id>`. Existing games are brought up to this with `/skin-designer <id>`.
- Score is always an integer in `0..9_999_999` (the database check).

## 2. Input

- Shared module `lib/games/shared/input.ts` (moved from `lib/games/asteroids/input.ts` at bootstrap), with a configurable set of keys to `preventDefault`.
- Ignores events whose target is `input`, `textarea` or contenteditable (the GAME OVER initials field).
- Only calls `preventDefault` for keys the game uses (arrows, Space…), so the page does not scroll while playing.
- Never binds `P` or `Esc`: the platform owns pause. Never binds `M` unless the game has sound (mute).
- Mouse/pointer: map CSS px to logical px using `getBoundingClientRect`; listen on the canvas, remove on `destroy()`.

## 3. Assets

- Copy images to `public/games/<id>/` and sounds to `public/games/<id>/sounds/`. Never edit `references/`.
- The engine preloads images and starts the loop only when they are loaded; a load failure must not crash the page (show nothing and call no `onGameOver`, log once).
- `ctx.imageSmoothingEnabled = false` for pixel-art sprites.

## 4. Sound (images and sound are both supported)

Bootstrapped by the first game that has sound, in `lib/games/shared/audio.ts`:

- Created lazily on the first user gesture (autoplay policy).
- **Muted by default.** MUTE/UNMUTE button in the HUD and the `M` key. Preference stored in `localStorage` (`av:muted`), every access wrapped in try/catch.
- Paused/suspended on pause and on hidden tab; released on `destroy()`.
- No audio plays after leaving the play page.

## 5. Registry (bootstrap once, then one entry per game)

Today `GamePlayer` (`app/_components/game-player.tsx`) imports `AsteroidsCanvas` directly and hard-codes the HUD stats and `CONTROLS`. The first game after Asteroids generalizes it:

- `lib/games/types.ts`: `GameEngine` (`pause`, `resume`, `end`, `restart`, `destroy`), `BaseSnapshot` (`score`, `state`), `GameCallbacks<S>`.
- `lib/games/registry.ts`: `Record<gameId, GameDefinition>`. Each definition has `load: () => import("./<id>/engine")` (lazy, one bundle per game), `initialSnapshot`, `hud(snapshot) → { label, value, variant? }[]`, `controls`, `ariaLabel`, and a required `touch` layout (see below). A `defineGame<S>()` helper keeps entries typed under `strict` with no `any`.
- `app/_components/games/game-canvas.tsx` replaces `asteroids-canvas.tsx`: same StrictMode-safe effect, callbacks kept in a ref, React 19 `ref` prop with `useImperativeHandle`, async engine load guarded by a `cancelled` flag.
- `GamePlayer` reads the definition by `game.id` and renders HUD stats and the controls legend from it. Pause (`P`/`Esc`/button), `visibilitychange` auto-pause, END, PLAY AGAIN and the SPEC 07 save flow stay unchanged. A catalog row with no registry entry shows a clear "not playable yet" state instead of crashing.
- `touch` (required, SPEC 11): `{ dpad: TouchDir[]; buttons: { label; code; variant? }[]; repeat?: string[] }`. `GamePlayer` renders `TouchControls` under the CRT from it, on coarse-pointer devices only. Each D-pad arrow emits its `Arrow*` code and each button emits its `code` as a synthetic `KeyboardEvent` on `window` (`lib/games/shared/virtual-keys.ts`), so the engine needs no touch code: it keeps reading keys through `createInput`. Declare only what the game uses (an arrow not in `dpad` is drawn disabled), keep button labels to ~6 chars, and list in `repeat` the codes that must auto-repeat while held (only those the engine reads with `pressedOrRepeat`, e.g. Tetris move / soft drop). The spec must state the layout and verify it on a 375×812 touch emulation.
- Asteroids moves onto the registry with identical behavior; the spec carries regression criteria for it.
- Once the registry exists, adding a game = engine in `lib/games/<id>/` + one registry entry + seed migration (+ cover CSS if new).

## 6. Database (SPEC 07)

- Only a seed migration: `supabase/migrations/<timestamp>_seed_<id>.sql` inserting one `games` row (`id`, `title`, `short`, `long`, `category` in ARCADE|PUZZLE|SHOOTER|VERSUS, `cover` existing CSS class, `color` in cyan|magenta|yellow|green, `plays = 0`, `sort_order`). No scores are seeded.
- Apply with `npm run db:push`, then `npm run db:types`; the second must show no diff on a clean tree. Confirm with the Supabase MCP `execute_sql` that the row exists and its scores are empty.
- No change to `submit_score`, the views, `saveScore`, `getMyBests`, Hall of Fame tabs, the detail "TOP SCORES" or home activity: they all key on `game_id`.
- Cached reads (`getGames`, `cacheLife("hours")`) may need a dev-server restart or rebuild to show the new row.

## 7. Pages and Next.js

- No new routes: `app/games/[id]` and `app/games/[id]/play` pick the id up from `generateStaticParams`, which reads the table.
- Keep `ensureStatic = "navigation"` and `params` read inside `<Suspense>` as they are.
- The implementer reads `node_modules/next/dist/docs/` first (Next 16.4.5, React 19.3, Cache Components).
- UI pieces (cover, HUD stats, MUTE, controls legend, touch controls) use the `/frontend-design` skill.
