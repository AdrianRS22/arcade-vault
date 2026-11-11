# SPEC GJ-lane-surge-02 — LANE SURGE: surge edition

> **Status:** Draft
> **Depends on:** SPEC 06, SPEC 07, SPEC 08, SPEC 09, SPEC 11, SPEC GJ-lane-surge-01
> **Date:** 2026-11-11
> **Objective:** Make LANE SURGE escalate with levels and a speed ramp, add the SURGE twist (energy cells charge a meter that turns the ship into a 3-second block smasher), and add synthesized sound with MUTE.

## Why this spec exists

Spec 01 is a steady, classic dodger: energy cells are only points. This spec turns them into a resource. Five cells charge the SURGE meter, and pressing Space spends the charge to smash through blocks for three seconds. That makes every cell a choice: grab it now for points, or pick the route that lets you save the charge for a crowded row.

Levels make the run escalate. Every 20 rows the scroll speed rises by 10% of the base speed and the rows get denser, up to a cap, so a better player always goes further and scores more. The surge edition is a distinct variant of the same game: the rules of spec 01 still hold, with the surge and the ramp added on top.

It also adds the game's sound. The shared `lib/games/shared/audio.ts` and the MUTE control already exist (SPEC 09), so the game declares `sound: true` and uses `createSoundBank`. The Arkanoid MP3s do not fit a dodger, so five short effects are synthesized into `public/games/lane-surge/sounds/`, the same way TOAD ROAD does it.

Two things differ from spec 01. First, the blocks now have a state: solid blocks collide, and broken blocks (smashed during a surge) are scenery. Second, the SURGE is the only action on Space, so the touch layout gets its first action button.

## Scope

**In:**

- Levels: `level = 1 + floor(rows / 20)`, with a level bonus of `100 × level` on each level up.
- Speed ramp: the scroll speed is `260 × min(2.0, 1 + 0.1 × (level − 1))` px/s.
- Density ramp: the block chance per lane is `min(0.8, 0.6 + 0.03 × (level − 1))`.
- SURGE meter: each energy cell adds 1 charge, up to 5. A full meter shows READY; Space spends it.
- SURGE mode: 3 seconds during which the ship smashes solid blocks it touches. Each smash scores `25 × level`. Broken blocks no longer collide.
- Sound: five WAV effects, `createSoundBank`, MUTE in the HUD, the `M` key handled by the platform, suspend on pause.
- Registry changes: HUD LEVEL, ROWS and SURGE (replacing CELLS), controls legend with Space, `sound: true`, touch SURGE button.
- Skins: `surge` and `broken` colours added to each palette in `skins.ts`.
- HUD and touch polish at 375 px with `/frontend-design`.

**Out of scope (for future specs):**

- Stacking surges, surge charge above 5, or a second surge while one is active.
- Other power-ups, pickups or shields.
- Extra lives or any health system.
- Speed above the cap (2.0× at level 11 and beyond) and any boss or special row.
- Background music and a music track.
- Changing the spec 01 scoring of rows and cells.
- Multiplayer and VERSUS.
- Gamepad and mouse.
- Anti-cheat, server-verified scores, Auth.
- Any change to `references/`.
- Schema changes, a plugin system beyond the registry, redirects.

## Data model

No schema change: `scores` and `submit_score` are generic per `game_id`. The seed row is the one from spec 01, so this spec adds no migration.

Changes to the types from spec 01:

```ts
// lib/games/lane-surge/types.ts
export type BlockCell = "solid" | "broken" | null; // null = no block in this lane

export type Row = {
  y: number;
  index: number;
  blocks: BlockCell[]; // replaces boolean[]: length 5
  cell: number | null;
  passed: boolean;
};

export type LaneSurgeSnapshot = {
  score: number; // 0..9_999_999, clamped
  rows: number; // rows that passed the ship
  level: number; // 1, 2, 3…
  energy: number; // SURGE charge, 0..5
  surgeSeconds: number; // 0 = not surging, else ceil(seconds left)
  state: LaneSurgeState;
};
```

The `cells` field leaves the snapshot. The engine still counts energy cells for the charge; the score already includes them. `createLaneSurgeGame` keeps its signature.

Constants added to `constants.ts`:

```ts
export const LEVEL_ROWS = 20; // rows per level
export const SPEED_STEP = 0.1; // +10% of SCROLL_SPEED per level
export const MAX_SPEED_MULT = 2.0; // reached at level 11
export const LEVEL_POINTS = 100; // × new level, on each level up
export const BLOCK_STEP = 0.03; // + per level on top of BLOCK_CHANCE
export const MAX_BLOCK_CHANCE = 0.8; // reached at level 8

export const SURGE_CHARGE = 5; // energy cells that fill the meter
export const SURGE_DURATION = 3; // s of playing time
export const SURGE_SMASH_POINTS = 25; // × level per block smashed
```

Derived values (computed, not stored):

```ts
// level = 1 + floor(rows / LEVEL_ROWS)
// scroll speed = SCROLL_SPEED × min(MAX_SPEED_MULT, 1 + SPEED_STEP × (level - 1))
//   level 1 = 260 px/s, level 2 = 286 px/s, level 11 and beyond = 520 px/s
// block chance = min(MAX_BLOCK_CHANCE, BLOCK_CHANCE + BLOCK_STEP × (level - 1))
//   level 1 = 0.60, level 2 = 0.63, level 8 and beyond = 0.80
```

Sound (`sounds.ts`):

```ts
export const SOUND_URLS = {
  cell: "/games/lane-surge/sounds/cell.wav",
  surge: "/games/lane-surge/sounds/surge.wav",
  smash: "/games/lane-surge/sounds/smash.wav",
  level: "/games/lane-surge/sounds/level.wav",
  crash: "/games/lane-surge/sounds/crash.wav",
} as const;
```

Sound files in `public/games/lane-surge/sounds/`, 22050 Hz mono 16-bit PCM WAV, each under 0.6 s and under 40 KB, generated by a one-off script kept outside the repo and committed as the files:

- `cell.wav`: short square blip, 880 Hz rising to 1320 Hz in 0.12 s.
- `surge.wav`: sweep from 220 Hz to 1760 Hz in 0.4 s.
- `smash.wav`: noise burst of 0.2 s with an exponential decay.
- `level.wav`: arpeggio of 523, 659 and 784 Hz, 0.15 s each.
- `crash.wav`: saw sweep from 400 Hz down to 60 Hz in 0.5 s.

Palette additions (`skins.ts`), on top of spec 01's `LaneSurgePalette`:

```ts
// surge:  the ship trail and the ship while surging
// broken: a smashed block, drawn as two thin shards
// classic: surge #00f5ff (--cyan), broken #3b0d22
// neon:    surge #00f5ff, broken #2a0816
// retro:   surge #e8ff7a, broken #1f3d26
```

Conventions (in addition to spec 01):

- Level: `level` is derived from `rows` after each pass. When it goes up, `LEVEL_POINTS × newLevel` is added once and `level` is emitted in the same `onChange`.
- Speed and density change immediately. Rows already on screen keep their `y`; the spacing stays `ROW_GAP` px, so a faster scroll means rows arrive sooner.
- Energy: each collected cell adds 1 to `energy` up to `SURGE_CHARGE`. A cell at full charge still adds `CELL_POINTS` and is removed.
- Surge activation: Space starts a surge only if `energy === SURGE_CHARGE` and no surge is active. Then `surgeSeconds` is set to `SURGE_DURATION`, `energy` goes to 0 and `surge.wav` plays. Any other Space press does nothing, with no sound and no change.
- During a surge, `surgeSeconds` counts down in playing time only (no countdown while paused or game over). At 0 the surge ends and the ship is normal again.
- During a surge, every frame each solid block that overlaps the ship hitbox becomes `broken`, scores `SURGE_SMASH_POINTS × level` and plays `smash.wav`. A broken block never collides again. Smashing never ends the run. The surge check runs before the timer in each frame.
- Outside a surge, a solid block that overlaps the ship ends the run as in spec 01. Blocks the ship overlaps during a surge are smashed in the same frame, so none overlaps when the surge ends. A solid block that the ship moves into after the surge is solid and kills.
- Lane changes work the same during a surge. Surging does not change the lane rules.
- Input: `createInput` now prevents `ArrowLeft`, `ArrowRight` and `Space`. `P` and `Esc` belong to the platform. `M` is handled by the platform (the game declares `sound`) and is not bound by the engine.
- Pause: `pause()` calls `soundBank.suspend()` and freezes rows, timers and the surge countdown. `resume()` calls `soundBank.resume()` and resets `lastTime`. `destroy()` calls `soundBank.destroy()`.
- `onChange` fires only when `score`, `rows`, `level`, `energy`, `surgeSeconds` or `state` changes. `surgeSeconds` changes once per second during a surge.
- The canvas draws everything from spec 01, plus the surge: the ship in the `surge` colour with a short trail while surging, and broken blocks as dimmed shards with no glow. The canvas still draws no level, speed, meter or surge text.
- Glow (`shadowBlur`) stays on the ship only, as in spec 01. A surging ship keeps the glow when the skin allows it.

## Implementation plan

1. **Sound assets.** Generate the five WAVs with a one-off script kept outside the repo (in the scratchpad), and copy them into `public/games/lane-surge/sounds/`. Check: on the dev server each `/games/lane-surge/sounds/<name>.wav` returns 200 and is under 40 KB.
2. **Types, constants, palettes and sound map.** Update `types.ts`, `constants.ts` and `skins.ts` with the surge and broken colours, and create `sounds.ts`. Check: `npm run lint` passes, no file imports React.
3. **Generator.** Change `makeRow` to take the block chance as a parameter, and add the density formula. Check: with a fixed `random` sequence, the level 1 chance is 0.6, the level 8 chance is 0.8, no row has 5 blocks, and the gap rule still holds.
4. **Game logic.** In `engine.ts`, add the level and level bonus, the speed and density ramp, energy and charge, surge activation and countdown, the smash and broken state, and the new snapshot fields. Check: `npm run build` passes.
5. **Loop, input, sound and drawing.** Create the sound bank in `createLaneSurgeGame`, wire `suspend`, `resume` and `destroy`, prevent Space, and draw the surge trail and broken blocks. Check: `/games/lane-surge/play` runs with the surge, and the page does not scroll on Space.
6. **Registry entry.** Update `lib/games/registry.ts` for `lane-surge`: `initialSnapshot` (`score 0`, `rows 0`, `level 1`, `energy 0`, `surgeSeconds 0`, `playing`), `hud` returns LEVEL (`01`, yellow), ROWS (green), and SURGE (`0/5` cyan while charging, `READY` yellow at 5, `3s` magenta while active). `controls` adds `Space` as Surge. `sound: true`. `touch.buttons` gets `{ label: "SURGE", code: "Space", variant: "yellow" }`. Check: MUTE shows on the play page, `M` toggles it.
7. **HUD and touch polish with `/frontend-design`.** Check the HUD with three stats and the MUTE button at 375 px, and the SURGE touch button under the CRT. Adjust only if something overflows or overlaps.
8. **Verification pass.** Run `npm run lint` and `npm run build`, then every acceptance criterion below, including the spec 01 criteria that still hold and the regression for the other games.

Before writing code, read `node_modules/next/dist/docs/` for Client Components, dynamic `import()` and lazy loading, static files in `public/`, and `'use cache'` / `cacheTag` for the cached game list.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors, and `npm run db:types` shows no diff (no new migration).
- [ ] `/games/lane-surge/play` shows HUD LEVEL, ROWS and SURGE, the MUTE button, and the controls legend lists the `M` row and the Space row.
- [ ] HUD values (SCORE, LEVEL, ROWS, SURGE) always match the engine.
- [ ] A new run and PLAY AGAIN start at LEVEL `01`, SURGE `0/5`, ROWS `0`, with the ship in the middle lane.
- [ ] Passing 20 rows raises LEVEL to `02` and adds exactly 200 points; passing 40 rows raises it to `03` and adds 300 more.
- [ ] Scroll speed is exactly 260 px/s at level 1, 286 px/s at level 2, and 520 px/s from level 11 onward; it never exceeds 520 px/s.
- [ ] At level 8 and beyond the block chance per non-gap lane is 0.8; the gap lane of every row is never blocked, so no row has 5 blocks, and the gap rule still holds.
- [ ] Each energy cell adds 1 to the SURGE charge up to 5; a cell collected at 5 still adds 50 points and leaves the charge at 5 (HUD `READY`).
- [ ] Space at a charge below 5 does nothing: no sound, no HUD change, no surge.
- [ ] Space at a charge of 5 starts a surge: the HUD shows `3s` in magenta, the charge goes back to `0/5`, and the surge ends after 3.0 s of playing time (HUD `3s`, `2s`, `1s`, then back to charging).
- [ ] A second Space during a surge does nothing; a surge cannot be started until the charge is full again.
- [ ] Pausing freezes the surge countdown; resuming continues it from the same value.
- [ ] During a surge, a solid block that overlaps the ship turns broken, adds `25 × level` points, plays `smash.wav` and does not end the run.
- [ ] A broken block never collides again and is drawn dimmed without glow.
- [ ] Outside a surge, a solid block that overlaps the ship ends the run with the GAME OVER modal, with the same score as the HUD.
- [ ] Lane changes work normally during a surge.
- [ ] Sound: muted by default; MUTE and `M` toggle it and persist across reloads; unmuted, `cell.wav` plays on each energy cell, `surge.wav` on activation, `smash.wav` on each smash, `level.wav` on a level up and `crash.wav` on game over.
- [ ] Pausing suspends the audio and resuming restores it; no audio plays after leaving the play page; no console autoplay errors.
- [ ] Assets: the network panel shows no 404 for the five WAVs; blocking one leaves that sound silent, logs once and does not crash the game.
- [ ] Touch: the SURGE button appears only on coarse-pointer devices; tapping it starts a surge when the charge is full; at 375×812 the HUD with three stats, the MUTE button and the touch buttons do not overflow and the canvas fits the CRT with no horizontal scroll.
- [ ] The score never exceeds 9,999,999 in the HUD or in the saved row, including the smash and level bonuses.
- [ ] SAVE SCORE still shows `SAVING…` then `SAVED — RANK #N` and the score appears in the Hall of Fame, the detail "TOP SCORES" and home "LATEST SCORES".
- [ ] Spec 01 criteria still hold, except the CELLS HUD stat, which is replaced by SURGE.
- [ ] Asteroids, Tetris, Arkanoid, Snake and Toad Road still play and save exactly as before; Arkanoid keeps its MUTE button, and Snake and Toad Road still show none.

## Decisions

- **Yes:** this spec is a variant of LANE SURGE, not a copy of spec 01. It adds the SURGE twist, the ramp and the sound on top of the classic rules. Agent's choice (game jam). The registry allows one entry per game id, so the variant lives in the same game and is not a second catalog row.
- **No:** a separate catalog entry for a "classic" and a "surge" mode. The id, title and cover would duplicate, and the mode selector would need a platform change. Agent's choice (game jam).
- **Yes:** energy cells charge the surge, with a cap of 5 cells. Agent's choice (game jam). It ties the twist to the existing item, so the rules are unchanged except for one new use of the cells.
- **Yes:** the surge smashes blocks instead of making the ship invulnerable. Agent's choice (game jam). A smash scores points and clears the way, so the surge is a tool for timing and not just a shield.
- **Yes:** 3 seconds of surge, counted in playing time. Agent's choice (game jam). It is long enough to clear a crowded row and short enough that the charge is always a decision.
- **No:** stacking or extending a surge. A second surge could make a run feel solved. Agent's choice (game jam).
- **Yes:** a level every 20 rows, with a `100 × level` bonus. Agent's choice (game jam). The bonus rewards survival, and the level is tied to the rows the player has seen.
- **Yes:** speed up 10% of the base speed per level, capped at 2.0× (level 11). Agent's choice (game jam). The cap keeps the lane changes readable at the top speed.
- **Yes:** density up by 0.03 per level, capped at 0.8. Agent's choice (game jam). The cap keeps at least one lane open even at the highest density, on top of the gap rule.
- **Yes:** blocks have a `broken` state. Agent's choice (game jam). A smashed block should not kill, and keeping it as scenery makes the smash visible.
- **Yes:** the smash also scores `25 × level` per block, so a surge at a high level pays more. Agent's choice (game jam). It rewards the player for timing the surge in the denser levels.
- **Yes:** the surge countdown is in playing time. Agent's choice (game jam). A pause cannot waste the surge.
- **Yes:** five synthesized WAVs instead of the Arkanoid MP3s. Agent's choice (game jam). The sounds of a dodger are different, and the TOAD ROAD spec made the same call.
- **Yes:** the `M` key and the MUTE button come from the platform, as in every game with sound. Agent's choice (game jam).
- **Yes:** the SURGE touch button is the first action button in the touch layout. Agent's choice (game jam). It is the only action in this game, and the on-screen lane buttons stay as in spec 01.
- **No:** a multiplier on the cells or rows in this spec. The surge already gives the upside of a good run.
- **Yes:** the HUD replaces CELLS with SURGE, since the charge is the number a player acts on. Agent's choice (game jam). The score still includes cells.
- **Yes:** seed only; no schema change. `games`, `scores`, `submit_score` and the views are generic per `game_id`.

## Risks

| Risk                                                                    | Mitigation                                                                                                                        |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| The surge is too strong and turns runs into free passes                 | The charge needs 5 cells, the surge lasts 3 s, and a surge cannot be stacked; a criterion checks the charge rules.                |
| High speed (520 px/s, a row every 0.25 s) makes lane changes unreadable | The cap at 2.0× is a criterion; the lane change is instant, and the generator keeps the gap moving by at most one lane per row.   |
| Density 0.8 leaves very few lanes open                                  | The gap is never a block, so at least one lane is always open; a criterion checks density at level 8 and beyond.                  |
| A surge that ends on a block kills unfairly                             | Overlapping solid blocks are smashed during the surge, so no block can be overlapping when the surge ends; a criterion covers it. |
| WAV files are large or slow to load                                     | 22050 Hz mono, under 0.6 s and under 40 KB each; a failed load logs once and stays silent.                                        |
| Autoplay policy blocks audio                                            | The shared audio module creates the context on the first user gesture; no sound plays before it.                                  |
| Pause during a surge desynchronises the countdown                       | The countdown runs only while playing; a criterion checks pause and resume.                                                       |
| Space scrolls the page                                                  | Space is in `preventDefault` for this game only while it is playing, as the shared input allows.                                  |
| `shadowBlur` cost with a surging ship and many broken blocks            | Glow stays on the ship only; broken blocks are drawn without glow.                                                                |
| Score overflow with smash and level bonuses                             | The clamp to `MAX_SCORE` applies to every score change; a criterion checks it.                                                    |
| Cached game list does not show the new row until rebuild                | Not applicable in this spec: the seed is from spec 01.                                                                            |
| Scores forgeable until Auth                                             | Accepted in SPEC 07.                                                                                                              |

## What is **not** in this spec

- Stacking surges, surge charge above 5 and other power-ups.
- Extra lives, shields and any health system.
- Speed above 2.0×, boss rows and special rows.
- Background music.
- Multiplayer and VERSUS.
- Gamepad and mouse.
- Anti-cheat, server-verified scores and Auth.
- Schema changes, a plugin system beyond the registry, and redirects.
- Any change to `references/`.

Each one of those, if it lands, goes in its own spec.
