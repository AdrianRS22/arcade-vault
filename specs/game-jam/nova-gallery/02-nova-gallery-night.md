# SPEC GJ-nova-gallery-02 — NOVA NIGHT: lights-off variant

> **Status:** Draft
> **Depends on:** SPEC 06, SPEC 07, SPEC 08, SPEC 11, GJ-nova-gallery-01
> **Date:** 2026-11-19
> **Objective:** Add NOVA NIGHT, the NOVA GALLERY lanes played in the dark where only a spotlight around the crosshair reveals which targets are decoys, as a second catalog row with its own leaderboard at `/games/nova-gallery-night/play`.

## Why this spec exists

NOVA GALLERY (spec 01) tests aim and reload timing on a fully lit gallery: a decoy is visible from the moment it enters a lane. This variant changes what the player has to read. The gallery goes dark, every target outside the spotlight looks like the same dim outline, and decoys hide among them. The player must sweep the lanes with the spotlight, identify, then fire. A single flare per stage lights the whole gallery for a moment.

It reuses the spec 01 engine, rules, scoring and stage flow. The new code is a darkness mask, silhouette drawing, the flare, a stage-scaled spotlight, a lower quota curve and a registry entry.

It is a separate catalog row, not a mode switch, because `scores` and `submit_score` key only on `game_id`. A run in the dark and a lit run would otherwise share one leaderboard with numbers that cannot be compared. This follows the precedent of `slide-core-rush`.

## Scope

**In:**

- Seed migration `supabase/migrations/20261119120100_seed_nova_gallery_night.sql` with the `games` row (`id = 'nova-gallery-night'`, `title = 'NOVA NIGHT'`, `category = 'SHOOTER'`, `cover = 'cover-gallery-night'`, `color = 'cyan'`, `plays = 0`, `sort_order = 9`).
- Night mode in the existing engine `lib/games/nova-gallery/` (`mode: "night"`): darkness mask with a spotlight around the crosshair, silhouettes outside it, the flare (`F`), the spotlight radius and quota curves of this spec, and the unused-flare bonus.
- Night snapshot: the spec 01 fields plus `flares`.
- Registry entry `nova-gallery-night`: HUD LIVES, STAGE, HITS, AMMO and FLARE, the spec 01 controls plus `F`, touch layout with a FLARE button, aria label.
- New cover class `cover-gallery-night`, designed with `/frontend-design`.
- `supabase/checks/verify-prod.sql` updated with the new migration and seeded game.

**Out of scope (for future specs):**

- Changing the spec 01 rules, its leaderboard or its cover.
- A mode switch inside one catalog row (see Why).
- More than one flare per stage, flare pickups, a battery or a spotlight that drains.
- Targets that hide, dodge the light or shoot back.
- Sound and the shared audio module.
- Skins beyond what spec 01 shares through `lib/games/nova-gallery/skins.ts` (the night colours are added to that same skin type).
- Gamepad controls and anti-cheat or server-verified scores.
- Schema changes, a plugin system beyond the registry, redirects.
- Any change to `references/`.

## Data model

No schema change: `scores` and `submit_score` are generic per `game_id`. The row `nova-gallery-night` gets its own leaderboard by its id.

Seed:

```sql
-- supabase/migrations/20261119120100_seed_nova_gallery_night.sql
insert into public.games (id, title, short, long, category, cover, color, plays, sort_order)
values (
  'nova-gallery-night',
  'NOVA NIGHT',
  'The gallery goes dark: only your sight shows what to shoot.',
  'NOVA GALLERY with the lights off. Outside the spotlight around your crosshair every target looks the same, and decoys hide among them. Sweep the lanes, fire only at what you can see, and save your one flare per stage for when the lanes get crowded.',
  'SHOOTER',
  'cover-gallery-night',
  'cyan',
  0,
  9
);
```

Types (extends spec 01):

```ts
// lib/games/nova-gallery/types.ts (additions)
export type NovaNightSnapshot = NovaGallerySnapshot & {
  flares: number; // 0 or 1; refilled to 1 at every stage intro
};
// NovaOptions.mode === "night" makes the engine emit NovaNightSnapshot.
```

Constants (added to `constants.ts`):

```ts
export const NIGHT = {
  darkness: 0.92, // alpha of the mask outside the light
  edge: 24, // px, soft gradient at the spotlight rim
  silhouette: { color: "#4a4f70", alpha: 0.55, width: 2 }, // --ink-faint outline
  flareTime: 2.5, // s the whole field stays lit
  flareFade: 0.5, // s, the last part of flareTime fades the mask back in
  flaresPerStage: 1,
  unusedFlareBonus: 300, // multiplied by the stage, at stage clear
};
```

Night curves (added to `stages.ts`, `s` = stage number from 1):

```ts
// spotlightRadius(s) = max(80, 130 - 5 * (s - 1))   // px
// nightQuotaFor(s)   = 8 + 2 * (s - 1)
// speedFactor, spawnInterval, kindWeights and clearBonus are the spec 01 curves, unchanged.
```

Skin additions (`skins.ts`, the `classic` skin): `darkness: "#05050a"`, `silhouette: "#4a4f70"` (`--ink-faint`), `spotlightRim: "rgba(0, 245, 255, 0.35)"` (`--cyan`), `flareTint: "rgba(245, 255, 0, 0.08)"` (`--yellow`).

Rules:

- **Darkness.** In night mode, every frame draws the lit scene, then a mask of `NIGHT.darkness` alpha over the whole field with a transparent circle of `spotlightRadius(stage)` around the crosshair and an `edge` px soft rim. The mask is built on one offscreen canvas of the logical size, created once and reused.
- **Silhouettes.** Each target whose centre is farther than `spotlightRadius` from the crosshair is drawn above the mask as a plain circle outline of its own radius, in `NIGHT.silhouette`. Drones and decoys share radius 26, so they look the same in the dark. Comets (18) and nova stars (14) are smaller, so size is the only hint.
- **Spotlight rim.** A thin `spotlightRim` ring at the spotlight radius, with `shadowBlur` (the only extra glow in this mode).
- **Shots.** Unchanged from spec 01. A shot hits the target under the crosshair, which is always inside the light, so every hit target is seen at the moment it is shot. Decoys are still a life lost.
- **Flare.** `F` (`pressed()`) in `playing` with `flares > 0` sets `flares` to 0 and lights the whole field for `flareTime`: the mask alpha is 0 for the first `flareTime - flareFade` s, then rises back to `darkness` over `flareFade`. Silhouettes are not drawn while the mask alpha is below `darkness / 2`. A `flareTint` wash covers the field while lit. `F` with no flare, or outside `playing`, does nothing.
- **Flare refill.** Every `intro` (new stage or replayed stage) sets `flares = NIGHT.flaresPerStage` and cancels any active flare. Flares are not carried over.
- **Quota.** `quota = nightQuotaFor(stage)`.
- **Unused-flare bonus.** Meeting the quota with `flares === 1` adds `NIGHT.unusedFlareBonus × stage` on top of the spec 01 clear bonus.
- **Intro and clear.** During `intro` and `clear` the field is lit (no mask), so the "STAGE N" banner is readable and the player sees the empty lanes.
- Scoring, lives, streak multiplier, magazine, reload, clock, stage flow, pointer and the canvas no-HUD rule are the spec 01 rules, unchanged.

Conventions:

- Controls: spec 01 controls plus `F` Flare. `F` is not prevented (it does not scroll). `P`, `Esc` and `M` stay unbound.
- `onChange` fires when any `NovaNightSnapshot` field changes, so using a flare and the intro refill each emit once. The flare timer is not in the snapshot.
- Classic mode (`mode` absent or `"classic"`) draws no mask, no silhouettes and no rim, ignores `F` and emits no `flares` field. It is criterion-checked.
- Canvas draws no FLARE text. The flare state is visible only in the HUD and as the lit field.

Edge cases:

- Pausing during a flare freezes its timer; it resumes with the time left.
- A stage clear or lost stage during a flare ends the flare; the next intro refills it.
- The crosshair at the field edge clips the spotlight to the field; silhouettes still use the distance to the crosshair.
- `restart()` returns `flares` to 1, the stage to 1 and the spotlight to 130 px.
- `setSkin` while paused redraws the darkness mask with the new skin colours.

## Implementation plan

1. **Seed migration.** Write `20261119120100_seed_nova_gallery_night.sql`, run `npm run db:push`, then `npm run db:types`. Check with Supabase MCP `execute_sql`: `games` has `nova-gallery` and `nova-gallery-night`, and `scores` has no `nova-gallery-night` rows. In `supabase/checks/verify-prod.sql`, add `'20261119120100'` to `expected_migrations`, add `nova-gallery-night` to the seeded-games check, and raise both counts by one. Restart the dev server if the cached list does not show it. Check: `/games` lists NOVA NIGHT, and `/games/nova-gallery-night/play` shows "NOT PLAYABLE YET".
2. **Cover.** Add `.cover-gallery-night` to `app/globals.css`, designed with `/frontend-design`: near-black background (`#05050a`), three faint rails, grey circle outlines along them and one cyan spotlight disc revealing a cyan bullseye under a white crosshair, palette tokens only. Check: the card on `/games`, `/games/nova-gallery-night` and the home rail show the cover, distinct from `cover-gallery`.
3. **Night constants, curves, types and skin colours.** Add `NIGHT`, `spotlightRadius`, `nightQuotaFor`, `NovaNightSnapshot` and the skin additions. Check: `npm run lint` passes.
4. **Darkness mask and silhouettes.** In `engine.ts`, when `options.mode === "night"`, build the offscreen mask once, draw it after the scene in `playing`, then the silhouettes and the rim. Check: `npm run build` passes, and classic mode draws exactly as before.
5. **Flare, refill, quota and bonus.** Add the `F` handling, the flare timer with fade, the refill on `intro`, `nightQuotaFor` and the unused-flare bonus. Emit `flares` in the snapshot. Check: `npm run build` passes and classic mode emits no `flares`.
6. **Registry entry.** Add `nova-gallery-night` to `lib/games/registry.ts`. `load` imports the same engine and creates it with `{ ...options, mode: "night" }`. `initialSnapshot`: `score 0`, `lives 3`, `stage 1`, `hits 0`, `quota 8`, `ammo 6`, `reloading false`, `flares 1`, `state "intro"`. `hud` returns the spec 01 stats plus FLARE (`READY` when `flares > 0`, else `—`, yellow). `controls`: the spec 01 rows plus `F` Flare. `touch`: the spec 01 layout plus `{ label: "FLARE", code: "KeyF", variant: "cyan" }`. `ariaLabel: "Nova Night game"`. Check: `/games/nova-gallery-night/play` runs in the dark with no console errors, and `/games/nova-gallery/play` is unchanged.
7. **HUD and cover polish with `/frontend-design`.** Check the five HUD stats and three touch buttons at 375 px, and adjust only what looks broken. Check: no horizontal scroll and the FLARE stat does not shift the layout between `READY` and `—`.
8. **Verification pass.** Run `npm run lint` and `npm run build`, then every acceptance criterion below, including the spec 01 regression.

Before writing code, read `node_modules/next/dist/docs/` for Client Components and dynamic `import()`, and for `'use cache'` / `cacheTag` for the cached game list.

## Acceptance criteria

- [ ] `npm run lint` finishes with no errors.
- [ ] `npm run build` finishes with no errors.
- [ ] `supabase/migrations/` contains `20261119120100_seed_nova_gallery_night.sql`, `npm run db:types` shows no diff, and `games` has the `nova-gallery-night` row with 0 scores.
- [ ] `supabase/checks/verify-prod.sql` lists `20261119120100` in the expected migrations and `nova-gallery-night` in the seeded games, with both counts updated.
- [ ] `/games` and `/games/nova-gallery-night` show the title NOVA NIGHT and its description; the home "GAMES AVAILABLE NOW" rail lists it with the `cover-gallery-night` cover.
- [ ] `/games/nova-gallery-night/play` runs the real engine with the listed controls.
- [ ] HUD values (SCORE, LIVES, STAGE, HITS, AMMO, FLARE) always match the engine.
- [ ] The "STAGE N" intro is lit; when it ends the field goes dark except a 130 px spotlight around the crosshair at stage 1.
- [ ] Outside the spotlight, drones and decoys are drawn as identical grey outlines; inside it they show their spec 01 shapes and colours.
- [ ] The spotlight follows the crosshair from the keyboard and the mouse with no lag.
- [ ] The spotlight radius is 105 px at stage 6 and never below 80 px.
- [ ] The quota is 8 at stage 1 and 10 at stage 2.
- [ ] Pressing `F` with FLARE `READY` lights the whole field for 2.5 s (fading back over the last 0.5 s) and FLARE shows `—`; pressing `F` again does nothing until the next stage intro.
- [ ] Every stage intro, including a replayed stage after the clock runs out, shows FLARE `READY`.
- [ ] Clearing a stage with the flare unused adds `300 × stage` on top of `500 × stage + 25 × seconds left`; clearing it after using the flare adds only the spec 01 bonus.
- [ ] Points, the streak multiplier, decoy life loss, magazine, `R` reload, the 30 s clock bar and the stage flow behave as in spec 01.
- [ ] PAUSE, `P` and `Esc` freeze targets, the clock, the reload and an active flare; resuming continues the flare with its remaining time; switching tab pauses.
- [ ] Losing the last life opens the GAME OVER modal with the same score as the HUD; END opens it with the current score; PLAY AGAIN restarts with score 0, 3 lives, stage 1, AMMO `6/6` and FLARE `READY`.
- [ ] `onGameOver` is called once per game over.
- [ ] The score never exceeds 9,999,999 in the HUD or in the saved row.
- [ ] Typing initials in the GAME OVER modal (including `F`, `R`, `W`, `A`, `S`, `D` and Space) does not fire, reload, flare or move the crosshair.
- [ ] The canvas draws no SCORE, LIVES, HITS, AMMO, FLARE, GAME OVER or restart text.
- [ ] Leaving the play page and coming back runs a single loop (normal speed, no console errors) and the cursor is visible again.
- [ ] At 375 px wide the canvas fits the CRT with no horizontal scroll.
- [ ] Touch emulation at 375×812: the D-pad moves the crosshair and the spotlight, FIRE, RELOAD and FLARE each work once per tap, and the page does not scroll.
- [ ] SAVE SCORE shows `SAVING…` then `SAVED — RANK #N`; the score appears in the Hall of Fame tab for NOVA NIGHT and not under NOVA GALLERY; the game's plays go up by 1.
- [ ] `/games/nova-gallery/play` still meets every spec 01 criterion: no darkness, no silhouettes, no FLARE stat, `F` does nothing, quota 10 at stage 1.
- [ ] Asteroids, Tetris, Arkanoid, Snake and TOAD ROAD still play and save exactly as before (and any other game already in the registry at implementation time).
- [ ] No secret or service-role key is used.

## Decisions

- **Yes:** a lights-off variant as the distinct twist. The game jam asked for a second variant that is not a duplicate; darkness changes the skill from aim speed to identification. Agent's choice (game jam).
- **No:** a timed-score rush variant. `slide-core-rush` already uses that twist, and spec 01 already has a stage clock. Agent's choice (game jam).
- **No:** a ricochet or moving-lane variant. Ricochet changes the shooting model and needs projectiles; moving lanes only change difficulty, not what the player reads. Agent's choice (game jam).
- **Yes:** a separate catalog row `nova-gallery-night`. Scores key only on `game_id`, so one row would mix incomparable runs. Agent's choice (game jam), following `slide-core-rush`.
- **No:** a mode switch inside `nova-gallery`. It needs a leaderboard split by mode, which the schema does not have. Agent's choice (game jam).
- **Yes:** `id = nova-gallery-night`, title `NOVA NIGHT`, `SHOOTER`, `cyan`, `sort_order = 9`. Cyan differs from NOVA GALLERY (magenta) and ASTEROIDS (yellow) in the same category. Agent's choice (game jam).
- **No:** a title with "BLACKOUT". It would clash with the pending GRID BLACKOUT suggestion (see the naming note in the to-do file). Agent's choice (game jam).
- **Yes:** drones and decoys share one silhouette; size is the only hint for comets and nova stars. Identification is the variant's skill, and small fast targets stay worth hunting blind. Agent's choice (game jam).
- **Yes:** one flare per stage, not carried, with a `300 × stage` bonus if unused. It is a real choice every stage: safety now or points later. Agent's choice (game jam).
- **Yes:** `F` for the flare. It does not clash with `P`, `Esc`, `M` or the spec 01 keys. Agent's choice (game jam).
- **Yes:** lower quota (8 + 2 per stage) and a spotlight that shrinks to 80 px. The dark costs time, and the shrinking light keeps the run open-ended. First values to tune in review. Agent's choice (game jam).
- **Yes:** lit intro and clear phases. The banner stays readable and the player gets a look at the empty lanes. Agent's choice (game jam).
- **Yes:** reuse the spec 01 engine with `mode: "night"`. One engine, two rows; the classic path is criterion-checked. Agent's choice (game jam).
- **Yes:** one offscreen mask canvas, created once. Rebuilding a radial gradient path per frame is cheaper on one reused canvas than allocating per frame. Agent's choice (game jam).
- **No:** sound. Same reason as spec 01. Agent's choice (game jam).
- **Yes:** seed only; no schema change. Agent's choice (game jam).

## Risks

| Risk                                                         | Mitigation                                                                                                          |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Darkness mask costs frame rate                               | One reused offscreen canvas; one radial gradient per frame; glow only on the rim, crosshair and nova stars.         |
| Mask drawn at the wrong scale on high-DPI                    | The mask canvas uses the logical size and is drawn with the same DPR transform as the scene.                        |
| Night mode leaks into the classic row                        | All night code is gated on `options.mode === "night"`; the spec 01 regression criterion checks the classic row.     |
| Too hard to identify targets in time                         | Spotlight radius, quota and flare time are first values in `constants.ts` and `stages.ts`, tuned in review.         |
| Five HUD stats and three touch buttons wrap at 375 px        | Step 7 checks them with `/frontend-design`; values are short (`READY`, `—`, `6/6`).                                 |
| Flare keeps lighting the field while paused or after a clear | The flare timer runs on the loop `dt`; intro cancels it; criteria check pause and the refill.                       |
| Night and classic leaderboards mix                           | Two catalog rows with their own `game_id`; a criterion checks NOVA NIGHT scores do not appear under NOVA GALLERY.   |
| Seed timestamp collides with another jam spec                | `20261119120100` is past every existing and planned value; re-check `supabase/migrations/` before writing the file. |
| Cached game list does not show the new row until rebuild     | Step 1 restarts the dev server; production needs a rebuild or `games` tag invalidation.                             |
| Scores forgeable                                             | Accepted in SPEC 07; saving requires a signed-in player since SPEC 13.                                              |

## What is **not** in this spec

- Changing NOVA GALLERY (classic) rules, leaderboard or cover.
- A mode switch inside one catalog row.
- Extra flares, flare pickups, a draining spotlight, and targets that hide or shoot back.
- Sound and the shared audio module.
- Gamepad controls, anti-cheat and server-verified scores.
- Schema changes, a plugin system beyond the registry, and redirects.
- Any change to `references/`.

Each one of those, if it lands, goes in its own spec.
