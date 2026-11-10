---
name: skin-designer
description: Makes sure one or more Arcade Vault games have the classic, neon and retro skins, implementing the missing ones. Launches one skin-designer agent per game, in parallel. Usage /skin-designer <game-id...|all>
argument-hint: <game-id...|all>
disable-model-invocation: true
---

# /skin-designer

Arguments: `$ARGUMENTS`, one or more game ids separated by spaces, or `all`.

Subagents cannot launch other subagents, so the parallel fan-out lives here, in the main session.

## Steps

1. **Parse the ids.** `all` means every key of `registry` in `lib/games/registry.ts`. Validate each id against the registry; report unknown ids and skip them. If no valid id is left, say so and stop.
2. **Check the platform.** `lib/games/shared/skins.ts` must exist. If not, tell the user and stop.
3. **Launch the agents in parallel.** In a **single message**, call the `Agent` tool once per game with `subagent_type: "skin-designer"` and a prompt that is just the game id (e.g. `tetris`). Never run them one after another.
4. **Wait for all of them**, then verify once, sequentially:
   - `npx tsc --noEmit`
   - `npm run lint`
   - `npm run build`

   If something fails, fix it (or re-launch the agent for that game only) and re-run.

5. **Optional visual check:** with Playwright, open `/games/<id>/play` for each game that was implemented, switch the three skins and save the screenshots in `.playwright-screenshots/` (keep them).
6. **Summarize** in a table: game, result (`already had skins`, `implemented` or `error`), files changed.

A game that already has the three skins is left untouched by its agent; that is expected and not an error.
