# SPEC GJ-void-runner-02 — VOID SIPHON: siphon variant

> **Status:** Draft
> **Depends on:** SPEC 06, SPEC 07, SPEC 08, SPEC 09, SPEC 11, SPEC GJ-void-runner-01
> **Date:** 2026-11-16
> **Objective:** Add VOID SIPHON, the VOID RUNNER sectors played with a heat-limited siphon field that absorbs enemy bullets and releases them as a radial burst, as a second catalog row with its own leaderboard at `/games/void-siphon/play`.

## Why this spec exists

VOID RUNNER (spec 01) is a weapons game: you collect capsules, swap guns and out-shoot the waves. This spec adds the original twist for the game jam. VOID SIPHON drops the weapon inventory and turns enemy bullets into your resource.

You hold `X` to raise a siphon field around the ship. While it is up you cannot fire and you move slowly, but every enemy bullet that touches the field is absorbed, scores, and charges the field. Let go and the charge erupts as a ring of bolts. The field heats while it is up, and it overheats at the limit: it drops, half the charge is lost, and the field is locked until it cools. Each absorb also feeds a CHAIN multiplier, up to ×8, that applies to every point. Better players therefore dive into denser patterns and score far more.

It is a separate catalog row, not a mode switch, for the same reason as SLIDE RUSH: `scores` and `submit_score` key only on `game_id`. A siphon run and a weapons run would otherwise share one leaderboard with numbers that cannot be compared.

The engine, waves, bosses, enemies, scaling, skins and sound bank of spec 01 are reused. The new code is the field, the heat, the chain, the burst, the coolant cell, a second factory and one registry entry.

## Scope

**In:**

- Seed migration `supabase/migrations/20261116120100_seed_void_siphon.sql` with the `games` row (`id = 'void-siphon'`, `title = 'VOID SIPHON'`, `category = 'SHOOTER'`, `cover = 'cover-void-siphon'`, `color = 'cyan'`, `plays = 0`, `sort_order = 9`).
- Siphon mode in the existing engine `lib/games/void-runner/` (`mode: "siphon"`) with:
  - The siphon field, held on `X`: absorbs shots, slows the ship and blocks firing.
  - Heat and overheat with a lockout.
  - Charge, up to 60, released as a VOID BURST.
  - The CHAIN multiplier, ×1 to ×8, applied to every point.
  - A PULSE level driven by the CHAIN.
  - COOLANT cells dropped by haulers instead of capsules.
  - Denser enemy fire.
- A second factory `createVoidSiphonGame` in `engine.ts`, typed with its own snapshot.
- Siphon snapshot: `score`, `lives`, `sector`, `wave`, `charge`, `chain`, `locked`, `state`.
- Canvas: the field ring, the heat arc, burst bolts, absorb sparks and the coolant cell.
- Skins: `field`, `fieldHot` and `burst` colours added to `classic`, `neon` and `retro`.
- Sound: three new WAVs (`absorb`, `burst`, `overheat`) in `public/games/void-runner/sounds/`.
- Registry entry `void-siphon`: HUD LIVES, SECTOR, CHARGE and CHAIN, controls legend, touch layout (D-pad plus FIRE and SIPHON), `sound: true`, aria label.
- New cover class `cover-void-siphon`, designed with `/frontend-design`.

**Out of scope (for future specs):**

- Changing the VOID RUNNER classic rules, leaderboard or cover.
- A mode switch inside one catalog row (see Why).
- Weapon capsules, the weapon swap, SPREAD and LANCE in siphon mode.
- Polarity or colour-coded bullets, reflecting bullets, and aiming the burst.
- Smart bombs, shields, extra lives and continues.
- Background music and volume sliders.
- Gamepad controls and mouse aiming.
- Anti-cheat, server-verified scores and Auth changes.
- Schema changes, a plugin system beyond the registry, redirects.
- Any change to `references/`.

## Data model

No schema change: `scores` and `submit_score` are generic per `game_id`. The row `void-siphon` gets its own leaderboard by its id.

Seed:

```sql
-- supabase/migrations/20261116120100_seed_void_siphon.sql
insert into public.games (id, title, short, long, category, cover, color, plays, sort_order)
values (
  'void-siphon',
  'VOID SIPHON',
  'Drink enemy fire, then burst it back.',
  'The VOID RUNNER sectors without the weapon capsules. Hold the siphon field to absorb enemy bullets and charge it, then let go to fire the charge back as a ring of bolts. The field overheats if you hold it too long, and every absorb builds a chain multiplier up to x8. Three lives, no continues.',
  'SHOOTER',
  'cover-void-siphon',
  'cyan',
  0,
  9
);
```

Types (additions to spec 01's `types.ts`):

```ts
// lib/games/void-runner/types.ts (additions)
export type VoidSiphonSnapshot = {
  score: number; // 0..9_999_999, clamped
  lives: number; // starts at 3
  sector: number; // 1, 2, 3…
  wave: number; // 1..5, 6 = boss fight
  charge: number; // 0..SIPHON.chargeMax
  chain: number; // multiplier, 1..SIPHON.maxMult
  locked: boolean; // true from an overheat until heat is back to 0
  state: VoidRunnerState;
};

export type Coolant = { x: number; y: number }; // dropped by a HAULER in siphon mode

// lib/games/void-runner/engine.ts
export function createVoidSiphonGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks<VoidSiphonSnapshot>,
  options: GameOptions,
): GameEngine; // same internal factory as createVoidRunnerGame, with mode "siphon"
```

The internal factory takes the mode and a snapshot builder. `createVoidRunnerGame` keeps its spec 01 signature and behaviour. Neither factory casts its callbacks.

Constants (added to `constants.ts`):

```ts
export const SIPHON = {
  radius: 56, // px, field ring around the ship center
  speedMult: 0.55, // ship speed while the field is up (165 px/s)
  heatRise: 40, // heat per s while the field is up: 0 → 100 in 2.5 s
  heatCool: 25, // heat per s while it is down: 100 → 0 in 4.0 s
  heatMax: 100,
  chargeMax: 60,
  burstMin: 10, // minimum charge for a burst on release
  burst: { speed: 640, damage: 2, r: 5 }, // px/s, HP, px
  absorbPoints: 10, // × multiplier
  chainStep: 20, // absorbs per +1 multiplier
  maxMult: 8,
  chainTimeout: 3.0, // s without an absorb resets the chain
  fireBoost: 1.5, // enemy and boss fire intervals are also divided by this
  coolantPoints: 500, // × multiplier
  coolant: { r: 12, speed: 90 }, // px, px/s downward
  sparks: 4, // particles per absorbed shot
};
export const SOUND_THROTTLE_ABSORB = 0.05; // s
```

Derived values (computed, not stored):

```ts
// mult(chain) = min(SIPHON.maxMult, 1 + floor(chain / SIPHON.chainStep))
//   chain 0..19 → ×1, 20..39 → ×2, … 140 and beyond → ×8
// pulseLevel(mult) = mult <= 2 ? 1 : mult <= 4 ? 2 : 3
// burst angles: n = charge bolts at -90° + k × 360° / n (k = 0..n-1); -90° is straight up
// fire interval in siphon = base interval / (fireMult(sector) × SIPHON.fireBoost)
```

Skin additions (`skins.ts`, on top of spec 01's `VoidRunnerSkin`):

| Key      | classic                 | neon      | retro     |
| -------- | ----------------------- | --------- | --------- |
| field    | `#00f5ff` (`--cyan`)    | `#00f5ff` | `#9bff6a` |
| fieldHot | `#ff006e` (`--magenta`) | `#ff2bd6` | `#ff6a4d` |
| burst    | `#ffcf3a` (`--gold`)    | `#fff200` | `#e8ff7a` |

Sound additions (`sounds.ts`). They are also 22050 Hz mono 16-bit PCM WAV, each under 0.6 s and under 30 KB, generated by the same kind of one-off script:

```ts
export const SIPHON_SOUND_URLS = {
  absorb: "/games/void-runner/sounds/absorb.wav", // 0.06 s sine tick at 1500 Hz
  burst: "/games/void-runner/sounds/burst.wav", // 0.4 s sweep 200 → 1600 Hz mixed with a noise tail
  overheat: "/games/void-runner/sounds/overheat.wav", // 0.6 s 110 Hz square with an 8 Hz tremolo
} as const;
```

In siphon mode the sound bank is created with `{ ...SOUND_URLS, ...SIPHON_SOUND_URLS }`. The COOLANT pickup reuses `pickup.wav`.

Conventions (siphon mode; spec 01 rules hold unless listed here):

- **Field up.** The field is up only while all of these are true:
  - `X` is held;
  - the state is `playing`;
  - the ship is present (not in `respawn`);
  - `locked` is false.

  While up:
  - `Space` fires nothing;
  - the ship moves at `SHIP.speed × SIPHON.speedMult`;
  - heat rises by `heatRise × dt`.

  While down, heat falls by `heatCool × dt`. Heat is clamped to `0..heatMax`.

- **Absorb.** While the field is up, any enemy shot whose swept path comes within `SIPHON.radius + shot.r` of the ship center is absorbed:
  - It is removed and spawns `SIPHON.sparks` sparks in `skin.field`.
  - `chain` goes up by 1 and the chain timer resets to `chainTimeout`.
  - `charge` goes up by 1, up to `chargeMax`.
  - It adds `absorbPoints × mult(chain)`, using the multiplier after the increment.
  - It plays `absorb.wav`, throttled to `SOUND_THROTTLE_ABSORB`.

  The ring encloses the 5 px hit circle, so shots cannot hit the ship while the field is up. Enemy and boss bodies still kill.

- **Burst.** Releasing `X` while the field is up (a real key-up, not a pause or a respawn) drops the field.
  - If `charge >= burstMin`, a VOID BURST fires: `charge` bolts at the burst angles, from the ship center, at `burst.speed`. Each has `burst.damage` and radius `burst.r` and does not pierce. Then `charge` becomes 0 and `burst.wav` plays.
  - If `charge < burstMin`, nothing fires and the charge is kept.

  Burst bolts use the same swept test, caps and scoring as normal bolts.

- **Overheat.** When heat reaches `heatMax`:
  - The field drops with no burst.
  - `charge` becomes `floor(charge / 2)`.
  - `locked` becomes true and `overheat.wav` plays.

  While `locked`, holding `X` does nothing. `locked` becomes false when heat cools back to 0. Pressing `X` again is then needed to raise the field; a key held through the lockout does not raise it.

- **Chain.**
  - The chain timer counts down in playing time only. At 0, `chain` resets to 0, which is ×1.
  - A hit on the ship resets `chain` to 0, `charge` to 0 and heat to 0, and clears `locked`.
  - `mult(chain)` multiplies every point added in siphon mode: kills, perfect waves, bosses, absorbs and coolant.
- **Weapon.** The weapon is always PULSE, at level `pulseLevel(mult(chain))`. No capsule ever spawns, and `X` never swaps.
- **Haulers and coolant.** A destroyed HAULER drops one COOLANT cell instead of a capsule. Collecting it sets heat to 0, clears `locked`, adds `coolantPoints × mult(chain)` and plays `pickup.wav`. It falls at `SIPHON.coolant.speed` and is removed below the field.
- **Enemy fire.** Enemy fire is denser. Every enemy and boss fire interval is also divided by `fireBoost`, and DRIFTERs fire their aimed shot from sector 1 (not from sector 3). Movement, HP and shot speeds follow spec 01's scaling unchanged.
- **Pause.** Pausing calls `input.reset()`, which drops the field with no burst and keeps the charge. The field rises again on the next `X` keydown after resume. Heat, the chain timer and the lockout are frozen while paused.
- **Callbacks.** `onChange` fires only when `score`, `lives`, `sector`, `wave`, `charge`, `chain` (the multiplier, not the raw count), `locked` or `state` changes. Heat is never in the snapshot.
- **Drawing.** In siphon mode the canvas also draws:
  - The field ring while it is up. It is 2 px at `SIPHON.radius`, in `skin.field`, with alpha pulsing between 0.5 and 0.9 at 4 Hz.
  - The heat arc whenever heat > 0. It is 3 px at radius 22 around the ship, sweeping `heat / heatMax × 360°` from straight up. It is drawn in `skin.field`, or in `skin.fieldHot` when heat > 70 or while `locked`.
  - Burst bolts in `skin.burst`.
  - COOLANT cells as a hexagon in `skin.field` with a `skin.shipCore` dot, with glow when `skin.glow` is true.

  It draws no CHARGE, CHAIN, heat or LOCK text.

Edge cases:

- A shot that reaches the ring and the hit circle in the same frame is absorbed, not a hit.
- Releasing `X` on the same frame as an overheat counts as the overheat: no burst, and the charge is halved.
- A hit by an enemy body while the field is up drops the field with no burst, and the charge goes to 0.
- The burst bolt count equals the charge at release. The maximum is 60, so a burst never exceeds the bolt cap (120) by itself. If bolts are already on screen, the oldest are removed first, as in spec 01.
- Absorbing at full charge still scores and grows the chain. The charge stays at 60.
- `restart()` resets charge, chain, heat and `locked`, as well as the spec 01 state.

## Implementation plan

1. **Seed migration.** Write `20261116120100_seed_void_siphon.sql`, run `npm run db:push`, then `npm run db:types`.
   - Check with Supabase MCP `execute_sql` that `games` has `void-runner` and `void-siphon`, and that `scores` has no `void-siphon` rows.
   - Add `'void-siphon'` and the migration version to `supabase/checks/verify-prod.sql`, and update both counts.
   - Restart the dev server if the cached list does not show the game.
   - Check: `/games` lists VOID SIPHON under SHOOTER, and `/games/void-siphon/play` shows "NOT PLAYABLE YET".
2. **Cover.** Add `cover-void-siphon` to `app/globals.css`, designed with `/frontend-design`. It reuses the `cover-void` composition with the ship in a cyan ring, and magenta bullet dots curving into the ring. It uses only palette tokens. Check: the card on `/games`, the detail page and the home rail show the cover without a broken layout.
3. **Sound assets.** Generate `absorb.wav`, `burst.wav` and `overheat.wav` with a one-off script in the scratchpad and copy them to `public/games/void-runner/sounds/`. Check: each returns 200 on the dev server and is under 30 KB.
4. **Types, constants, skins and sound map.** Add `VoidSiphonSnapshot`, `Coolant`, `SIPHON`, `SOUND_THROTTLE_ABSORB`, the three skin keys in all three skins, and `SIPHON_SOUND_URLS`. Check: `npm run lint` passes.
5. **Siphon logic.** In `engine.ts`, add the siphon branch:
   - field state, heat and lockout;
   - absorb with the swept ring test, then chain, multiplier and charge;
   - burst on key-up, overheat, coolant, the PULSE level from the multiplier, and fire boost;
   - the multiplier on every `addScore`, and the siphon snapshot.

   Refactor the factory into an internal `createGame(mode, …)` and export `createVoidSiphonGame`. Check: `npm run build` passes, and `/games/void-runner/play` behaves exactly as in spec 01.

6. **Siphon drawing.** Draw the field ring, the heat arc, burst bolts, absorb sparks and coolant cells with the active skin. Check: switching skins while paused recolors the ring and the arc.
7. **Registry entry.** Add `void-siphon` to `lib/games/registry.ts`:
   - `load` imports the same engine and returns `createVoidSiphonGame`.
   - `initialSnapshot`: `score 0`, `lives 3`, `sector 1`, `wave 1`, `charge 0`, `chain 1`, `locked false`, `state "playing"`.
   - `hud` returns four stats:
     - LIVES: `♥` repeated, or `—` at 0. Magenta.
     - SECTOR: `01-3` / `01-B`, as in spec 01. Yellow.
     - CHARGE: `24/60` in cyan, or `LOCK` in magenta while `locked`.
     - CHAIN: `x3`. Green.
   - `controls`: `← ↑ ↓ →` and `W A S D` "Move", `Space` "Fire (hold)", `X` "Siphon (hold, release to burst)".
   - `ariaLabel: "Void Siphon game"` and `sound: true`.
   - `touch: { dpad: ["up", "down", "left", "right"], buttons: [{ label: "FIRE", code: "Space", variant: "magenta" }, { label: "SIPHON", code: "KeyX", variant: "cyan" }] }`, with no `repeat`.
   - Check: `/games/void-siphon/play` runs with no console errors, and `/games/void-runner/play` is unchanged.
8. **HUD, touch and cover polish with `/frontend-design`.** Check the four HUD stats, MUTE, SKIN and the legend at 375 px and 1440 px, and the FIRE and SIPHON buttons on a 375×812 touch emulation. Adjust only what overflows or overlaps.
9. **Verification pass.** Run `npm run lint` and `npm run build`, then every acceptance criterion below, including the spec 01 regression.

Before writing code, read `node_modules/next/dist/docs/` for Client Components, dynamic `import()` and lazy loading, static files in `public/`, and `'use cache'` / `cacheTag` for the cached game list.

## Acceptance criteria

- [ ] `npm run lint` finishes with no errors.
- [ ] `npm run build` finishes with no errors.
- [ ] `supabase/migrations/` contains `20261116120100_seed_void_siphon.sql`, `npm run db:types` shows no diff, and `games` has the `void-siphon` row with 0 scores.
- [ ] `supabase/checks/verify-prod.sql` lists `void-siphon` in the seeded games and the new migration version.
- [ ] `/games` (SHOOTER filter included) and `/games/void-siphon` show the title VOID SIPHON and its description. The home "GAMES AVAILABLE NOW" rail lists it with the `cover-void-siphon` cover.
- [ ] `/games/void-siphon/play` runs the real engine with the listed controls.
- [ ] HUD values (SCORE, LIVES, SECTOR, CHARGE, CHAIN) always match the engine.
- [ ] A new run and PLAY AGAIN start with score 0, 3 lives, SECTOR `01-1`, CHARGE `0/60`, CHAIN `x1` and the "SECTOR 1" banner.
- [ ] Field up:
  - [ ] Holding `X` raises the field ring around the ship.
  - [ ] The ship moves at 165 px/s.
  - [ ] Holding `Space` fires nothing.
  - [ ] Releasing `X` restores 300 px/s and normal fire.
- [ ] Absorbing:
  - [ ] An enemy shot that touches the ring disappears and adds 1 to CHARGE.
  - [ ] It adds `10 × multiplier` to the score.
  - [ ] It plays `absorb.wav` when unmuted.
- [ ] With the field up, no enemy shot can cost a life. An enemy body or the boss still can.
- [ ] Chain:
  - [ ] The first absorb of a run adds 10.
  - [ ] The 20th consecutive absorb makes CHAIN `x2` and adds 20.
  - [ ] CHAIN never exceeds `x8`.
  - [ ] Three seconds of playing time without an absorb reset CHAIN to `x1`.
- [ ] The multiplier applies to every point. With CHAIN `x2` in sector 1, a DRIFTER kill adds 200 and a boss kill adds 10,000.
- [ ] Burst:
  - [ ] Releasing `X` with CHARGE `24/60` fires 24 bolts evenly spaced 15° apart, the first straight up.
  - [ ] CHARGE goes to `0/60` and `burst.wav` plays.
  - [ ] Releasing with CHARGE below 10 fires nothing and keeps the charge.
- [ ] Overheat:
  - [ ] Holding `X` for 2.5 s from cold overheats.
  - [ ] The field drops, CHARGE shows `LOCK` in magenta, the charge is halved (rounded down), and no burst fires.
  - [ ] `X` does nothing until 4.0 s later, when the HUD shows the charge again.
- [ ] Holding `X` through the whole lockout does not raise the field when it ends; a new `X` press does.
- [ ] The heat arc around the ship grows while the field is up, shrinks while it is down, and turns to the hot colour above 70% and while locked.
- [ ] The weapon is always PULSE. Its volley has 1 bolt at `x1`–`x2`, 2 bolts at `x3`–`x4` and 3 bolts at `x5`–`x8`.
- [ ] No weapon capsule ever appears. A destroyed HAULER drops a COOLANT cell, which:
  - [ ] sets heat to 0 and lifts a `LOCK`;
  - [ ] adds `500 × multiplier`;
  - [ ] plays `pickup.wav`.
- [ ] Enemy fire is denser than in VOID RUNNER at the same sector. DRIFTERs fire from sector 1.
- [ ] A hit removes one life and resets CHAIN to `x1`, CHARGE to `0/60` and the heat. The respawn follows the spec 01 rules (1.0 s, shots cleared, 2.0 s invulnerable).
- [ ] Pause:
  - [ ] Pausing with the field up drops it with no burst and keeps the charge.
  - [ ] After resume the field rises only on a new `X` press.
  - [ ] Heat, the chain timer and the lockout do not change while paused.
- [ ] Waves, bosses, banners, sector scaling and the boss rotation (MAW, LOOM, CROWN) work as in spec 01.
- [ ] Losing the last life opens the GAME OVER modal with the same score as the HUD, and `onGameOver` is called once. END opens it with the current score.
- [ ] The score never exceeds 9,999,999 in the HUD or in the saved row.
- [ ] The canvas draws no CHARGE, CHAIN, heat, LOCK, SCORE or GAME OVER text. Only the "SECTOR N" and "WARNING" banners appear as text.
- [ ] Skins:
  - [ ] CLASSIC, NEON and RETRO each recolor the field ring, the heat arc, the burst bolts and the coolant cell live.
  - [ ] The choice is stored as `av:skin:void-siphon`, separate from `av:skin:void-runner`.
- [ ] Sound:
  - [ ] It is muted by default, and MUTE and `M` toggle it.
  - [ ] Unmuted, `absorb`, `burst` and `overheat` play on their events, plus the spec 01 sounds.
  - [ ] No 404 for the three new WAVs.
  - [ ] No audio plays after leaving the page.
- [ ] Typing initials in the modal (including `X`, `W A S D` and `M`) does not affect the game.
- [ ] SAVE SCORE shows `SAVING…` then `SAVED — RANK #N`. The score appears in the Hall of Fame tab for VOID SIPHON, and not under VOID RUNNER, and the game's plays go up by 1.
- [ ] Touch emulation at 375×812:
  - [ ] The D-pad shows four arrows plus FIRE (magenta) and SIPHON (cyan).
  - [ ] Holding SIPHON raises the field, and lifting the finger releases the burst.
  - [ ] The page does not scroll, and the HUD with four stats does not overflow.
- [ ] `/games/void-runner/play` still meets every spec 01 criterion: capsules, the `X` swap, no field and no CHARGE or CHAIN stats.
- [ ] Asteroids, Tetris, Arkanoid, Snake and TOAD ROAD still play and save exactly as before.
- [ ] No secret or service-role key is used.

## Decisions

- **Yes:** a siphon field with heat as the variant's twist. Agent's choice (game jam). It flips the genre's main threat, enemy bullets, into the resource. Players have to approach danger to score, and that is the skill the leaderboard measures.
- **No:** polarity or two-colour absorption. Switching ship colour to absorb same-colour bullets is the signature of a known commercial shooter. One colourless, heat-limited field keeps the variant original. Agent's choice (game jam).
- **No:** a time-attack boss rush as the twist. It reuses only the bosses and changes the pacing, not the core verb. The siphon changes how every wave is played. Agent's choice (game jam).
- **Yes:** a separate catalog row, `void-siphon`. Scores key only on `game_id`, and siphon scores (with ×8 chains) are not comparable with weapon runs. Agent's choice (game jam).
- **No:** a mode switch inside `void-runner`. It would need a leaderboard split by mode, which the schema does not have, and it would hide the variant from the catalog. Agent's choice (game jam).
- **Yes:** `id = void-siphon`, title `VOID SIPHON`, `SHOOTER`, `cyan`, `sort_order = 9`. Cyan differs from VOID RUNNER (magenta) and ASTEROIDS (yellow) in the same category, and it is the field's colour. Agent's choice (game jam).
- **Yes:** `cover-void-siphon` as a new class, a variant of `cover-void` with the ring. Agent's choice (game jam).
- **Yes:** hold to raise and release to burst, on the same `X` key that swaps in spec 01. One key and one touch button cover the whole mechanic, and no new key is bound. Agent's choice (game jam).
- **Yes:** no firing and 0.55× speed while the field is up. Without a cost, players would hold the field forever between bursts. Agent's choice (game jam).
- **Yes:** heat 2.5 s to overheat and 4.0 s to cool, with the charge halved and a lockout. Overheating has a real price, and the cooldown is longer than the hold, so the field cannot be kept up most of the time. These are first values to tune in review. Agent's choice (game jam).
- **Yes:** a burst of one bolt per charge point, minimum 10 and maximum 60. The burst is readable (more absorbed means more bolts) and stays within the bolt cap. Agent's choice (game jam).
- **Yes:** a CHAIN multiplier from ×1 to ×8, +1 every 20 absorbs, reset after 3 s or on a hit. It applies to every point. A ceiling at ×8 keeps the clamp unreachable in practice while still rewarding long chains. Agent's choice (game jam).
- **Yes:** PULSE only, with its level from the multiplier. Firepower grows with skill instead of capsules, and the variant needs no inventory. Agent's choice (game jam).
- **Yes:** haulers drop COOLANT instead of capsules. Haulers stay a target worth chasing, and the field gets a recovery tool. Agent's choice (game jam).
- **Yes:** enemy fire 1.5× denser, and DRIFTERs firing from sector 1. Sector 1 of spec 01 has few bullets, and the siphon needs material from the first wave. Agent's choice (game jam).
- **Yes:** a second exported factory, `createVoidSiphonGame`, over a shared internal factory. Each registry entry stays typed with its own snapshot under `strict`, with no casts. Agent's choice (game jam).
- **Yes:** reuse spec 01's waves, bosses, scaling, skins and sound bank. One engine serves two rows, with no duplicated rules. Agent's choice (game jam).
- **Yes:** heat is not in the snapshot. It changes every frame, so the canvas arc shows it and `onChange` stays rare. Agent's choice (game jam).
- **Yes:** original names and art. No existing commercial game is recreated. Provided (game jam: keep names, art and mechanics original).
- **Yes:** seed only, with no schema change. Provided (game jam).

## Risks

| Risk                                                      | Mitigation                                                                                                                      |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| The field makes runs trivial                              | No fire and 0.55× speed while up, heat lockout with a halved charge, and bodies still kill; criteria check each cost.           |
| Too few bullets to absorb early on                        | `fireBoost` 1.5 and DRIFTERs firing from sector 1; criterion checks denser fire than VOID RUNNER at the same sector.            |
| Pause or respawn triggers a burst by mistake              | Only a real key-up while playing with the field up bursts; pause and respawn drop the field with no burst; criteria cover both. |
| A key held through the lockout raises the field instantly | The field needs a fresh `X` press after a lockout; covered by a criterion.                                                      |
| A 60-bolt burst plus normal fire exceeds the bolt cap     | The cap of 120 removes the oldest bolts first; a burst alone is at most 60.                                                     |
| Absorb sound spam                                         | `absorb.wav` throttled to once per 0.05 s.                                                                                      |
| `onChange` every frame from heat                          | Heat is not in the snapshot; CHAIN emits the multiplier, not the raw count.                                                     |
| Shared engine file grows hard to follow                   | Siphon code is isolated in its own update and draw helpers behind `mode`; the spec 01 path is criterion-checked unchanged.      |
| Classic and siphon leaderboards or skins mix              | Separate `game_id` values and `av:skin:void-runner` / `av:skin:void-siphon` keys; criteria check both.                          |
| Mechanic perceived as a copy of a polarity shooter        | One colourless field with heat, no colour-matched bullets and no polarity switch; recorded in Decisions.                        |
| Touch hold on SIPHON with simultaneous D-pad use          | `virtual-keys` sends key-down on press and key-up on release per button; touch criterion checks hold and release.               |
| Cover class clashes with another game                     | `cover-void-siphon` is checked against `globals.css` before writing.                                                            |
| Cached game list does not show the new row until rebuild  | Plan step 1 restarts the dev server; production needs a rebuild or `games` tag invalidation.                                    |
| Scores forgeable until Auth                               | Accepted in SPEC 07.                                                                                                            |

## What is **not** in this spec

- Changing VOID RUNNER (classic) rules, leaderboard or cover.
- A mode switch inside one catalog row.
- Weapon capsules, the weapon swap, SPREAD and LANCE in siphon mode.
- Polarity or colour-coded bullets, reflection, and aiming the burst.
- Smart bombs, shields, extra lives and continues.
- Background music and volume sliders.
- Gamepad controls and mouse aiming.
- Anti-cheat, server-verified scores and Auth changes.
- Schema changes, a plugin system beyond the registry, and redirects.
- Any change to `references/`.

Each one of those, if it lands, goes in its own spec.
