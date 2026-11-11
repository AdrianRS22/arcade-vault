# LANE SURGE (`lane-surge`) — Game Jam

## Game description

From the pending list in `references/game-suggestions-todo.md` (ARCADE, green): "5-lane dodger + energy cells". Picked at random for the game jam.

## Pitch

Steer a neon ship across five lanes while rows of blocks rush toward you. Every row you slip past scores, and energy cells in the open gaps add more. One block and the run is over. Collect five cells to charge the SURGE, then spend it to smash through blocks for three seconds.

## Specs

| Order | Spec                                             | Variant                           | Depends on                                |
| ----- | ------------------------------------------------ | --------------------------------- | ----------------------------------------- |
| 1     | [01-lane-surge-core.md](01-lane-surge-core.md)   | Classic: steady dodger            | SPEC 06, 07, 08, 11                       |
| 2     | [02-lane-surge-surge.md](02-lane-surge-surge.md) | Surge edition: twist, ramp, sound | SPEC 06, 07, 08, 09, 11, GJ-lane-surge-01 |

Run them in order with `/spec-impl`. Spec 01 leaves a playable game; spec 02 extends it. Both specs are `Draft` until reviewed.

## Agent's choice: review first

These were filled in by the spec writer, not given in the to-do entry:

- **Two variants stacked, not a second catalog row.** Spec 02 is the twist on top of the classic. A separate "classic" entry would duplicate the id and title.
- **Surge mechanic.** Five energy cells charge it, and it lasts 3 seconds in playing time. It smashes blocks instead of granting invulnerability.
- **One life, no extra lives or shields.**
- **Generator guarantee.** Each row keeps one lane open, and the gap moves at most one lane per row.
- **Speed and density ramp.** Level every 20 rows, speed capped at 2.0×, block chance capped at 0.8.
- **Cover.** New `cover-lanes` class (to be designed with `/frontend-design`), so `cover-invaders` stays free for GRID INVASION.
- **Sound.** Five synthesized WAVs, not reused Arkanoid MP3s.
- **Scoring.** 10 per row passed, 50 per energy cell, `100 × level` per level up, `25 × level` per smashed block.
