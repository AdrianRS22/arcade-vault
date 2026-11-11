---
name: spec-impl-game
description: Implements an approved game spec exactly like /spec-impl, then runs the skin-designer and mobile-porter agents one after the other on the game.
disable-model-invocation: true
argument-hint: <NN-spec-name>
allowed-tools: Read, Glob, Grep, Edit, Write, AskUserQuestion, Agent, Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(git log:*), Bash(git diff:*), Bash(git stash:*), Bash(cat:*), Bash(ls:*), Bash(npx tsc:*), Bash(npm run lint:*), Bash(npm run build:*)
---

# /spec-impl-game — Implement a game spec, then skins and mobile

## Session context

Current repository state:
!`git status --short`

Current branch:
!`git branch --show-current`

Specs available in this folder:
!`ls specs/ 2>/dev/null || echo "The specs/ folder does not exist"`

Game-jam specs:
!`ls specs/game-jam/ 2>/dev/null || echo "No specs/game-jam/ folder"`

Branch-creation config:
!`cat specs/.spec-config.yml 2>/dev/null || echo "AutoCreateBranch: true (default, no config file)"`

Existing game folders:
!`ls lib/games/ 2>/dev/null || echo "No lib/games/ folder"`

---

## Instructions

The received argument is: `$ARGUMENTS`

This command is `/spec-impl` plus a post-implementation pipeline. `/spec-impl` cannot be invoked from here (it is user-invoked only), so you follow its instructions directly. This keeps a single source of truth.

### Phase 0 — Load `/spec-impl`

Read `.claude/skills/spec-impl/SKILL.md` in full. If it does not exist, stop and tell the user it can be installed with `npx skills@latest add Klerith/fernando-skills`.

Its Phases 1–4 apply **verbatim**, with `$ARGUMENTS` as the argument: spec lookup, Approved-only gate and standard error message, clean working tree check, `AutoCreateBranch` handling, spec summary, step-by-step implementation with pauses, ambiguity handling, out-of-scope handling, and **never commit automatically**. When looking up the spec, also search `specs/game-jam/*/` (game-jam specs live there).

Only two things change:

1. **Game id resolution** (Phase 0b, below).
2. **The closing message** of `/spec-impl` Phase 4 is replaced by Phase 5 below.

### Phase 0b — Resolve the game id

Right after the spec passes `/spec-impl` Phase 2 (state is Approved) and **before** creating the branch, determine the game id:

- From the file name (`NN-<id>-game.md`), or the game-jam folder name (`specs/game-jam/<id>/`), or the `lib/games/<id>/` folder / registry entry the spec creates.
- If the spec is clearly not a game spec, stop and tell the user to use `/spec-impl` instead. No branch, no code.
- If it is ambiguous, ask with `AskUserQuestion`.

Remember the id for Phase 5.

### Phase 5 — Post-implementation agents (sequential)

Runs when the last step of the plan is implemented. No extra confirmation is needed.

1. Confirm the id is now a key of `registry` in `lib/games/registry.ts`. If not, stop and report it; do not launch agents.
2. Launch the `Agent` tool with `subagent_type: "skin-designer"` and a prompt that is just the game id. **Wait for its result.** If it reports an error, show it and ask the user whether to continue with mobile-porter.
3. **Only after** skin-designer has finished, launch the `Agent` tool with `subagent_type: "mobile-porter"` and a prompt that is just the game id. Wait for its result.
   - **Never launch both in the same message and never in parallel**: mobile-porter must audit the final engine and skins, and both agents write shared files.
4. Verify once, sequentially: `npx tsc --noEmit`, `npm run lint`, `npm run build`. If something fails, fix it (or re-launch only the offending agent) and re-run. (mobile-porter itself does not run the build.)
5. Show a summary table: agent, status (`already had skins` / `implemented` / `already passes` / `fixed` / `blocked` / `error`), files changed, and the screenshots in `.playwright-screenshots/` (`mobile-porter-<id>-mobile.png`, `-desktop.png`). Mention any mobile-porter blocker with its recommended change.
6. Finish with `/spec-impl`'s closing reminder:

```
✅ All steps of the plan are implemented, skins and mobile checks done.

Next step: verify the spec's acceptance criteria one by one.
If they all pass, update the spec's state to "Implemented" and make the final
commit before merging this branch.
```

## Hard rules

- Everything in `/spec-impl` applies, including: never commit automatically; implement what the spec says; stop on ambiguities.
- The agents are launched one after the other, skin-designer first, mobile-porter second.
- Do not do the agents' work yourself; only fix verification failures from step 4.
- Reply in the user's language; every file written is in English.
