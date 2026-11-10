# SPEC GJ-toadroad-02 — TOAD ROAD: progression

> **Status:** Draft
> **Depends on:** SPEC 06, SPEC 07, SPEC 08, SPEC 09, SPEC GJ-toadroad-01
> **Date:** 2026-11-09
> **Objective:** Make TOAD ROAD get harder every cleared round with levels, a speed ramp, a shrinking timer and diving turtles, reward skill with a bonus fly and extra lives, and add sound with MUTE.

## Why this spec exists

Spec 01 delivers a playable game that repeats one round at constant difficulty. This spec adds the reason to keep playing: each round clear raises the level, traffic and river speed up, the attempt timer shrinks and, from level 2, the turtles start to dive. Extra lives and a bonus fly give good players a way to go further and score more.

It also adds the game's sound. `lib/games/shared/audio.ts` and the MUTE control already exist (SPEC 09), so the game only declares `sound: true` and uses `createSoundBank`. The Arkanoid MP3s do not fit a hop game, so five short effects are synthesized into `public/games/toadroad/sounds/` as part of this spec.

Everything here extends `lib/games/toadroad/` from spec 01. Nothing from spec 01 is rewritten except the round-clear bonus, which becomes `1000 × level` (identical at level 1).

## Scope

**In:**

- `level` in the snapshot and the HUD: starts at 1 and goes up by 1 after every round clear.
- Speed ramp: every lane speed is multiplied by `min(2.0, 1 + 0.12 × (level − 1))`.
- Attempt timer shrinks: `max(20, 30 − 2 × (level − 1))` seconds.
- Round-clear bonus `1000 × level`.
- Diving turtles from level 2 on the two turtle lanes (rows 2 and 4): they warn, then submerge and stop supporting the toad.
- Bonus fly: sometimes appears in an empty slot for 4 seconds and is worth 200 points.
- Extra life every 10,000 points, up to 5 lives.
- Sound with MUTE: `hop`, `splat`, `splash`, `home` and `clear`, muted by default, `sound: true` in the registry.
- Five WAV files in `public/games/toadroad/sounds/`.
- Registry entry updated: `level` in `initialSnapshot`, HUD LEVEL, `sound: true`.
- HUD polish and cover check with `/frontend-design`.

**Out of scope (for future specs):**

- Crocodiles, otters, snakes and other special enemies.
- New lane layouts per level (the lane table of spec 01 does not change).
- Music.
- Touch controls, gamepad and mouse.
- Two-player mode.
- Anti-cheat, server-verified scores, Auth.
- Any change to `references/`.
- Schema changes, a plugin system beyond the registry, redirects.

## Data model

No schema change: `scores` and `submit_score` are generic per `game_id`. No new seed: the `toadroad` row from spec 01 stays as it is.

Snapshot (`lib/games/toadroad/types.ts` gains `level`):

```ts
export type ToadRoadSnapshot = {
  score: number; // 0..9_999_999, clamped
  lives: number; // 0..5
  level: number; // 1, 2, 3…
  home: number; // 0..5
  time: number; // ceil(seconds left in this attempt)
  state: ToadRoadState;
};

export type Fly = { slot: number; remaining: number }; // slot index 0..4, seconds left
export type SoundName = "hop" | "splat" | "splash" | "home" | "clear";
```

New constants (`constants.ts`):

```ts
export const LEVEL_SPEED_STEP = 0.12; // +12% lane speed per level
export const MAX_SPEED_MUL = 2.0;
// speedMul = min(MAX_SPEED_MUL, 1 + LEVEL_SPEED_STEP * (level - 1))

export const TIME_LOSS_PER_LEVEL = 2; // s
export const MIN_ATTEMPT_TIME = 20; // s
// attemptTime = max(MIN_ATTEMPT_TIME, ATTEMPT_TIME - TIME_LOSS_PER_LEVEL * (level - 1))

export const DIVE_FROM_LEVEL = 2;
export const DIVE_PERIOD = 7; // s, one full cycle
export const DIVE_UP = 4.5; // s, turtles up and safe
export const DIVE_WARN = 1; // s, turtles sinking, still safe, drawn shrinking
export const DIVE_DOWN = 1.5; // s, turtles submerged, not safe
export const DIVE_OFFSETS: Record<number, number> = { 2: 0, 4: 3.5 }; // s, per turtle lane row
// phase = (diveClock + DIVE_OFFSETS[row]) mod DIVE_PERIOD
// [0, 4.5) up, [4.5, 5.5) warning, [5.5, 7) submerged

export const FLY_CHANCE = 0.4; // rolled at every new attempt
export const FLY_LIFETIME = 4; // s
export const FLY_BLINK = 1; // s, blinks during its last second
export const FLY_POINTS = 200;

export const EXTRA_LIFE_EVERY = 10_000; // points
export const MAX_LIVES = 5;

export const SOUND_URLS: Record<SoundName, string> = {
  hop: "/games/toadroad/sounds/hop.wav",
  splat: "/games/toadroad/sounds/splat.wav",
  splash: "/games/toadroad/sounds/splash.wav",
  home: "/games/toadroad/sounds/home.wav",
  clear: "/games/toadroad/sounds/clear.wav",
};
```

`PALETTE` gains `fly: "#f5ff00"` (`--yellow`, the bonus fly) and `turtleSunk: "rgba(0, 245, 255, 0.25)"` (`--cyan`, ripples where the turtles are submerged).

Files:

- `lib/games/toadroad/types.ts`, `constants.ts` and `engine.ts`: extended as above.
- `lib/games/toadroad/lanes.ts`: `platformAt` gains a `diving` argument (see Conventions); no change to the `LANES` table.
- `public/games/toadroad/sounds/hop.wav`, `splat.wav`, `splash.wav`, `home.wav`, `clear.wav`: new.

Sound files (mono, 16-bit, 22,050 Hz WAV, each under 60 KB), made once with a throwaway Node script that is not committed and is run from outside the repo:

| File         | Length | Content                                             |
| ------------ | ------ | --------------------------------------------------- |
| `hop.wav`    | 90 ms  | Square blip sliding from 520 Hz to 780 Hz.          |
| `splat.wav`  | 220 ms | Noise burst with fast decay and a 120 Hz thump.     |
| `splash.wav` | 350 ms | Low-passed noise with a falling pitch.              |
| `home.wav`   | 300 ms | Three notes, 440 / 554 / 659 Hz, 100 ms each.       |
| `clear.wav`  | 600 ms | Five rising notes, 440 / 523 / 659 / 784 / 1047 Hz. |

Conventions (all of spec 01 still applies; these are the additions):

- Level: `level` starts at 1 and goes up by 1 when the round-clear flash ends. `restart()` returns to level 1.
- Speed: lane `offset` advances by `dir × speed × speedMul × dt`, and a riding toad moves with the same scaled velocity. Hop distance and sizes do not change.
- Timer: a new attempt starts with `attemptTime(level)`. HUD TIME shows `ceil(seconds left)`.
- Round clear: adds `CLEAR_POINTS × level` with the level before the increment.
- Diving: from `DIVE_FROM_LEVEL` on, lanes 2 and 4 follow the dive phase. The dive clock `diveClock` (s) starts at 0 on each run, advances with `dt` whenever the game is not paused (also during death and clear animations) and is never reset by a new attempt. At level 1 turtles never dive. While submerged, `platformAt` returns no platform for that lane, so a toad on it drowns on the next frame (`drowned`). Warning phase turtles are still safe and drawn at 60% size with a lighter shell. Submerged turtles are drawn as `turtleSunk` ripples. Lane 4 is offset by 3.5 s so the two lanes never sink together.
- Fly: at every new attempt (run start, after a death, after a slot is filled, after a round clear), if no fly is on screen and at least one slot is empty, roll `FLY_CHANCE`. On success a fly appears in a random empty slot for `FLY_LIFETIME` seconds, blinking during the last `FLY_BLINK` second. Its timer runs only while the toad is alive and the game is not paused. Filling the fly's slot adds `FLY_POINTS` on top of the slot score and removes the fly. If it expires it disappears with no effect. A fly never makes a slot lethal.
- Extra life: the engine keeps `nextLifeAt` (starts at `EXTRA_LIFE_EVERY`). Whenever `score >= nextLifeAt`, `lives` goes up by 1 (if below `MAX_LIVES`) and `nextLifeAt += EXTRA_LIFE_EVERY`; at the cap the threshold is still consumed. A single large gain that crosses two thresholds grants two lives.
- Sound: the engine owns a `createSoundBank(SOUND_URLS)`. `hop` plays on every applied hop; `splat` on `run-over`; `splash` on `drowned`, `swept` and `bushed`; `splat` also on `time`; `home` on a slot fill (including a fly slot); `clear` on a round clear instead of `home`. `pause()` calls `suspend()`, `resume()` calls `resume()`, `destroy()` calls `destroy()`. Muted by default, `M` is handled by `GamePlayer`, the engine never binds it.
- `onChange` fires only when `score`, `lives`, `level`, `home`, `time` or `state` changes.
- The canvas still draws no text. The fly is drawn as a small yellow shape in its slot with no glow.

## Implementation plan

1. **Level and speed ramp.** Add `level` to the snapshot type, `levelSpeedMul(level)` and `attemptTime(level)` helpers, apply the multiplier to lane advance and carrying, and make round clear add `CLEAR_POINTS × level` and raise the level. Keep the registry entry compiling by adding `level: 1` to `initialSnapshot` and a LEVEL stat. Check: `npm run lint` and `npm run build` pass; after one round clear HUD LEVEL reads `02`, TIME starts at `28s` and lanes are 12% faster.
2. **Extra lives.** Add `nextLifeAt`, the life grant and the `MAX_LIVES` cap. Check: with 9,990 points on screen, filling a slot (50+ points) raises LIVES by 1 at the moment the score crosses 10,000.
3. **Diving turtles.** Add `diveClock`, the phase helper, the `diving` argument of `platformAt`, the warning and submerged drawing. Check: at level 2 the turtle lanes sink in a repeating cycle; a toad riding a submerged turtle drowns; at level 1 nothing sinks.
4. **Bonus fly.** Add `Fly` state, the roll at each new attempt, expiry, blinking, the pickup and `FLY_POINTS`. Check: over several attempts a yellow fly sometimes appears in an empty slot, blinks in its last second, vanishes after 4 s, and landing in its slot adds 200 on top of the slot score.
5. **Sound.** Generate the five WAVs into `public/games/toadroad/sounds/`, create the sound bank in the engine, trigger it per the Conventions, and wire `suspend`, `resume`, `destroy`. Set `sound: true` in the registry entry. Check: `/games/toadroad/sounds/hop.wav` returns 200; with `localStorage["av:muted"] = "0"` set by hand, a hop plays after the first key press; MUTE and `M` toggle it.
6. **HUD and cover polish with `/frontend-design`.** The HUD now has SCORE plus LIVES, LEVEL, HOME and TIME, and the MUTE button. Check at 375 px that nothing overflows; if it does, drop the HOME stat (the filled slots already show it on the canvas) and update the criteria that mention HOME. Check `cover-rana` again on `/games`, `/games/toadroad` and the home rail.
7. **Verification pass.** Run `npm run lint` and `npm run build`, then every criterion below, the criteria of spec 01 that still hold, and the Asteroids, Tetris, Arkanoid and Snake regression.

Before writing code, read `node_modules/next/dist/docs/` for static files in `public/`, Client Components and dynamic `import()` and lazy loading.

## Acceptance criteria

Every criterion of spec 01 still holds at level 1. Three of them change after a round clear: the next round runs faster instead of "at the same lane speeds", round clear adds `1000 × level` (the same 1000 at level 1), and the HUD gains LEVEL and the MUTE button. Added here:

- [ ] `npm run lint` and `npm run build` finish with no errors, and `npm run db:types` shows no diff (no new migration).
- [ ] `/games/toadroad/play` shows HUD LIVES, LEVEL, HOME, TIME and SCORE, and the MUTE button; the controls legend lists the `M` row.
- [ ] HUD values (SCORE, LIVES, LEVEL, HOME, TIME) always match the engine.
- [ ] A new run and PLAY AGAIN start at LEVEL `01`, 3 lives, TIME `30s`.
- [ ] Filling the fifth slot adds `1000 × level` points (1000 at level 1, 2000 at level 2), then LEVEL goes up by 1 and HOME returns to `0/5`.
- [ ] At level `n` every lane moves at `min(2.0, 1 + 0.12 × (n − 1))` times its table speed (level 2 is 12% faster, level 10 and beyond is exactly 2.0 times), and the toad on a log is carried at the scaled speed.
- [ ] The attempt timer starts at `30s` at level 1, `28s` at level 2 and never below `20s` (level 6 and beyond).
- [ ] At level 1 turtles never sink. From level 2 the turtles in rows 2 and 4 follow the cycle: up 4.5 s, sinking (smaller, lighter) 1 s, submerged 1.5 s, repeat; the two lanes are offset by 3.5 s.
- [ ] A toad standing on a submerged turtle loses a life with the drowning animation; a toad on a sinking (warning) turtle is still safe.
- [ ] A bonus fly appears sometimes (about 40% of attempts) in an empty slot only, never two at once, blinks in its last second, and disappears after 4 s.
- [ ] Landing in the fly's slot adds `50 + 10 × ceil(seconds left) + 200` points; landing in another slot adds no bonus; the fly never makes a slot lethal.
- [ ] Crossing 10,000 points gives exactly 1 extra life, crossing 20,000 another; LIVES never shows more than 5; PLAY AGAIN resets the next extra life to 10,000.
- [ ] Sound: muted by default; MUTE and `M` toggle it and persist across reloads; unmuted, `hop.wav` plays on every hop, `splat.wav` on a run-over or timeout, `splash.wav` on drowning, being swept away or hitting a bush, `home.wav` on a slot, `clear.wav` on a round clear.
- [ ] Pausing suspends the audio and resuming restores it; no audio plays after leaving the play page; no console autoplay errors.
- [ ] Assets: the network panel shows no 404 for the five WAVs; blocking one leaves that sound silent, logs once and does not crash the game.
- [ ] At 375 px wide the HUD with five stats and the MUTE button does not overflow and the canvas fits the CRT with no horizontal scroll.
- [ ] Pausing freezes the dive clock, the fly timer, the attempt timer and the lanes; resuming does not make turtles surface or sink out of phase.
- [ ] The score never exceeds 9,999,999 in the HUD or in the saved row, including with the level bonus.
- [ ] SAVE SCORE still shows `SAVING…` then `SAVED — RANK #N` and the score appears in the Hall of Fame, the detail "TOP SCORES" and home "LATEST SCORES".
- [ ] Asteroids, Tetris, Arkanoid and Snake still play and save exactly as before; Arkanoid keeps its MUTE button, Snake still shows none.

## Decisions

- **Yes:** the levels, the speed ramp and the timer shrink. Agent's choice (game jam). The description gives no progression, and rising difficulty is what lets a better player keep scoring.
- **Yes:** `+12%` speed per level capped at `2.0`. Agent's choice (game jam). The cap keeps lanes passable: at 2.0 the fastest lane is 300 px/s with gaps of at least 150 px.
- **No:** an unbounded speed. At some level the lanes become impossible, so the score would cap by design instead of by skill.
- **Yes:** timer `30 s` down to `20 s`, minus 2 s per level. Agent's choice (game jam). Pressure rises, but 20 s still leaves time for 11 hops.
- **Yes:** diving turtles from level 2 on rows 2 and 4. Agent's choice (game jam). The description says "logs/turtles to ride"; diving is the natural reason to prefer one over the other.
- **No:** diving at level 1. A new player should learn the river first.
- **Yes:** the warning phase is still safe. Agent's choice (game jam). The player gets a visible cue before the drowning, so a death is never a surprise.
- **Yes:** the dive clock never resets on a new attempt. Agent's choice (game jam). Resetting it would let a player abuse the cycle by dying on purpose.
- **Yes:** bonus fly, 40% per attempt, 4 s, 200 points. Agent's choice (game jam). It adds a risk-reward choice without touching the core rules.
- **Yes:** an extra life every 10,000 points, cap 5. Agent's choice (game jam). The first one is reachable within a few rounds, and the cap avoids runs that never end.
- **Yes:** round-clear bonus `1000 × level`. Agent's choice (game jam). Higher levels pay more, and level 1 matches spec 01.
- **Yes:** sound with five synthesized WAV effects, muted by default, `sound: true`. Agent's choice (game jam). The shared audio module and MUTE exist; the Arkanoid MP3s do not fit.
- **No:** reusing the Arkanoid MP3s or copying sounds from `references/`. They do not match hops, splashes and crashes, and `references/` is never modified.
- **No:** music. It needs its own assets and mixing; a later spec if it lands.
- **Yes:** the WAV generator is a throwaway script, not committed. Agent's choice (game jam). The repo keeps only the assets and the engine.
- **Yes:** if the HUD overflows at 375 px, drop HOME. Agent's choice (game jam). The filled slots already show the same information on the canvas.
- **Yes:** same lane table at every level. Agent's choice (game jam). New layouts per level would need their own tuning; speed is enough progression for now.
- **Yes:** no schema change and no seed. The `toadroad` row from spec 01 is enough.

## Risks

| Risk                                                        | Mitigation                                                                                                    |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| StrictMode double mount starts two loops or two sound banks | `destroy()` cancels the rAF, removes input and destroys the sound bank; `GameCanvas` guards with `cancelled`. |
| Autoplay policy blocks audio                                | The sound bank unlocks on the first `pointerdown` or `keydown`; muted by default.                             |
| Synthesized WAVs sound harsh or clip                        | Keep peak amplitude at about 0.6 and under 60 KB each; the player can mute.                                   |
| `dt` jump after pause shifts the dive phase                 | `dt` cap of 0.05 s and `lastTime` reset on resume; the dive clock only advances with capped `dt`.             |
| Speed ramp makes the road impassable                        | Capped at 2.0; vehicle gaps are at least 230 px and a hop covers 50 px.                                       |
| A toad stuck on a submerged turtle with no cue              | The warning phase lasts 1 s and is drawn smaller and lighter.                                                 |
| HUD with five stats and MUTE overflows on small screens     | Step 6 checks 375 px and allows dropping HOME.                                                                |
| Large score gains grant many lives at once                  | Each threshold grants one life; the cap of 5 limits the effect.                                               |
| Scores forgeable until Auth                                 | Accepted in SPEC 07.                                                                                          |

## What is **not** in this spec

- Crocodiles, otters, snakes and other special enemies.
- New lane layouts per level.
- Music.
- Touch controls, gamepad and mouse.
- Two-player mode.
- Anti-cheat, server-verified scores and Auth.
- Schema changes, a plugin system beyond the registry, and redirects.
- Any change to `references/`.

Each one of those, if it lands, goes in its own spec.
