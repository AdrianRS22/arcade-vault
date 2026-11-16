# VOID RUNNER (`void-runner`) — Game Jam

## Game description

From the pending list in `references/game-suggestions-todo.md` (SHOOTER, magenta): "vertical-scrolling shooter with waves, weapon swaps and bosses". Picked at random for the game jam. Requested direction: spec 01 is the classic mode (waves, weapon swaps, bosses), and spec 02 is a distinct variant with an original twist chosen by the spec writer.

## Pitch

Fly a neon runner up through the void. Enemy waves pour in from the top, a hauler in every sector drops weapon capsules, and `X` swaps between PULSE, SPREAD and LANCE. After five waves a boss arrives, and every sector after it is faster and pays more. The twist variant, VOID SIPHON, takes the guns away and gives you a siphon field instead. You hold it to drink enemy bullets until it overheats, then let go to fire them back as a ring of bolts.

## Specs

| Order | Spec                                                   | Variant                                                   | Catalog row   | Depends on                                 |
| ----- | ------------------------------------------------------ | --------------------------------------------------------- | ------------- | ------------------------------------------ |
| 1     | [01-void-runner-classic.md](01-void-runner-classic.md) | Classic: waves, three weapons with swap, rotating bosses  | `void-runner` | SPEC 06, 07, 08, 09, 11                    |
| 2     | [02-void-runner-siphon.md](02-void-runner-siphon.md)   | Siphon: absorb bullets, release a burst, chain multiplier | `void-siphon` | SPEC 06, 07, 08, 09, 11, GJ-void-runner-01 |

Run them in order with `/spec-impl-game` (or `/spec-impl`). Spec 01 leaves a fully playable game with its own leaderboard. Spec 02 adds a second catalog row that reuses the same engine with `mode: "siphon"`. Both specs are `Draft` until reviewed.

## Agent's choice: review first

The spec writer filled these in. They were not in the to-do entry or the theme:

- **Two catalog rows, not a mode switch.** Scores key only on `game_id`, and a siphon run is not comparable with a weapon run, so the variant is its own row `void-siphon` (title VOID SIPHON, cyan, at `/games/void-siphon/play`).
- **Twist.** A siphon field with a heat gauge, not polarity colours. Polarity switching is the signature of a known commercial shooter. A single heat-limited field with no colours keeps the variant original.
- **Structure.** 5 waves then a boss per sector. 8 wave templates rotate. 3 bosses (MAW, LOOM, CROWN) rotate, with +50% HP on each loop of the three.
- **Weapons.** PULSE (start), SPREAD and LANCE (piercing), each with levels 1–3. Haulers always drop a capsule. Getting hit costs one life and one level of the current weapon.
- **Scoring.** Enemy points × sector, a perfect-wave bonus of `500 × sector`, a boss bonus of `5,000 × sector`, and 200 per capsule (1,000 once that weapon is at level 3). In siphon mode a chain multiplier from ×1 to ×8 applies to every point.
- **Difficulty ramp.** Enemy speed, shot speed, fire rate and HP rise per sector, each with a cap.
- **Controls.** Arrows or `W A S D` move in 8 directions, `Space` fires while held, and `X` swaps (classic) or holds the siphon (siphon). `P`, `Esc` and `M` are left to the platform.
- **No image assets.** Every ship, enemy and boss is vector-drawn, so all three skins can restyle them. Sounds are synthesized WAVs.
- **Skins.** `classic`, `neon` and `retro` are all defined in spec 01. Spec 02 adds the field colours to each one.
- **Covers.** New `cover-void` (magenta) and `cover-void-siphon` (cyan), both designed with `/frontend-design`.
- **Sort orders and seeds.** `8` and `9`, after the planned `lane-surge` (5) and `slide-core` (6, 7). The seed timestamps are `20261116120000` and `20261116120100`.
