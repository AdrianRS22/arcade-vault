# SPEC GJ-neon-duel-02 — NEON DUEL: progression

> **Status:** Draft
> **Depends on:** SPEC 06, SPEC 07, SPEC 08, SPEC 09, SPEC 11, SPEC GJ-neon-duel-01
> **Date:** 2026-11-11
> **Objective:** Make NEON DUEL a run that grows with the player: an adaptive CPU, levels, a win streak multiplier, a spin bonus, extra lives, and sound with MUTE.

## Why this spec exists

Spec 01 delivers a complete duel, but its CPU only follows a fixed ramp (+10 px/s per point won). The game jam description asks for an adaptive CPU and rally streaks. This spec replaces the ramp with a skill value that follows how the player is doing, and adds levels, the multiplier, the spin bonus, extra lives and sound on top of the existing engine.

Nothing here changes the field, the physics, the controls or the seed. The engine, registry entry and snapshot from spec 01 are extended, not rewritten. The `cover-duelo` cover is already in place.

Sound follows Arkanoid (SPEC 09): the shared `lib/games/shared/audio.ts` module and the MUTE control already exist, so the game only declares `sound: true` and plays effects through `createSoundBank`. The effects are short synthesized WAV files generated once by a throwaway script that is not committed.

## Scope

**In:**

- Adaptive CPU: a `skill` value in `0..1` that rises when the player wins points and falls when the CPU scores, and sets the CPU speed, aim error and reaction point. It replaces `CPU_SPEED_PER_POINT` and the `won`-based `cpuSpeed` of spec 01.
- Levels: `level = 1 + floor(won / 5)`, a faster serve per level and a floor under the CPU skill that rises per level.
- Win streak multiplier: consecutive points won raise a score multiplier from ×1 to ×3.
- Spin bonus: winning a point with a strongly curved last hit adds `50 × level`.
- Extra life: +1 life every 3 levels reached, up to 5 lives.
- Sound and MUTE: five effects, `sound: true` in the registry entry, muted by default.
- Registry entry updated: HUD LIVES, LEVEL and RALLY (with the multiplier), `sound: true`.
- Level-up flash on the field border, and a ball tint while it is strongly curved.
- Cover and HUD polish with `/frontend-design`.

**Out of scope (for future specs):**

- Power-ups, obstacles, multi-ball and special paddles.
- Boss opponents with their own rules.
- Two-player mode, mouse and gamepad.
- Skins (`classic`, `neon`, `retro`): `skin-designer` adds them afterwards.
- Music (only short effects).
- Anti-cheat, server-verified scores, Auth.
- Any change to `references/`.
- Schema changes, a plugin system beyond the registry, redirects.

## Data model

No schema change: `scores` and `submit_score` are generic per `game_id`. The seed from spec 01 is not touched.

Snapshot (extends spec 01; `NeonDuelSnapshot` in `types.ts`):

```ts
export type NeonDuelSnapshot = {
  score: number; // 0..9_999_999, clamped
  lives: number; // 3 at start, max 5
  won: number; // points won this run
  level: number; // 1 + floor(won / POINTS_PER_LEVEL)
  rally: number; // paddle hits in the current (or last) point
  mult: number; // 1, 1.5, 2, 2.5 or 3
  state: NeonDuelState;
};
```

Files:

- `lib/games/neon-duel/skill.ts` (new): `nextSkill(skill, event, level)`, `skillFloor(level)`, `cpuParams(skill)` returning `{ speed, aimError, reactX }`. Pure functions, no module state.
- `lib/games/neon-duel/cpu.ts`: `cpuSpeed(won)` is removed; the engine reads `cpuParams(skill)`.
- `lib/games/neon-duel/sound.ts` (new): the sound names and URLs.
- `lib/games/neon-duel/constants.ts`: new constants below; `CPU_SPEED_PER_POINT` and `CPU_BASE_SPEED` are replaced.
- `lib/games/neon-duel/engine.ts`: level, skill, streak, bonus, extra life, flash, sound calls.
- `public/games/neon-duel/paddle.wav`, `wall.wav`, `score.wav`, `lose.wav`, `serve.wav`.

New constants:

```ts
export const POINTS_PER_LEVEL = 5; // level = 1 + floor(won / 5)
export const SERVE_SPEED_PER_LEVEL = 20; // px/s added per level
export const SERVE_SPEED_MAX = 520; // px/s
// serveSpeed(level) = min(SERVE_SPEED_MAX, SERVE_SPEED + SERVE_SPEED_PER_LEVEL * (level - 1))

export const SKILL_START = 0.3;
export const SKILL_UP = 0.06; // per point won by the player
export const SKILL_DOWN = 0.1; // per point won by the CPU
export const SKILL_FLOOR_PER_LEVEL = 0.05; // floor = min(0.6, 0.05 × (level - 1))
export const SKILL_FLOOR_MAX = 0.6;
export const CPU_SPEED_MIN = 300; // px/s at skill 0
export const CPU_SPEED_MAX = 560; // px/s at skill 1
export const CPU_AIM_ERROR_MIN = 45; // px at skill 0
export const CPU_AIM_ERROR_MAX = 8; // px at skill 1
export const CPU_REACT_X_MIN = 350; // ball.x to start tracking at skill 0
export const CPU_REACT_X_MAX = 150; // ball.x to start tracking at skill 1
// every CPU parameter is a linear interpolation between its two values by skill

export const STREAK_STEP = 0.5; // multiplier added per consecutive point won
export const MULT_MAX = 3;
// mult = min(MULT_MAX, 1 + STREAK_STEP * winStreak)

export const SPIN_BONUS_MIN = 250; // |spin| of the player's last hit
export const SPIN_BONUS = 50; // × level
// point score = round((POINT_POINTS * level + RALLY_POINTS * rally + spinBonus) * mult)

export const EXTRA_LIFE_EVERY_LEVELS = 3; // +1 life on reaching level 4, 7, 10…
export const MAX_LIVES = 5;
export const FLASH_TIME = 0.5; // s, field border flash on level up
```

`PALETTE` gains: curved ball tint `--magenta` (`#ff006e`) while `|spin| >= SPIN_BONUS_MIN`, and the level-up flash colour `--green` (`#00ff88`).

Sound effects (synthesized, 16-bit mono WAV, 22,050 Hz, under 20 KB each):

| Name     | When                                   | Shape                                  |
| -------- | -------------------------------------- | -------------------------------------- |
| `paddle` | The ball hits either paddle            | 440 Hz square blip, 60 ms              |
| `wall`   | The ball bounces off the top or bottom | 330 Hz triangle blip, 40 ms            |
| `serve`  | The ball launches                      | 880 Hz sine blip, 80 ms                |
| `score`  | The player wins a point                | Rising arpeggio 523, 659, 784 Hz, 300 ms |
| `lose`   | The CPU wins a point                   | Falling sweep 400 to 120 Hz, 400 ms    |

Conventions (all of spec 01 still apply, including the physics, `dt` cap 0.05, DPR cap 2, controls, `onChange` only on change, `onGameOver` once, and no HUD or GAME OVER text on the canvas):

- Skill: starts at `SKILL_START` on each run. After a point won by the player `skill += SKILL_UP`; after a point won by the CPU `skill -= SKILL_DOWN`; then `skill` is clamped to `[skillFloor(level), 1]`. The CPU uses `cpuParams(skill)` for its speed, its aim error range (± the value, picked per player hit) and its `reactX` (replaces `CPU_REACT_X`). `skill` is engine state and is not in the snapshot.
- Level: recomputed after each point won. On a level change the border flashes for `FLASH_TIME` seconds in the flash colour, and HUD LEVEL updates. The flash runs only while `playing` and not paused.
- Serve speed: each launch uses `serveSpeed(level)`. The ball speed cap `MAX_BALL_SPEED = 900` and `RALLY_SPEEDUP` are unchanged.
- Win streak: `winStreak` counts consecutive points won by the player and resets to 0 when the CPU scores. `mult` in the snapshot is `min(MULT_MAX, 1 + STREAK_STEP × winStreak)`, so it is 1 at the start and after any lost point, and 3 from the 4th point in a row.
- Point score: the multiplier of the streak before this point is applied, so the first point after a loss is ×1. Score is `round((100 × level + 10 × rally + spinBonus) × mult)`, clamped to `MAX_SCORE`.
- Spin bonus: `spinBonus = 50 × level` only if the player made the last hit of the point and `|spin|` right after that hit was at least `SPIN_BONUS_MIN`; otherwise 0. That needs the paddle moving at about 312 px/s or more at contact.
- Extra life: when `level` reaches a multiple of `EXTRA_LIFE_EVERY_LEVELS` plus 1 (levels 4, 7, 10…), `lives += 1`, up to `MAX_LIVES`. It is granted once per level reached.
- Sound: the engine owns a `createSoundBank` created in `createNeonDuelGame`. `pause()` calls `suspend()`, `resume()` calls `resume()`, `destroy()` calls `destroy()`. Sounds play through `isMuted()` inside the bank, so muting needs no engine code.
- `onChange` also fires when `level` or `mult` changes.
- Glow (`shadowBlur`) stays only on the ball.

## Implementation plan

1. **Sound assets.** Generate the five WAV files with a throwaway script run from the session scratchpad (not added to the repo) and save them in `public/games/neon-duel/`. Check: each URL returns 200 on the dev server and plays in a browser; no script is added to the repo.
2. **Constants, types and skill.** Add the new constants, extend `NeonDuelSnapshot` with `level` and `mult`, create `skill.ts` and remove the spec 01 CPU ramp. Check: `cpuParams(0)` gives speed 300, aim error 45, reactX 350; `cpuParams(1)` gives 560, 8, 150; `skillFloor(1) = 0`, `skillFloor(5) = 0.2`, `skillFloor(30) = 0.6`; `npm run build` passes.
3. **Engine logic.** In `engine.ts`: skill updates after each point, levels and serve speed, win streak and multiplier, spin bonus, extra life, flash. Check: `npm run build` passes and a run plays as spec 01 with the new scoring.
4. **Sound.** Create `sound.ts`, create the sound bank in the engine and play the five effects at the events in the table; wire `pause`, `resume` and `destroy`. Check: muted by default, no autoplay console error, effects play after UNMUTE.
5. **Registry entry.** Update `neon-duel` in `lib/games/registry.ts`: `initialSnapshot` adds `level: 1` and `mult: 1`, `hud` returns LIVES (magenta), LEVEL (`01`, yellow) and RALLY (cyan; `12` while `mult` is 1, `12 ×1.5` otherwise), and `sound: true`. WON leaves the HUD (it stays in the snapshot). Check: `/games/neon-duel/play` shows MUTE and the new HUD.
6. **Cover and HUD polish with `/frontend-design`.** Re-check `cover-duelo` and the HUD with LIVES, LEVEL and RALLY at 375 px (the RALLY value with a multiplier is the longest). Check: no overflow.
7. **Verification pass.** Run `npm run lint` and `npm run build`, then every acceptance criterion below and the criteria of spec 01 that still hold.

Before writing code, read `node_modules/next/dist/docs/` for Client Components, dynamic `import()` and lazy loading, and static files in `public/`.

## Acceptance criteria

The criteria of spec 01 still hold, except these, which this spec changes: the CPU speed ramp (replaced by the adaptive skill), the point score `100 + 10 × rally` (replaced by the formula below), the HUD (WON is replaced by LEVEL) and "the game shows no MUTE" (it now does).

- [ ] `npm run lint` finishes with no errors.
- [ ] `npm run build` finishes with no errors.
- [ ] `npm run db:types` shows no diff and `supabase/migrations/` has no new file.
- [ ] `/games/neon-duel/play` shows HUD SCORE, LIVES, LEVEL and RALLY, and a MUTE button.
- [ ] HUD values (SCORE, LIVES, LEVEL, RALLY and its multiplier) always match the engine.
- [ ] Losing opens the GAME OVER modal with the same score as the HUD; PLAY AGAIN restarts with score 0, 3 lives, LEVEL 01, RALLY 0, no multiplier, the CPU skill reset and the `waiting` state.
- [ ] PAUSE, `P` and `Esc` freeze the game, the border flash and the sounds; resuming does not make anything jump; switching tab pauses.
- [ ] At 375 px wide the HUD does not overflow, including `RALLY 12 ×3`.
- [ ] SAVE SCORE shows `SAVING…` then `SAVED — RANK #N`, and the score appears in the Hall of Fame, the detail "TOP SCORES" and home "LATEST SCORES".
- [ ] Asteroids, Tetris, Arkanoid and Snake still play and save exactly as before; Arkanoid's MUTE and NEON DUEL's MUTE share the same persisted state.
- [ ] No secret or service-role key is used.
- [ ] Sound: muted by default; MUTE and `M` toggle it and persist across reloads; no audio after leaving the page; no console autoplay errors; pausing silences it.
- [ ] Assets: the network panel shows no 404 for the five WAV files; blocking one URL leaves that effect silent, with no crash and no GAME OVER.
- [ ] Each effect plays at its event: `paddle` on any paddle hit, `wall` on a top or bottom bounce, `serve` on launch, `score` when the player wins a point, `lose` when the CPU does.
- [ ] LEVEL goes up after every 5 points won (level 2 after the 5th point, level 3 after the 10th).
- [ ] Each level adds 20 px/s to the serve speed (400 px/s at level 2), up to 520 px/s; the ball still never exceeds 900 px/s.
- [ ] The border flashes green for 0.5 s on every level up and the flash does not draw any text.
- [ ] The CPU skill starts at 0.3 on every run and a player who wins several points in a row meets a faster, more accurate CPU than at the start; after the CPU scores it eases off, but never below the level floor.
- [ ] The CPU is never slower than 300 px/s or faster than 560 px/s.
- [ ] Winning points in a row raises the multiplier shown in RALLY: the 1st point of a streak scores ×1, the 2nd ×1.5, the 3rd ×2, the 4th ×2.5, the 5th and later ×3; losing a life resets it to ×1.
- [ ] A point scores `round((100 × level + 10 × rally + spinBonus) × mult)`: at level 1, rally 7, no bonus and ×1 it adds 170; with ×2 it adds 340.
- [ ] Winning a point after a return with a paddle moving fast up or down adds `50 × level` before the multiplier; a return with a still paddle adds none; the ball is tinted magenta while strongly curved.
- [ ] Reaching level 4 and level 7 grants +1 life each; lives never exceed 5; no life is granted at other levels.
- [ ] The score never exceeds 9,999,999 in the HUD or in the saved row.
- [ ] The canvas draws no SCORE, LIVES, LEVEL, RALLY, GAME OVER or restart text.
- [ ] Leaving the play page and coming back runs a single loop and a single sound bank (no doubled sounds, no console errors).

## Decisions

- **Yes:** an adaptive CPU driven by a single `skill` in `0..1` that rises `0.06` per point won and falls `0.10` per point lost. Provided (game jam) as "adaptive CPU"; the numbers are Agent's choice (game jam). Falling faster than rising keeps a struggling player from being buried, and a winning player still meets a harder opponent.
- **No:** machine learning or a model of the player's habits. It is not testable by a checklist and is overkill for a paddle game.
- **Yes:** a skill floor that rises with the level (max 0.6). Agent's choice (game jam). A strong player cannot keep the CPU at a low level by throwing away a few points.
- **Yes:** `skill` is not in the snapshot. Agent's choice (game jam). No HUD stat needs it and it avoids extra `onChange` calls.
- **Yes:** rally streaks as a win streak multiplier ×1 to ×3 (+0.5 per consecutive point), shown next to RALLY. The streak idea is Provided (game jam); the exact form is Agent's choice (game jam). The rally length already pays through `10 × rally`.
- **Yes:** the multiplier of the streak before the point applies to that point. Agent's choice (game jam). The first point after a loss is always ×1, which is easy to read in the HUD.
- **Yes:** spin bonus `50 × level` when the winning ball's last hit was a strongly curved player return. Agent's choice (game jam). It gives the described spin a scoring reason.
- **Yes:** levels every 5 points won, serve speed +20 px/s per level up to 520. Agent's choice (game jam). The ball speed cap stays at 900, so the physics of spec 01 is unchanged.
- **Yes:** +1 life on reaching levels 4, 7, 10…, up to 5. Agent's choice (game jam). It rewards a long run without making it endless.
- **No:** an extra life by score threshold. Levels already mark progress.
- **Yes:** sound with five synthesized WAV files and MUTE, reusing `shared/audio.ts`. Agent's choice (game jam). The description has no sound requirement; a duel gains a lot from hit feedback, and the shared module is ready.
- **No:** music, and reusing the Arkanoid MP3s. They would not fit the effects and add weight.
- **Yes:** the effect files are generated by a throwaway script that is not committed. Agent's choice (game jam). Same approach as the other games with no source sounds.
- **Yes:** WON leaves the HUD and LEVEL takes its place, keeping three non-score stats so the HUD fits at 375 px. Agent's choice (game jam).
- **Yes:** the level-up flash is a border colour change with no text. Agent's choice (game jam). The canvas draws no HUD text.
- **Yes:** no third spec. Agent's choice (game jam). The description has no clear third block (a boss or mode would be filler).
- **Yes:** seed and schema untouched; only `public/games/neon-duel/` and `lib/games/neon-duel/` change.

## Risks

| Risk                                                         | Mitigation                                                                                                                  |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| StrictMode double mount creates two loops or two sound banks | `destroy()` cancels the rAF, removes input and destroys the bank; a criterion checks for a single loop and bank.            |
| Autoplay policy blocks audio                                 | `createSoundBank` creates the `AudioContext` on the first gesture; muted by default.                                        |
| Sound file 404 or slow load                                  | A failed load logs once and leaves that effect silent; a criterion covers a blocked URL.                                    |
| Adaptive CPU feels unfair or rubber-banding                  | Skill moves in small steps, falls faster than it rises, and the CPU speed range is 300 to 560 px/s; all values are constants. |
| A strong player makes the CPU unbeatable at skill 1          | CPU 560 px/s stays below the ball's vertical speed at steep angles (up to about 737 px/s), so angled and spun shots still win points. |
| Multiplier inflates scores too fast                          | Capped at ×3 and reset on every lost point; the score clamp is 9,999,999.                                                   |
| Spin bonus too easy or too hard to trigger                   | Needs `|spin| >= 250`, about 60% of the paddle's top speed at contact; the threshold is a constant.                         |
| RALLY with multiplier overflows the HUD at 375 px            | Step 6 checks it with `/frontend-design`; the value is short (`12 ×3`).                                                     |
| Level-up flash looks like an error                           | Green, 0.5 s, border only; checked in the verification pass.                                                                |
| Scores forgeable until Auth                                  | Accepted in SPEC 07.                                                                                                        |

## What is **not** in this spec

- Power-ups, obstacles, multi-ball and special paddles.
- Boss opponents and extra modes.
- Two-player mode, mouse and gamepad.
- Skins and music.
- Anti-cheat, server-verified scores and Auth.
- Schema changes, a plugin system beyond the registry, and redirects.
- Any change to `references/`.

Each one of those, if it lands, goes in its own spec.
