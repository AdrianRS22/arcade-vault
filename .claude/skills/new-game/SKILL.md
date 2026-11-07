---
name: new-game
description: Designs the spec for a new playable game (with leaderboard) for Arcade Vault, either ported from references/started-games/ or invented from scratch. Builds on the /spec skill, adds the platform's game-integration contract, writes specs/NN-<id>-game.md in Draft and stops.
disable-model-invocation: true
argument-hint: "<references/started-games folder> | <game description>"
allowed-tools: Read, Glob, Grep, Write, AskUserQuestion, Bash(ls:*), Bash(cat:*), Bash(date:*)
---

# /new-game — Spec designer for new playable games

## Session context

Today's date (use this for the spec header, never guess it):
!`date +%F`

Specs that already exist:
!`ls specs/ 2>/dev/null || echo "The specs/ folder does not exist yet"`

`/spec` skill files:
!`ls .claude/skills/spec/ 2>/dev/null || echo "MISSING"`

Spec workflow config:
!`cat specs/.spec-config.yml 2>/dev/null || echo "No specs/.spec-config.yml"`

Reference games available:
!`ls references/started-games/ 2>/dev/null || echo "No references/started-games/ folder"`

Migrations so far:
!`ls supabase/migrations/ 2>/dev/null || echo "No migrations"`

Generic game registry (bootstrap probe):
!`ls lib/games/registry.ts app/_components/games/ 2>&1`

---

This skill produces **one spec** that, once approved and run through `/spec-impl`, adds a real game plus its leaderboard to the platform. **You never write code here**; the only file you create is the spec (and `specs/.spec-config.yml` if missing, per `/spec`).

`/spec` is the authority on **how specs are written**. This skill is a game-specific layer on top of it: it adds the integration contract (`integration-contract.md`) and the game content for each section (`spec-skeleton.md`). If they conflict: `/spec`'s `template.md` wins on structure, `/spec`'s `SKILL.md` wins on flow.

Your replies are in the user's language. The spec text itself is in English, like the existing specs.

## Phase 0 — Gate: the /spec skill must exist

If the session context above shows `MISSING`, or `SKILL.md` or `template.md` is not listed for `.claude/skills/spec/`: **stop**. Tell the user `/new-game` depends on `/spec` and that it can be installed with `npx skills@latest add Klerith/fernando-skills`. Do not write a spec without it.

## Phase 1 — Understand the context

1. Read `.claude/skills/spec/SKILL.md` and `.claude/skills/spec/template.md` in full. They define how questions are asked, when to stop asking, how the spec is written and saved.
2. Read `CLAUDE.md`, `integration-contract.md` and `spec-skeleton.md` (same directory as this skill).
3. Read `specs/06-asteroids-game.md` and `specs/07-games-and-leaderboard-tables.md` (the pattern this skill reproduces), plus the two most recent specs if they are different. Match their language, wording and headings.
4. Decide the modes:
   - **Source mode.** `$ARGUMENTS` matches a folder in `references/started-games/` (by number `03`, slug `tetris` or full name `03-tetris`) → **port**. Anything else → **from scratch**. Empty → ask for a one-sentence description (if it does not fit in one sentence, suggest splitting).
   - **Bootstrap mode.** If `lib/games/registry.ts` does not exist, the generic registry has not been built yet: the spec must include the "generalize the player" steps from the contract. If it exists, the spec only adds a registry entry. Also check the code in `lib/games/` and `app/_components/` to confirm what really exists; do not trust the probe alone.
   - **Sound.** If the game uses sounds and `lib/games/shared/audio.ts` does not exist, the spec also bootstraps the shared audio module and MUTE control.

## Phase 2 — Analyze the source and clarify

**Port mode.** Read every file of the reference folder: `README.md`, `CLAUDE.md`, `index.html`, `game.js`, extra scripts (`levels.js`…), `style.css`, `assets/`, its own `specs/`. Show the user a short inventory:

- Mechanics, entities and states.
- Constants (sizes, speeds, points, timers) to preserve.
- Controls, and which keys collide with the platform (`P`, `Esc`) or restart the game (to be removed).
- What the canvas draws that the platform already provides (HUD, GAME OVER overlay, restart prompt): to be removed.
- Globals, `window`/`document` listeners and timers that need cleanup.
- Images and sounds with their paths.
- Stale docs versus code. The code wins (SPEC 06: the reference notes said triple shot and Nova were removed, but the code had them).

**From scratch.** Replace the inventory with questions about mechanics, entities, win/lose conditions and scoring.

Then ask, following `/spec` Phase 2 (blocks of 3 to 5, concrete questions, 2 to 4 options with the recommendation first, use `AskUserQuestion`, wait between blocks):

- **Identity:** `id` slug and `TITLE`. If the title is a commercial trade name, record it in Risks (SPEC 06 did).
- **Catalog row:** `category` (ARCADE, PUZZLE, SHOOTER, VERSUS), `color` (cyan, magenta, yellow, green), `cover` (reuse an existing `cover-*` class from `app/globals.css` or design a new one), `short`, `long`, `sort_order`.
- **HUD:** which stats beyond score (lives, level, lines, next piece…) and how each maps from the snapshot.
- **Controls and mechanics:** keyboard and/or mouse, what is in and out.
- **Assets:** which images and sounds to keep (images and sound are supported; sound is muted by default).
- **Scoring:** integer in 0..9,999,999, what ends a run, whether winning ends the run with a game over.
- Anything that opens Pandora's box (touch, gamepad, multiplayer, Auth, anti-cheat) deserves its own spec: confirm it goes in "Out of scope".

Stop asking when you can answer `/spec`'s three questions without assuming: which files appear or change, what the first and last executable steps are, how to verify it is finished.

## Phase 3 — Write the spec

Follow `/spec` Phase 3: if everything is answered, write the whole spec (no section-by-section confirmation); otherwise go section by section. Sections follow `template.md` order. Fill them with the inventory, the answers, and the game content from `spec-skeleton.md` and `integration-contract.md`.

## Phase 4 — Save the spec

**Pre-write checkpoint**, right before the `Write` of `specs/NN-<id>-game.md`: have you read `.claude/skills/spec/SKILL.md` and `.claude/skills/spec/template.md` in this session? If not, read them now and re-check the draft against the template's sections and `/spec` Phase 4 rules. The spec file is never created without passing this check.

Then follow `/spec` Phase 4:

1. Next number = highest in `specs/` + 1, zero padded. File: `specs/NN-<id>-game.md`.
2. Date from the session context only.
3. `Status: Draft`, never `Approved`.
4. `Depends on: SPEC 06, SPEC 07` (plus the spec that bootstraps the registry or audio, if one exists). Verify every referenced spec exists in `specs/`.
5. Do not ask permission to write; only ask if the target file already exists.
6. Create `specs/.spec-config.yml` only if missing, with the default content from `/spec`; never overwrite it.
7. Confirm: path, `Draft` state, remind the user to review and set `Approved`, next step `/spec-impl NN-<id>-game`. **Stop.** Do not propose implementing or write code.

## Hard rules

- All of `/spec`'s Hard rules apply verbatim.
- Never write code, migrations or assets. Never modify `references/`.
- No database schema change unless the game truly needs one: `games`, `scores`, `submit_score`, the views and `saveScore` are generic per `game_id`. Only a seed migration is needed.
- Every acceptance criterion is checkable (a command, a URL, a key press with an observable result).
- UI work in the spec says to use the `/frontend-design` skill. The spec tells the implementer to read `node_modules/next/dist/docs/` before writing Next.js code.
- Never decide for the user: id, title, category, color, cover, HUD and scoring are confirmed in Phase 2.
