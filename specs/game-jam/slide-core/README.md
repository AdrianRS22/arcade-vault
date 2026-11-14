# SLIDE CORE (`slide-core`) — Game Jam

## Game description

From the pending list in `references/game-suggestions-todo.md` (PUZZLE, cyan): "4x4 merge-slide, close to a known clone: keep original art/naming". Theme given for the game jam: SLIDE CORE, PUZZLE, cyan, 4x4 merge-slide. Suggested direction: (a) a classic 4x4 merge-slide with a move-count-free score and a game over when no moves remain; (b) a twist such as a timed or move-budget mode, or tiles that must reach a target value.

## Pitch

Slide every tile on a 4x4 board and merge equal numbers into their double. Each merge scores, there is no move counter, and the run ends only when the board is full with no merge left. The timed twist, SLIDE RUSH, runs the same board against a clock that every merge refills.

## Specs

| Order | Spec                                                 | Variant                                  | Catalog row       | Depends on                            |
| ----- | ---------------------------------------------------- | ---------------------------------------- | ----------------- | ------------------------------------- |
| 1     | [01-slide-core-classic.md](01-slide-core-classic.md) | Classic: open-ended merge-slide          | `slide-core`      | SPEC 06, 07, 08, 11                   |
| 2     | [02-slide-core-rush.md](02-slide-core-rush.md)       | Rush: timed merge-slide, clock per merge | `slide-core-rush` | SPEC 06, 07, 08, 11, GJ-slide-core-01 |

Run them in order with `/spec-impl`. Spec 01 leaves a playable game with its own leaderboard; spec 02 adds a second row that reuses its engine. Both specs are `Draft` until reviewed.

## Agent's choice: review first

These were filled in by the spec writer, not given in the to-do entry or the theme:

- **Two catalog rows, not a mode switch.** Scores key only on `game_id`. A timed run and a classic run on one leaderboard would not be comparable, so the timed variant is `slide-core-rush`.
- **Timed twist.** A 60 s clock, +1 s per merged pair, capped at 90 s. These are first values to tune in review.
- **Spawn odds.** 2 with 90% and 4 with 10%.
- **Logic instant, animation visual only.** Slides take 0.08 s and never block input.
- **One key press is one move.** Holding a key does not repeat moves, which keeps every move deliberate and the same on touch.
- **No win state.** The run is open-ended so better players always score more; no target tile.
- **Score.** The sum of every merge's new value, clamped to `9,999,999`. No move counter.
- **Covers.** New `cover-slide` (classic, cyan) and `cover-slide-rush` (rush, magenta), both designed with `/frontend-design`.
- **Sort orders.** `6` and `7`, the next free values after `lane-surge`'s planned `5`.
- **Skins.** Spec 01 ships only `classic`; `neon` and `retro` come from `/skin-designer slide-core`.
- **No sound.** No shared audio module and no `M` key.
- **Original naming.** Title, copy, cover and tile colors are original, following the to-do note about a known clone.
- **Seed timestamps.** `20261113120000` and `20261113120100`, after the newest existing migration (`20261111140000`).
