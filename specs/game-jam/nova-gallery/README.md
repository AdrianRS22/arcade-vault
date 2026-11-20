# NOVA GALLERY (`nova-gallery`) — Game Jam

## Game description

From the pending list in `references/game-suggestions-todo.md` (SHOOTER, magenta): "shooting gallery lanes, decoys, reload R". Picked at random for the game jam (roll 15 over the 19 eligible pending entries, excluding the first entry, the easiest one and games that already have a game-jam folder). The jam asked for two distinct playable variants of the same base game.

## Pitch

Three neon conveyor lanes slide drones, comets and rare nova stars across the gallery. Aim with the keyboard or the mouse, keep a hit streak for up to x4 points, reload six shots with `R` and never shoot a green decoy. Hit the stage quota before the 30-second clock runs out; stages repeat forever, faster each time. The twist, NOVA NIGHT, turns the lights off: only a spotlight around the crosshair shows which targets are decoys, and one flare per stage lights the whole gallery.

## Specs

| Order | Spec                                                     | Variant                                             | Catalog row          | Depends on                              |
| ----- | -------------------------------------------------------- | --------------------------------------------------- | -------------------- | --------------------------------------- |
| 1     | [01-nova-gallery-classic.md](01-nova-gallery-classic.md) | Classic: lit gallery, quota, streaks, `R` reload    | `nova-gallery`       | SPEC 06, 07, 08, 11                     |
| 2     | [02-nova-gallery-night.md](02-nova-gallery-night.md)     | Night: dark gallery, spotlight, one flare per stage | `nova-gallery-night` | SPEC 06, 07, 08, 11, GJ-nova-gallery-01 |

Run them in order with `/spec-impl` or `/spec-impl-game`. Spec 01 leaves a playable game with its own leaderboard; spec 02 adds a second row that reuses its engine. Both specs are `Draft` until reviewed.

## Agent's choice: review first

These were filled in by the spec writer, not given in the to-do entry:

- **Two catalog rows, not a mode switch.** Scores key only on `game_id`, so the night variant is `nova-gallery-night` (title NOVA NIGHT, cyan), like `slide-core-rush`.
- **Lose condition.** 3 lives; a decoy hit or a missed stage quota (30 s clock) costs one.
- **Targets and points.** Drone 100, comet 250, nova star 500, decoy 0 (and a life).
- **Streak multiplier.** x2 from 5 hits, x3 from 10, x4 from 20; a miss resets it.
- **Ammo.** 6 shots, 0.9 s manual reload, no auto-reload.
- **Difficulty curve.** Quota 10 + 2 per stage (night: 8 + 2), lane speed +8% per stage capped at 2.2x, decoys up to 30%, night spotlight 130 px shrinking to 80 px.
- **Controls.** Arrows / `W A S D` / mouse aim, `Space` or click fire, `R` reload, `F` flare (night). Touch: D-pad, FIRE, RELOAD (+ FLARE). No tap-to-shoot.
- **No stage clock stat.** The clock is a bar on the canvas, to keep the HUD at four stats (five in night).
- **No sound.** No suitable source assets; `M` stays free.
- **Covers.** New `cover-gallery` (magenta) and `cover-gallery-night` (cyan spotlight), both designed with `/frontend-design`.
- **Sort orders and timestamps.** `8` / `9` and `20261119120000` / `20261119120100`, past the values planned by `lane-surge` and `slide-core`.
- **Skins.** Spec 01 ships `classic` only; `neon` and `retro` come from `/skin-designer nova-gallery`.
