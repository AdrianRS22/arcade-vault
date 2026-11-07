# Game spec skeleton

Structure comes from `.claude/skills/spec/template.md`; this file only lists what a game spec puts **inside** each section. Replace every `<...>`. Headings and tone follow SPEC 06 and SPEC 07.

## Header

```markdown
# SPEC NN — <Title> game

> **Status:** Draft
> **Depends on:** SPEC 06, SPEC 07 [, <spec that bootstraps the registry/audio>]
> **Date:** <from session context>
> **Objective:** <One sentence: port/create <Title> as a typed engine played at /games/<id>/play, with its leaderboard.>
```

## Why this spec exists

Only if non-obvious: source of the game (reference folder or new), what makes it differ from Asteroids, and, in bootstrap mode, why the player is generalized now (the second real game).

## Scope

**In** (pick what applies):

- Seed migration with the `games` row (`id`, `title`, `short`, `long`, `category`, `cover`, `color`, `plays = 0`, `sort_order`).
- Engine in `lib/games/<id>/` (no React, no globals) with the mechanics inventoried in Phase 2.
- Assets copied to `public/games/<id>/` (images, sounds) and what is kept.
- Registry entry (or, in bootstrap mode: shared input, `GameEngine` types, `registry.ts`, `game-canvas.tsx`, generic `GamePlayer`, Asteroids moved onto it).
- Shared audio module and MUTE control, if the game has sound and it does not exist yet.
- Cover (reuse `cover-*` or new CSS) and HUD stats, using `/frontend-design`.
- Controls legend for this game.

**Out of scope (always list):**

- Touch and gamepad controls.
- Anti-cheat, server-verified scores, Auth.
- Any change to `references/`.
- Schema changes, a generic plugin system beyond the registry, redirects.
- Game-specific extras left out in Phase 2.

## Data model

- Snapshot type, `GameState`, constants (sizes, speeds, points, timers kept from the reference), `PALETTE`.
- Files list for `lib/games/<id>/`.
- Seed row as SQL.
- Conventions: logical field, units, `dt` cap, controls.
- State explicitly: "No schema change: `scores` and `submit_score` are generic per `game_id`."

## Implementation plan

Numbered, each step leaves the system working, with a **Check** per step:

1. Seed migration, `npm run db:push`, `npm run db:types`, `execute_sql` check (`/games` shows the game; `/games/<id>/play` shows the "not playable yet" state or nothing broken).
2. (Bootstrap only) shared input and `GameEngine` types; move Asteroids onto the registry. Check: Asteroids plays as before.
3. `types.ts`, `constants.ts`, entities.
4. `engine.ts` behind `create<Name>Game`; remove canvas HUD, overlays, restart key; emit changes only on change.
5. Assets and audio (if any).
6. Registry entry (HUD mapping, controls, aria label).
7. Cover and HUD polish with `/frontend-design`.
8. Full verification pass.

End with: "Before writing code, read `node_modules/next/dist/docs/` for ..." (Client Components, `'use cache'`, `cacheTag`, dynamic `import()` as relevant).

## Acceptance criteria (checkboxes, all checkable)

Baseline (always):

- [ ] `npm run lint` finishes with no errors.
- [ ] `npm run build` finishes with no errors.
- [ ] `supabase/migrations/` contains the seed, `npm run db:types` shows no diff, and `games` has the new row with 0 scores.
- [ ] `/games` and `/games/<id>` show the title and description; the home rail lists it.
- [ ] `/games/<id>/play` runs the real engine with the listed controls.
- [ ] HUD values (score and the rest) always match the engine.
- [ ] Losing opens the GAME OVER modal with the same score as the HUD; END opens it with the current score; PLAY AGAIN restarts from the initial state.
- [ ] PAUSE, `P` and `Esc` freeze the game and show PAUSED; resuming does not make objects jump; switching tab pauses.
- [ ] Arrow keys and Space do not scroll the page while playing; typing initials in the modal does not affect the game.
- [ ] Leaving the play page and coming back runs a single loop (normal speed, no console errors).
- [ ] The canvas uses the neon palette, not plain white.
- [ ] At 375 px wide the canvas fits the CRT with no horizontal scroll.
- [ ] SAVE SCORE shows `SAVING…` then `SAVED — RANK #N`; the score appears in the Hall of Fame tab, in the detail "TOP SCORES" and in home "LATEST SCORES"; the game's plays go up by 1.
- [ ] Asteroids still plays and saves exactly as before.
- [ ] No secret or service-role key is used.

Add when applicable:

- [ ] Sound: muted by default, MUTE and `M` toggle it and persist across reloads, no audio after leaving the page, no console autoplay errors.
- [ ] Assets: no 404 in the network panel; a failed load does not crash the page.

Then the game-specific criteria (points per action, level progression, win/lose, each mechanic from the inventory).

## Decisions

`**Yes:**` / `**No:**` lines with a short reason, as in SPEC 06/07. Always cover: port vs rewrite (typed engine, no iframe, no `next/script`), platform HUD and modal instead of canvas HUD, registry vs switch (if bootstrapping), sound scope, title choice (user's), what was dropped from the reference and why, "Quick definition without detailed clarification" if the user skipped questions.

## Risks (table: Risk | Mitigation)

Baseline: StrictMode double mount starts two loops; input steals keys from the modal; blurry canvas on high-DPI; `dt` jump after pause or tab switch; `shadowBlur` cost; autoplay policy blocks audio; asset 404 or slow load; commercial trade name as the title; cached game list not showing the new row until rebuild; scores forgeable until Auth (accepted, SPEC 07). Add game-specific ones.

## What is **not** in this spec

Repeat the Out of scope list and close with: "Each one of those, if it lands, goes in its own spec."
