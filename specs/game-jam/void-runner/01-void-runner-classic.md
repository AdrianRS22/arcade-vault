# SPEC GJ-void-runner-01 — VOID RUNNER: classic mode

> **Status:** Draft
> **Depends on:** SPEC 06, SPEC 07, SPEC 08, SPEC 09, SPEC 11
> **Date:** 2026-11-16
> **Objective:** Create VOID RUNNER, a vertical-scrolling shooter with enemy waves, three swappable weapons and rotating bosses, as a typed engine played at `/games/void-runner/play` with its own leaderboard.

## Why this spec exists

VOID RUNNER is a new game from the game jam. The pending entry in `references/game-suggestions-todo.md` says "vertical-scrolling shooter with waves, weapon swaps and bosses". It has no reference code, so the engine is written from the rules in this spec. Its name, ships, enemies, bosses and sounds are all original.

It is the second SHOOTER after ASTEROIDS, and it is the platform's first game with these four things:

- A scrolling field. The starfield scrolls down, so the ship seems to fly up.
- A weapon inventory with a swap key.
- Scripted waves.
- Bosses with HP phases.

All of it fits the registry from SPEC 08 as one engine, one entry and one seed row. Sound reuses `lib/games/shared/audio.ts` from SPEC 09. The touch layout follows SPEC 11. Every entity is drawn with canvas paths and no images, so the `classic`, `neon` and `retro` skins can restyle the whole game.

The second spec, `02-void-runner-siphon.md`, is a separate variant (VOID SIPHON) with its own catalog row, because scores are keyed by `game_id` only. This spec designs the engine so a `mode` option can switch the variant on without touching the classic rules.

## Scope

**In:**

- Seed migration `supabase/migrations/20261116120000_seed_void_runner.sql` with the `games` row (`id = 'void-runner'`, `title = 'VOID RUNNER'`, `category = 'SHOOTER'`, `cover = 'cover-void'`, `color = 'magenta'`, `plays = 0`, `sort_order = 8`).
- Typed engine in `lib/games/void-runner/` (no React, no globals) with:
  - Ship and movement: 8-way movement, held fire and 3 lives with respawn invulnerability.
  - Weapons: PULSE, SPREAD and LANCE, each at levels 1–3, with capsules and the `X` swap.
  - Enemies: 4 types (DRIFTER, STINGER, WARDEN, HAULER).
  - Waves and bosses: 8 wave templates, 5 waves per sector, and 3 rotating bosses (MAW, LOOM, CROWN) with three HP phases each.
  - Difficulty and scoring: a per-sector difficulty ramp and the scoring below.
- Parallax starfield, explosions and hit flashes, plus the "SECTOR N" and "WARNING" banners on the canvas.
- Skins in `lib/games/void-runner/skins.ts`: `classic` (the default), `neon` and `retro`, with `setSkin` live swap.
- Sound: seven synthesized WAVs in `public/games/void-runner/sounds/`, played through `createSoundBank`, with `sound: true` (MUTE and `M` come from the platform).
- Registry entry: HUD LIVES, SECTOR and WEAPON, controls legend, touch layout (D-pad plus FIRE and SWAP), aria label.
- New cover class `cover-void`, designed with `/frontend-design`.

**Out of scope (for future specs):**

- The siphon variant and its catalog row (`02-void-runner-siphon.md`).
- Smart bombs, shields, options or drones, extra lives and continues.
- Horizontal scrolling, terrain and ground targets.
- A final boss or a win state. The run is open-ended.
- Background music and volume sliders.
- Image sprites or any asset copied from `references/`.
- Gamepad controls, mouse aiming and auto-fire settings.
- Anti-cheat, server-verified scores and Auth changes.
- Schema changes, a plugin system beyond the registry, redirects.
- Any change to `references/`.

## Data model

No schema change: `scores` and `submit_score` are generic per `game_id`.

Seed:

```sql
-- supabase/migrations/20261116120000_seed_void_runner.sql
insert into public.games (id, title, short, long, category, cover, color, plays, sort_order)
values (
  'void-runner',
  'VOID RUNNER',
  'Blast through enemy waves, swap weapons, topple the bosses.',
  'Fly up through the void and shoot down wave after wave. Haulers drop weapon capsules: switch between PULSE, SPREAD and LANCE and level each one up. Every fifth wave a boss arrives, and every sector after it hits harder and pays more. Three lives, no continues.',
  'SHOOTER',
  'cover-void',
  'magenta',
  0,
  8
);
```

Types:

```ts
// lib/games/void-runner/types.ts
export type VoidRunnerState = "playing" | "respawn" | "gameover";
export type VoidRunnerMode = "classic" | "siphon"; // "siphon" is used by spec 02 only
export type WeaponId = "pulse" | "spread" | "lance";
export type EnemyKind = "drifter" | "stinger" | "warden" | "hauler";
export type BossKind = "maw" | "loom" | "crown";

export type VoidRunnerSnapshot = {
  score: number; // 0..9_999_999, clamped
  lives: number; // starts at 3
  sector: number; // 1, 2, 3…
  wave: number; // 1..5, 6 = boss fight
  weapon: WeaponId; // active weapon
  weaponLevel: number; // 1..3, level of the active weapon
  state: VoidRunnerState;
};

export type VoidRunnerOptions = GameOptions & { mode?: VoidRunnerMode }; // default "classic"

export function createVoidRunnerGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks<VoidRunnerSnapshot>,
  options: VoidRunnerOptions,
): GameEngine; // pause, resume, end, restart, destroy, skins, setSkin
```

Entities (also in `types.ts`):

```ts
export type Bolt = {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  damage: number;
  weapon: WeaponId;
  hit: Set<number>;
}; // px/py = previous position, for the swept test; hit = enemy ids a LANCE bolt already damaged
export type Shot = {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  r: number;
}; // enemy shot
export type Enemy = {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  hp: number;
  t: number;
  phase: "enter" | "hold" | "dive" | "exit";
  vx: number;
  vy: number;
  fireIn: number;
  flash: number;
  wave: number | null;
}; // wave = null for CROWN spawns
export type Boss = {
  kind: BossKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  t: number;
  entering: boolean;
  fireIn: number[];
  angle: number;
  flash: number;
};
export type Capsule = { x: number; y: number; weapon: WeaponId };
export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
};
```

Files in `lib/games/void-runner/`:

- `types.ts`: the types above.
- `constants.ts`: values below.
- `weapons.ts`: `WEAPONS` table and `fireWeapon(id, level, x, y) → Bolt[]` (pure).
- `enemies.ts`: `ENEMIES` table and `updateEnemy(enemy, dt, ctx)` per kind (pure movement and fire timers; it returns the shots to add).
- `waves.ts`: `WAVES` (the 8 templates as spawn lists), `waveTemplate(sector, wave)` and the sector scaling functions.
- `bosses.ts`: `BOSSES` table, `bossFor(sector)`, `bossHp(sector)` and the per-phase fire patterns.
- `skins.ts`: `SKINS: Record<SkinId, VoidRunnerSkin>` with `classic`, `neon` and `retro`.
- `sounds.ts`: `SOUND_URLS`.
- `engine.ts`: world state, update, collisions, scoring, loop, draw and `createVoidRunnerGame`.

Constants (`constants.ts`):

```ts
export const W = 800;
export const H = 600;
export const MAX_DT = 0.05; // s, platform cap
export const MAX_SCORE = 9_999_999;

export const SHIP = {
  w: 28,
  h: 32, // px, drawn size
  hitR: 5, // px, hit circle at the ship center (small on purpose, genre standard)
  bodyR: 12, // px, radius used against enemy bodies
  speed: 300, // px/s; diagonals are normalized
  minX: 20,
  maxX: 780,
  minY: 120,
  maxY: 572, // px, ship center bounds
  startX: 400,
  startY: 530,
};
export const START_LIVES = 3;
export const RESPAWN_DELAY = 1.0; // s, explosion before the ship comes back (or before GAME OVER)
export const INVULN_TIME = 2.0; // s, blinking after respawn
export const BLINK = 0.1; // s, blink half-period

export const STARS = {
  far: { count: 40, speed: 40, size: 1 },
  mid: { count: 30, speed: 90, size: 2 },
  near: { count: 16, speed: 160, size: 2 },
}; // px/s downward, wrap at the bottom

export const WAVES_PER_SECTOR = 5;
export const WAVE_GAP = 1.0; // s between the end of one wave and the next spawn
export const SECTOR_BANNER = 1.5; // s, "SECTOR N" before wave 1
export const BOSS_WARNING = 1.5; // s, "WARNING" before the boss enters
export const BOSS_DEATH = 1.2; // s, boss explosion before the next sector banner

export const CAPSULE = { r: 12, speed: 90 }; // px, px/s downward
export const ENEMY_SHOT = { speed: 220, r: 5 }; // base px/s, px
export const BOSS_HIT_R = 44; // px, bosses take hits and kill on contact inside this radius
export const ESCAPE = { top: -80, bottom: H + 40, left: -60, right: W + 60 }; // px, an enemy past these has escaped
export const SPAWN_Y = -30; // px

export const CAPS = { bolts: 120, shots: 300, particles: 400, enemies: 40 }; // oldest dropped first
export const PARTICLES = {
  enemy: 14,
  boss: 40,
  ship: 24,
  life: 0.5,
  speed: 160,
}; // count, s, px/s
export const HIT_FLASH = 0.05; // s, white flash on a damaged enemy or boss

export const POINTS = {
  drifter: 100,
  stinger: 150,
  warden: 300,
  hauler: 250, // × sector
  perfectWave: 500, // × sector, every enemy of the wave destroyed
  boss: 5_000, // × sector
  capsule: 200, // new weapon or level up
  capsuleMaxed: 1_000, // weapon already at level 3
};

export const SOUND_THROTTLE = { shot: 0.1, other: 0.06 }; // s, minimum gap between two plays of one sound
```

Weapons (`weapons.ts`). All bolts travel up. Angles are measured from straight up, and negative means left.

| Weapon | Level | Bolts                                  | Cooldown | Speed    | Damage | Pierce |
| ------ | ----- | -------------------------------------- | -------- | -------- | ------ | ------ |
| PULSE  | 1     | 1 at x                                 | 0.12 s   | 720 px/s | 1      | no     |
| PULSE  | 2     | 2 at x ± 8                             | 0.11 s   | 720 px/s | 1      | no     |
| PULSE  | 3     | 3: x at 0°, x ± 8 at ±6°               | 0.10 s   | 720 px/s | 1      | no     |
| SPREAD | 1     | 3 at −12°, 0°, 12°                     | 0.20 s   | 600 px/s | 1      | no     |
| SPREAD | 2     | 5 at −20°, −10°, 0°, 10°, 20°          | 0.20 s   | 600 px/s | 1      | no     |
| SPREAD | 3     | 7 at −27°, −18°, −9°, 0°, 9°, 18°, 27° | 0.20 s   | 600 px/s | 1      | no     |
| LANCE  | 1     | 1 at x, drawn 6 × 28 px                | 0.32 s   | 900 px/s | 3      | yes    |
| LANCE  | 2     | 1 at x, drawn 6 × 28 px                | 0.27 s   | 900 px/s | 4      | yes    |
| LANCE  | 3     | 1 at x, drawn 8 × 32 px                | 0.22 s   | 900 px/s | 5      | yes    |

Bolts have a 4 px hit radius (LANCE 5 px). A piercing bolt damages each enemy once and keeps flying. Against a boss it deals its damage once and is removed.

Enemies (`enemies.ts`). Speeds and fire intervals are base values, scaled per sector (see below).

| Kind    | HP  | Radius | Movement                                                                                                                   | Fire                                                                      |
| ------- | --- | ------ | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| DRIFTER | 1   | 14 px  | Down at 110 px/s, x = spawn x + 60 · sin(2π · t / 2.4)                                                                     | From sector 3: 1 aimed shot every 3.0 s                                   |
| STINGER | 2   | 13 px  | Down at 160 px/s to y = 180, then locks the direction to the ship's position at that moment and dives along it at 340 px/s | Never                                                                     |
| WARDEN  | 6   | 20 px  | Down at 90 px/s to its hold y, holds 4.0 s, then exits down at 140 px/s                                                    | While holding: a 3-shot fan aimed at the ship (−10°, 0°, 10°) every 1.4 s |
| HAULER  | 4   | 18 px  | Crosses horizontally at its row y at 120 px/s, from the side named in the template                                         | 1 aimed shot every 2.0 s                                                  |

A destroyed HAULER always drops one capsule. If it escapes, it drops nothing. The capsule weapon is drawn at random, and weapons the player does not own yet weigh 2 against 1 for owned ones.

Wave templates (`waves.ts`). Each entry spawns enemies at `SPAWN_Y` unless it is a HAULER. Delays are in seconds from the wave start.

| Template | Spawns                                                                                                                                |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| W1       | 8 DRIFTER in two columns at x = 260 and 540, one pair every 0.4 s                                                                     |
| W2       | 6 STINGER at x = 120, 240, 360, 440, 560, 680, one every 0.5 s                                                                        |
| W3       | 2 WARDEN at x = 240 and 560 (hold y = 140) at 0 s; 6 DRIFTER in a V at x = 400, 360, 440, 320, 480, 280, one every 0.3 s from 1.0 s   |
| W4       | 1 HAULER left → right at y = 110 at 0 s; 8 DRIFTER at x = 120 + 80k (k = 0..7), all at 0.5 s                                          |
| W5       | 10 DRIFTER at x = 80 + 70k (k = 0..9), one every 0.25 s; 3 STINGER at x = 200, 400, 600 at 3.0 s                                      |
| W6       | 3 WARDEN at x = 200, 400, 600 (hold y = 120, 170, 120), one every 0.6 s                                                               |
| W7       | 1 HAULER right → left at y = 140 at 0 s; 6 STINGER in pairs at x = 300 / 500, one pair every 0.8 s from 0.5 s                         |
| W8       | 12 DRIFTER in two V formations centered at x = 260 and 540, one pair every 0.3 s; 2 WARDEN at x = 160 and 640 (hold y = 150) at 2.0 s |

```ts
// template index for wave `wave` (1..5) of sector `sector` (1, 2, …)
// waveTemplate(sector, wave) = WAVES[((sector - 1) * WAVES_PER_SECTOR + (wave - 1)) % WAVES.length]
//   sector 1 → W1 W2 W3 W4 W5 · sector 2 → W6 W7 W8 W1 W2 · sector 3 → W3 W4 W5 W6 W7 …
//   every sector contains W4 or W7, so every sector has at least one HAULER.

// sector scaling (s = sector)
// speedMult(s)  = min(1.6, 1 + 0.08 × (s − 1))   // enemy and boss movement
// shotMult(s)   = min(1.5, 1 + 0.06 × (s − 1))   // enemy shot speed
// fireMult(s)   = min(2.0, 1 + 0.10 × (s − 1))   // fire intervals are divided by it
// hpBonus(s)    = floor((s − 1) / 2)             // added to the HP of every regular enemy
```

Bosses (`bosses.ts`). The boss is `BOSSES[(sector − 1) % 3]`. Its HP is `baseHp × (1 + 0.5 × floor((sector − 1) / 3))`. Each boss enters from y = −80 down to its hold position at 80 px/s and cannot be damaged while entering. Its phase follows its HP: phase 1 above 66%, phase 2 from 66% down to 33%, and phase 3 below 33%. Every interval below is divided by `fireMult(sector)`, and every shot speed is multiplied by `shotMult(sector)`.

| Boss  | Base HP | Movement once in place                               | Phase 1                                                                  | Phase 2                                                       | Phase 3                                                                                        |
| ----- | ------- | ---------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| MAW   | 240     | y = 120; x ping-pongs between 200 and 600 at 90 px/s | Fan of 7 shots over ±30°, down, every 1.2 s                              | Fan of 9 over ±36° every 1.0 s, plus 1 aimed shot every 0.5 s | Fan of 11 over ±40° every 0.9 s, offset by half a step on every other fan                      |
| LOOM  | 300     | Fixed at x = 400, y = 130                            | 2 opposite arms rotating 140°/s, 1 shot per arm every 0.12 s at 180 px/s | 3 arms at 160°/s                                              | 4 arms at 180°/s; the spin direction flips every 3.0 s                                         |
| CROWN | 360     | x = 400 + 180 · sin(0.6t), y = 130 + 30 · sin(1.2t)  | Ring of 16 shots every 1.6 s                                             | Ring of 20 every 1.4 s, plus 2 DRIFTER spawned every 4.0 s    | Ring of 24 every 1.2 s (each ring rotated by half a step), plus a 3-shot aimed fan every 0.8 s |

Skins (`skins.ts`):

```ts
export type VoidRunnerSkin = {
  bg: string;
  bgDeep: string; // vertical gradient, top → bottom
  starFar: string;
  starMid: string;
  starNear: string;
  ship: string;
  shipCore: string;
  thrust: string;
  pulse: string;
  spread: string;
  lance: string; // bolts and capsules of each weapon
  drifter: string;
  stinger: string;
  warden: string;
  hauler: string;
  boss: string;
  bossCore: string;
  shot: string;
  shotCore: string; // enemy shots: outer ring + bright core
  hitFlash: string;
  spark: string;
  banner: string;
  bodyStyle: "solid" | "outline" | "pixel"; // filled paths, 2 px strokes, or shapes snapped to a 4 px grid with fillRect
  glow: boolean; // shadowBlur on the ship, the boss and capsules only
  scanlines: boolean; // 1 px dark line every 3 px over the field
};
```

| Key       | classic (mirrors `globals.css`) | neon      | retro     |
| --------- | ------------------------------- | --------- | --------- |
| bg        | `#0a0a0f` (`--bg`)              | `#000000` | `#0b0f0a` |
| bgDeep    | `#14061a`                       | `#0d0018` | `#0b0f0a` |
| starFar   | `#4a4f70` (`--ink-faint`)       | `#2a2f55` | `#1f3d26` |
| starMid   | `#8a8fb5` (`--ink-dim`)         | `#6a70ff` | `#3f7a4a` |
| starNear  | `#e6e9ff` (`--ink`)             | `#ffffff` | `#9bff6a` |
| ship      | `#00f5ff` (`--cyan`)            | `#00f5ff` | `#9bff6a` |
| shipCore  | `#e6e9ff` (`--ink`)             | `#ffffff` | `#e8ff7a` |
| thrust    | `#ffcf3a` (`--gold`)            | `#ff9d00` | `#ffb347` |
| pulse     | `#00f5ff` (`--cyan`)            | `#00f5ff` | `#e8ff7a` |
| spread    | `#00ff88` (`--green`)           | `#39ff14` | `#9bff6a` |
| lance     | `#f5ff00` (`--yellow`)          | `#fff200` | `#ffb347` |
| drifter   | `#ff006e` (`--magenta`)         | `#ff2bd6` | `#ff6a4d` |
| stinger   | `#d97a3a` (`--bronze`)          | `#ff7a00` | `#ffb347` |
| warden    | `#c7d0e0` (`--silver`)          | `#b14dff` | `#e8ff7a` |
| hauler    | `#00ff88` (`--green`)           | `#39ff14` | `#9bff6a` |
| boss      | `#ff006e` (`--magenta`)         | `#ff2bd6` | `#ff6a4d` |
| bossCore  | `#ffcf3a` (`--gold`)            | `#00f5ff` | `#e8ff7a` |
| shot      | `#ff006e` (`--magenta`)         | `#ff2bd6` | `#ff6a4d` |
| shotCore  | `#e6e9ff` (`--ink`)             | `#ffffff` | `#fff4d6` |
| hitFlash  | `#ffffff`                       | `#ffffff` | `#fff4d6` |
| spark     | `#ffcf3a` (`--gold`)            | `#fff200` | `#ffb347` |
| banner    | `#ff006e` (`--magenta`)         | `#00f5ff` | `#e8ff7a` |
| bodyStyle | `solid`                         | `outline` | `pixel`   |
| glow      | `true`                          | `true`    | `false`   |
| scanlines | `false`                         | `false`   | `true`    |

Shapes, the same in every skin: the ship is an arrow hull with two swept fins, a core dot and a flickering thrust flame. A DRIFTER is a diamond and a STINGER a narrow down-pointing triangle. A WARDEN is an octagon with a core, and a HAULER a wide rounded box with three stripes. MAW is a wide hexagon with a notched jaw. LOOM is a circle with rotating arm emitters. CROWN is a five-point crown outline. Capsules are coloured by weapon and shaped by weapon: a PULSE capsule is a diamond, a SPREAD capsule a three-ray fan, and a LANCE capsule a vertical bar. Capsules carry no letters.

Sound (`sounds.ts`):

```ts
export const SOUND_URLS = {
  shot: "/games/void-runner/sounds/shot.wav",
  boom: "/games/void-runner/sounds/boom.wav",
  pickup: "/games/void-runner/sounds/pickup.wav",
  swap: "/games/void-runner/sounds/swap.wav",
  hurt: "/games/void-runner/sounds/hurt.wav",
  warning: "/games/void-runner/sounds/warning.wav",
  bossdown: "/games/void-runner/sounds/bossdown.wav",
} as const;
```

Sound files in `public/games/void-runner/sounds/` are 22050 Hz mono 16-bit PCM WAV, each 1.0 s or shorter and under 50 KB. A one-off script kept outside the repo generates them, and only the files are committed:

- `shot.wav`: 0.05 s square wave from 1200 Hz down to 900 Hz, at −12 dB.
- `boom.wav`: 0.25 s noise burst with an exponential decay.
- `pickup.wav`: arpeggio of 660, 880 and 1320 Hz, 0.06 s each.
- `swap.wav`: two blips at 520 Hz and 780 Hz, 0.04 s each.
- `hurt.wav`: 0.5 s saw sweep from 500 Hz down to 60 Hz.
- `warning.wav`: 1.0 s alarm alternating 440 Hz and 330 Hz every 0.25 s.
- `bossdown.wav`: 0.9 s of noise mixed with a sweep from 300 Hz down to 40 Hz.

Conventions:

- **Field and timing.**
  - The logical field is `W = 800`, `H = 600`, with the origin at the top-left. It is 4:3, so it fills the `.crt-screen` with no letterbox. The backing store is scaled by `devicePixelRatio` (cap 2).
  - Speeds are in px/s. `dt` is in seconds and capped at `MAX_DT`. `resume()` and `restart()` reset `lastTime`.
- **Controls.**
  - `←` `→` `↑` `↓` or `A` `D` `W` `S` move the ship. Held keys combine into 8 directions, and the diagonal is normalized to `SHIP.speed`. The ship center is clamped to the `SHIP` bounds.
  - `Space` fires while held, at the active weapon's cooldown. The first bolt leaves on the frame the key goes down.
  - `X` (`pressed()`, one-shot) swaps to the next owned weapon in the order PULSE → SPREAD → LANCE → PULSE. With only one weapon owned, `X` does nothing: no sound and no `onChange`.
  - `createInput` prevents `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight` and `Space`. `P`, `Esc` and `M` belong to the platform and are never bound by the engine.
- **Run flow.**
  - A run starts with the "SECTOR 1" banner (`SECTOR_BANNER`). The ship can move and fire during it.
  - Then waves 1 to 5 of the sector play. Each wave ends when all its spawns are done and none of its enemies is left alive on the field. After `WAVE_GAP` the next wave starts.
  - After wave 5 comes the "WARNING" banner (`BOSS_WARNING`), with `warning.wav`. Then the boss enters and `wave` becomes 6.
  - When the boss dies, its explosion plays for `BOSS_DEATH`. Then `sector` goes up by 1, `wave` goes back to 1 and the next "SECTOR N" banner shows.
  - The banners are the only text the canvas draws. They use `bold 32px "Press Start 2P", ui-monospace, monospace` in `skin.banner`, centered, with glow when `skin.glow` is true.
- **Weapons.**
  - A run starts with PULSE at level 1, and it is the only owned weapon.
  - Collecting a capsule for a weapon the player does not own unlocks it at level 1 and makes it the active weapon. It adds `POINTS.capsule` and plays `pickup.wav`.
  - Collecting a capsule for an owned weapon raises that weapon's level by 1, up to 3. The active weapon does not change. It adds `POINTS.capsule`.
  - If that weapon is already at level 3, the capsule adds `POINTS.capsuleMaxed` instead.
  - Capsules fall at `CAPSULE.speed` and are removed below the field.
- **Getting hit.**
  - The ship is hit when:
    - an enemy shot's swept path comes within `SHIP.hitR + shot.r` of the ship center;
    - an enemy center comes within `SHIP.bodyR + enemy radius` of it;
    - or the boss center comes within `SHIP.bodyR + BOSS_HIT_R` of it.
  - A hit removes 1 life and drops the active weapon by 1 level (minimum 1; no weapon is ever lost). It plays `hurt.wav` and spawns `PARTICLES.ship` sparks, and the state becomes `respawn`.
  - In `respawn`, the ship is absent and the world keeps moving. After `RESPAWN_DELAY`, all enemy shots are cleared. The ship then reappears at `SHIP.startX`, `SHIP.startY`, blinking and invulnerable for `INVULN_TIME`, and the state goes back to `playing`.
  - If the hit took the last life, the state becomes `gameover` after `RESPAWN_DELAY` and `onGameOver(score)` fires once.
- **Collisions.** Bolts and shots use a swept test: the segment from the previous position to the current one is tested against the target circle. Fast bolts (900 px/s, which is 45 px per capped frame) therefore never pass through a 13 px enemy.
- **Scoring.** Every addition goes through `addScore(points)`, which clamps at `MAX_SCORE`:
  - Destroying an enemy adds `POINTS[kind] × sector`.
  - Destroying a boss adds `POINTS.boss × sector`.
  - A wave in which every enemy was destroyed (none escaped) adds `POINTS.perfectWave × sector` when it ends.
  - DRIFTERs spawned by CROWN belong to no wave. They score normally and do not affect any perfect-wave bonus.
- **Callbacks.**
  - `onChange` fires only when `score`, `lives`, `sector`, `wave`, `weapon`, `weaponLevel` or `state` differs from the last emitted snapshot. The last emitted snapshot starts as the registry's `initialSnapshot`.
  - `onGameOver(score)` fires once per game over.
- **Drawing.**
  - The canvas draws, in order: the background gradient, the stars, enemies, the boss, player bolts, capsules, the ship, enemy shots (on top, for readability), particles, the banner, and scanlines (retro).
  - It draws no score, lives, sector, weapon, GAME OVER or restart text.
  - Glow (`shadowBlur`) is used only on the ship, the boss and capsules, and only when `skin.glow` is true. It is never used on bolts, shots or particles.
  - A damaged enemy or boss is drawn in `skin.hitFlash` for `HIT_FLASH`.
- **Skins.** The engine reads `options.skin` and exposes `skins = ["classic", "neon", "retro"]` and `setSkin(id)`. `setSkin` swaps the palette live and redraws one frame even while paused. No colour is hard-coded outside `skins.ts`.
- **Sound and lifecycle.**
  - A sound bank is created with `createSoundBank(SOUND_URLS)`.
  - The engine throttles plays: the same sound plays at most once per `SOUND_THROTTLE.shot` for `shot` and once per `SOUND_THROTTLE.other` for every other sound.
  - `shot` plays on each volley, `boom` on each enemy destroyed, `swap` on a successful swap, and `bossdown` on a boss kill.
  - `pause()` calls `suspend()`, `resume()` calls `resume()` and `destroy()` calls `destroy()`.
  - `pause()` also calls `input.reset()`, so after a resume firing restarts on the next `Space` keydown.
- **Caps.** Bolts, shots, particles and enemies are capped by `CAPS`. When a list is full, its oldest entry is removed before a new one is added.

Edge cases:

- The ship touched by two things in the same frame loses one life only.
- Hits during invulnerability, during `respawn` or after `gameover` are ignored.
- If the boss dies and the ship is hit in the same frame, the boss bonus is added first. If that hit took the last life, the GAME OVER score includes the bonus.
- A capsule that reaches the ship's position while the ship is absent (`respawn`) keeps falling. It can still be collected after the respawn if it is on screen.
- Bolts that hit a boss while it is entering are removed with no damage.
- `end()` during any state (banner, boss, `respawn`) forces `gameover` with the current score. If `onGameOver` has already fired, it does not fire again.
- `restart()` during `respawn` or a banner starts a fresh run: score 0, 3 lives, sector 1, wave 1, PULSE level 1 only, and no enemies, shots or capsules.
- Pausing freezes every timer: banners, waves, fire cooldowns, boss patterns, invulnerability and the respawn delay.

## Implementation plan

1. **Seed migration.** Write `20261116120000_seed_void_runner.sql`, run `npm run db:push`, then `npm run db:types`.
   - Check with Supabase MCP `execute_sql` that `games` has the `void-runner` row with `sort_order = 8`, and that `scores` has no `void-runner` rows.
   - Add `'void-runner'` to the seeded games check in `supabase/checks/verify-prod.sql`, increase that count by one, and add the migration version to `expected_migrations` (with its count).
   - Restart the dev server if the cached list does not show the game.
   - Check: `/games` lists VOID RUNNER under SHOOTER, and `/games/void-runner/play` shows "NOT PLAYABLE YET".
2. **Cover.** Add the `cover-void` class to `app/globals.css`, designed with `/frontend-design`. It uses only palette tokens: a deep violet vertical gradient (`#14061a` → `#0a0a18`), streaks of falling stars, a V of magenta enemy diamonds at the top and a cyan arrow ship at the bottom center. Check: the card on `/games`, the detail page and the home rail show the cover with no broken layout.
3. **Sound assets.** Generate the seven WAVs with a one-off script in the scratchpad (outside the repo) and copy them to `public/games/void-runner/sounds/`. Check: on the dev server `/games/void-runner/sounds/shot.wav`, `boom.wav`, `pickup.wav`, `swap.wav`, `hurt.wav`, `warning.wav` and `bossdown.wav` each return 200 and are under 50 KB.
4. **Types, constants, skins and sound map.** Create `types.ts`, `constants.ts`, `skins.ts` (all three skins with the values above) and `sounds.ts`. Check: `npm run lint` passes and no file imports React.
5. **Weapon and enemy data.** Create `weapons.ts` (`WEAPONS`, `fireWeapon`) and `enemies.ts` (`ENEMIES`, `updateEnemy` for the four kinds). Check: `npm run build` passes. Called from a scratch script outside the repo, `fireWeapon("spread", 3, 400, 500)` returns 7 bolts, the outermost at ±27°.
6. **Waves and bosses.** Create `waves.ts` (the 8 templates, `waveTemplate`, the four scaling functions) and `bosses.ts` (the 3 bosses, `bossFor`, `bossHp`, the phase patterns). Check: `npm run build` passes. From a scratch script:
   - `waveTemplate(2, 1)` is W6;
   - `bossFor(4)` is MAW;
   - `bossHp(4)` is 360;
   - `speedMult(20)` is 1.6.
7. **Game logic.** In `engine.ts`, write the world state and `update(dt)`:
   - ship movement, held fire, the swap, bolts and shots with the swept test;
   - enemies and the wave runner, bosses and phases;
   - capsules, scoring with the clamp, hits, respawn and game over.
   - Check: `npm run build` passes (no loop yet).
8. **Loop, input, sound and drawing.** Add `createVoidRunnerGame`:
   - rAF loop with the `dt` cap, and `createInput` with the five prevented codes;
   - the sound bank with throttling, and `draw` with the active skin and the scanlines;
   - `onChange` on change only and `onGameOver` once;
   - `pause`, `resume`, `end`, `restart`, `destroy`, `skins` and `setSkin`.
   - Check: the engine runs when mounted by a scratch page, and `destroy()` leaves no listener behind.
9. **Registry entry.** Add `void-runner` to `lib/games/registry.ts`:
   - `initialSnapshot`: `score 0`, `lives 3`, `sector 1`, `wave 1`, `weapon "pulse"`, `weaponLevel 1`, `state "playing"`.
   - `hud` returns three stats:
     - LIVES: `♥` repeated `lives` times, or `—` at 0. Magenta.
     - SECTOR: `01-3`, which is the sector padded to 2 digits, a dash, and the wave (or `B` when `wave` is 6). Yellow.
     - WEAPON: `PULSE L1`, which is the uppercase weapon id, `L` and the level. Cyan.
   - `controls`: `← ↑ ↓ →` and `W A S D` "Move", `Space` "Fire (hold)", `X` "Swap weapon".
   - `ariaLabel: "Void Runner game"` and `sound: true`.
   - `touch: { dpad: ["up", "down", "left", "right"], buttons: [{ label: "FIRE", code: "Space", variant: "magenta" }, { label: "SWAP", code: "KeyX", variant: "cyan" }] }`, with no `repeat`.
   - Check: `/games/void-runner/play` runs the real game with no console errors, and the SKIN selector and the MUTE button show.
10. **HUD, touch and cover polish with `/frontend-design`.** Check the three HUD stats, MUTE, the SKIN selector and the controls legend at 375 px and at 1440 px, plus the FIRE and SWAP buttons on a 375×812 touch emulation. Adjust only what overflows or overlaps.
11. **Verification pass.** Run `npm run lint` and `npm run build`, then every acceptance criterion below, including the regression for the other games.

Before writing code, read `node_modules/next/dist/docs/` for Client Components, dynamic `import()` and lazy loading, static files in `public/`, and `'use cache'` / `cacheTag` for the cached game list.

## Acceptance criteria

- [ ] `npm run lint` finishes with no errors.
- [ ] `npm run build` finishes with no errors.
- [ ] `supabase/migrations/` contains `20261116120000_seed_void_runner.sql`, `npm run db:types` shows no diff, and `games` has the `void-runner` row with 0 scores.
- [ ] `supabase/checks/verify-prod.sql` lists `void-runner` in the seeded games and the new migration version.
- [ ] `/games` (SHOOTER filter included) and `/games/void-runner` show the title VOID RUNNER and its description. The home "GAMES AVAILABLE NOW" rail lists it with the `cover-void` cover.
- [ ] `/games/void-runner/play` runs the real engine with the listed controls.
- [ ] HUD values (SCORE, LIVES, SECTOR, WEAPON) always match the engine.
- [ ] Losing the last life opens the GAME OVER modal 1.0 s after the explosion, with the same score as the HUD.
- [ ] END opens the modal with the current score.
- [ ] PLAY AGAIN restarts with score 0, 3 lives, SECTOR `01-1`, WEAPON `PULSE L1` and the "SECTOR 1" banner.
- [ ] PAUSE, `P` and `Esc` freeze the game and show PAUSED. Resuming makes no bolt, shot or enemy jump, and switching tab pauses.
- [ ] Arrow keys and Space do not scroll the page while playing.
- [ ] Typing initials in the GAME OVER modal (including `W`, `A`, `S`, `D`, `X` and `M`) does not affect the game or the mute state.
- [ ] Leaving the play page and coming back runs a single loop (normal speed, no console errors, one sound per event).
- [ ] At 375 px wide the canvas fits the CRT with no horizontal scroll.
- [ ] The canvas draws no SCORE, LIVES, SECTOR, WEAPON, GAME OVER or restart text. Only the "SECTOR N" and "WARNING" banners appear as text.
- [ ] Movement:
  - [ ] Each arrow and `W A S D` key moves the ship at 300 px/s.
  - [ ] Two held keys move it diagonally at the same 300 px/s.
  - [ ] The ship center never leaves x 20–780, y 120–572.
- [ ] Firing:
  - [ ] Holding `Space` with PULSE L1 fires one bolt every 0.12 s.
  - [ ] Releasing `Space` stops firing.
  - [ ] SPREAD L3 fires 7 bolts per volley, the outermost at ±27°.
- [ ] LANCE pierces: one bolt damages every enemy on its path once.
- [ ] A bolt at 900 px/s never passes through a DRIFTER without hitting it.
- [ ] Destroying an enemy in sector 1 adds DRIFTER 100, STINGER 150, WARDEN 300, HAULER 250. In sector 2 the same kills add twice as much.
- [ ] A wave in which every enemy is destroyed adds `500 × sector` when it ends. A wave with one escaped enemy adds nothing.
- [ ] Destroying a HAULER always drops a capsule. A HAULER that leaves the field drops none.
- [ ] Every sector (checked for sectors 1 to 5) contains at least one HAULER wave.
- [ ] Capsules:
  - [ ] Collecting a capsule for a weapon you do not own switches WEAPON to that weapon at `L1`, adds 200 and plays `pickup.wav`.
  - [ ] Collecting a capsule for an owned weapon raises its level by 1 without switching, and adds 200.
  - [ ] At `L3`, a capsule adds 1,000 and the level stays 3.
- [ ] Swapping:
  - [ ] `X` cycles through owned weapons in the order PULSE → SPREAD → LANCE.
  - [ ] Each weapon keeps its own level across swaps.
  - [ ] With only PULSE owned, `X` does nothing and plays no sound.
- [ ] Getting hit:
  - [ ] A hit removes one life and lowers the active weapon by one level, never below `L1`.
  - [ ] The ship reappears after 1.0 s at the bottom center, blinking.
  - [ ] Enemy shots on screen are cleared at that moment.
  - [ ] Nothing can hit the ship for the next 2.0 s.
- [ ] Two hits in the same frame remove one life only.
- [ ] Sector flow:
  - [ ] After wave 5 the "WARNING" banner shows for 1.5 s and SECTOR reads `01-B`.
  - [ ] The boss enters and takes no damage until it reaches its position.
- [ ] Boss order is MAW in sector 1, LOOM in sector 2, CROWN in sector 3 and MAW again in sector 4, with 360 HP (240 × 1.5).
- [ ] Each boss changes its pattern when its HP drops below 66% and again below 33%.
- [ ] Killing the boss adds `5,000 × sector`, clears its shots, and shows "SECTOR N+1" after the explosion. SECTOR then reads `0N-1` (for example `02-1`).
- [ ] From sector 2 on, enemies move faster than in sector 1. Enemy movement never exceeds 1.6× its base speed, enemy shots never exceed 1.5× theirs, and fire never happens at more than 2× the base rate.
- [ ] The score never exceeds 9,999,999 in the HUD or in the saved row.
- [ ] `onGameOver` is called once per game over, including when END is pressed during the 1.0 s death explosion.
- [ ] Skins:
  - [ ] The SKIN selector offers CLASSIC, NEON and RETRO.
  - [ ] Switching skins recolors ships, enemies, shots and stars live, also while paused, without restarting.
  - [ ] RETRO shows scanlines and no glow.
  - [ ] The choice survives a reload (`av:skin:void-runner`).
- [ ] The CLASSIC canvas uses the palette of this spec (dark violet background, cyan ship, magenta enemy shots), not plain white on black.
- [ ] Sound:
  - [ ] It is muted by default, and MUTE and `M` toggle it and persist across reloads.
  - [ ] Unmuted, `shot`, `boom`, `pickup`, `swap`, `hurt`, `warning` and `bossdown` each play on their event.
  - [ ] `shot` never plays more than 10 times per second.
  - [ ] Pausing silences the game.
  - [ ] No audio plays after leaving the page, and the console shows no autoplay errors.
- [ ] Assets: the network panel shows no 404 for the seven WAVs. Blocking one leaves that sound silent, logs once and does not crash the game.
- [ ] SAVE SCORE shows `SAVING…` then `SAVED — RANK #N`. The score appears in the Hall of Fame tab for VOID RUNNER, in the detail "TOP SCORES" and in home "LATEST SCORES", and the game's plays go up by 1.
- [ ] Touch emulation at 375×812:
  - [ ] The D-pad shows four arrows plus the FIRE (magenta) and SWAP (cyan) buttons.
  - [ ] Holding FIRE fires continuously while an arrow moves the ship.
  - [ ] A tap on SWAP swaps once.
  - [ ] The page does not scroll.
- [ ] Asteroids, Tetris, Arkanoid, Snake and TOAD ROAD still play and save exactly as before.
- [ ] No secret or service-role key is used.

## Decisions

- **Yes:** `id = void-runner`, title `VOID RUNNER`, `SHOOTER`, `magenta`. Provided (game jam). SHOOTER has only ASTEROIDS (yellow) today, so magenta stands out from it.
- **Yes:** vertical scrolling, waves, weapon swaps and bosses as the core of the classic mode. Provided (game jam).
- **Yes:** typed engine in `lib/games/void-runner/`, as with the other games: no globals, a clean mount and unmount, typed under `strict`. Agent's choice (game jam).
- **No:** an iframe or `next/script` port. No reference code exists, and the platform must read the score. Agent's choice (game jam).
- **Yes:** platform HUD and GAME OVER modal. LIVES, SECTOR and WEAPON are HUD stats, and the canvas draws only the game and two pacing banners. Agent's choice (game jam).
- **Yes:** the "SECTOR N" and "WARNING" banners stay on the canvas. They are pacing, like Arkanoid's "LEVEL N", not stats. Agent's choice (game jam).
- **Yes:** `cover-void` as a new class, designed with `/frontend-design`. `cover-invaders` is kept free for GRID INVASION, and the other covers belong to other games. Agent's choice (game jam).
- **Yes:** `sort_order = 8`, after the planned `lane-surge` (5) and `slide-core` (6, 7). The seed timestamp `20261116120000` sorts after every existing and planned migration. Agent's choice (game jam).
- **Yes:** three weapons (PULSE, SPREAD, LANCE) with levels 1–3 and a one-key cyclic swap on `X`. Each weapon has a clear role: PULSE for steady single-target damage, SPREAD for crowds and LANCE for lines. A single key fits one touch button. Agent's choice (game jam).
- **No:** swap on `Q`/`E` or number keys. Two directions or three keys add little with three weapons and would need more touch buttons. Agent's choice (game jam).
- **Yes:** each weapon keeps its own level, and a hit costs a level of the active weapon. Swapping is then a real choice, and a hit hurts without wiping progress. Agent's choice (game jam).
- **Yes:** haulers always drop a capsule, with a 2:1 weight toward weapons not owned yet. Weapons come from a target the player can plan for, not from luck. Agent's choice (game jam).
- **Yes:** 8 wave templates rotating through 5 waves per sector, and 3 bosses rotating with +50% HP per loop. The content stays small and data-driven, and the formula guarantees a hauler in every sector. Agent's choice (game jam).
- **Yes:** an open-ended run with capped scaling (movement 1.6×, shots 1.5×, fire 2×, HP +1 every two sectors). Better players always go further and score more, and the caps keep late sectors readable. Agent's choice (game jam).
- **No:** a win state or final boss. A ceiling would make the best players tie. Agent's choice (game jam).
- **Yes:** scoring of enemy points × sector, `500 × sector` per perfect wave, `5,000 × sector` per boss, and 200 or 1,000 per capsule. It rewards both clearing waves fully and going deep. Agent's choice (game jam).
- **Yes:** 3 lives, no extra lives, and a 5 px hit circle. A small hitbox is the genre standard and makes dense patterns fair. Agent's choice (game jam).
- **Yes:** held `Space` to fire, not auto-fire. It matches the keyboard legend of ASTEROIDS, and the touch FIRE button can be held. Agent's choice (game jam).
- **Yes:** the swept segment test for bolts and shots. At 900 px/s and the 0.05 s `dt` cap a bolt moves 45 px per frame, more than a DRIFTER's diameter. Agent's choice (game jam).
- **Yes:** vector-drawn entities with no image assets. All three skins can restyle every entity, nothing can 404 except the sounds, and no art is borrowed. Agent's choice (game jam).
- **Yes:** `classic`, `neon` and `retro` skins defined in this spec, with `setSkin`. The integration contract requires them, and the game jam asked for them. Provided (game jam).
- **Yes:** sound with seven synthesized WAVs through `createSoundBank`, plus throttling in the engine. The module exists since SPEC 09, the Arkanoid MP3s do not fit a shooter, and throttling keeps 10 shots per second from turning into noise. Agent's choice (game jam).
- **Yes:** the engine takes `mode` in its options from day one, defaulting to `"classic"`. Spec 02 then adds its variant without changing the factory signature. Agent's choice (game jam).
- **Yes:** original names for the ship, enemies, bosses and weapons. No existing commercial shooter is recreated. Provided (game jam: keep names, art and mechanics original).
- **Yes:** seed only, with no schema change. `games`, `scores`, `submit_score` and the views are generic per `game_id`. Provided (game jam).

## Risks

| Risk                                                        | Mitigation                                                                                                                       |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| StrictMode double mount starts two loops or two sound banks | `destroy()` cancels the rAF, detaches input and destroys the sound bank; `GameCanvas` already guards with `cancelled`.           |
| Input steals keys from the modal                            | Shared input ignores `input`, `textarea` and contenteditable targets; a criterion covers `W A S D`, `X` and `M`.                 |
| Blurry canvas on high-DPI                                   | Backing store scaled by `devicePixelRatio` (cap 2).                                                                              |
| `dt` jump after pause or tab switch                         | `dt` cap of 0.05 s; `resume()` and `restart()` reset `lastTime`; every timer runs on the same capped `dt`.                       |
| Bullet count drops the frame rate                           | Caps on bolts (120), shots (300), particles (400) and enemies (40); no `shadowBlur` on bolts, shots or particles.                |
| Bolts tunnel through enemies at high speed                  | Swept segment test; covered by a criterion.                                                                                      |
| Boss patterns too dense at high sectors                     | Shot speed capped at 1.5× and fire rate at 2×; LOOM emits every 0.12 s at most; the 5 px hitbox keeps gaps passable.             |
| Sound spam from rapid fire                                  | Engine-side throttle (`shot` 0.1 s, others 0.06 s); `shot.wav` is quiet (−12 dB).                                                |
| Autoplay policy blocks audio                                | The shared module creates the context on the first gesture; muted by default.                                                    |
| WAV 404 or slow load                                        | A failed load logs once and leaves that sound silent; the game never waits for audio.                                            |
| Banner font not loaded on the first frame                   | Falls back to `ui-monospace, monospace`; the banner is pacing only and never blocks play.                                        |
| Held FIRE on touch combined with the D-pad                  | `virtual-keys` is ref-counted per code; a touch criterion holds FIRE while pressing an arrow.                                    |
| Resemblance to a known commercial shooter                   | Original title, names, shapes, patterns and sounds; no scrolling terrain, power-bar shop or named mechanic of any existing game. |
| Cover class clashes with another game                       | `cover-void` is checked against `globals.css` before writing; spec 02 uses `cover-void-siphon`.                                  |
| Cached game list does not show the new row until rebuild    | Plan step 1 restarts the dev server; production needs a rebuild or `games` tag invalidation.                                     |
| Scores forgeable until Auth                                 | Accepted in SPEC 07.                                                                                                             |

## What is **not** in this spec

- The siphon variant and its catalog row (`02-void-runner-siphon.md`).
- Smart bombs, shields, options or drones, extra lives and continues.
- Horizontal scrolling, terrain and ground targets.
- A final boss or a win state.
- Background music and volume sliders.
- Image sprites and any asset from `references/`.
- Gamepad controls, mouse aiming and auto-fire settings.
- Anti-cheat, server-verified scores and Auth changes.
- Schema changes, a plugin system beyond the registry, and redirects.
- Any change to `references/`.

Each one of those, if it lands, goes in its own spec.
