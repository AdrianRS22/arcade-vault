# SPEC 12 — Gamepad appearance

> **Status:** Implemented
> **Depends on:** SPEC 11
> **Date:** 2026-11-10
> **Objective:** Restyle the on-screen touch controls of SPEC 11 to look like the neon "Gamepad MK-II" reference in `references/gamepad-assets/`, without changing their behavior.

## Why this spec exists

SPEC 11 shipped working touch controls with a functional, flat look (square grid arrows, clipped-corner text buttons). `references/gamepad-assets/` holds the target design: a console shell with a cross D-pad, a pulsing hub gem and glossy round A/B buttons. This spec only changes how the controls look.

## Scope

**In:**

- A gamepad shell around `.touch-controls`: rounded panel with dark vertical gradient, `--line` border, inner cyan border (`::before`), dot-grid texture (`::after`), cyan drop glow, as in `.gp` of the reference.
- D-pad as in the reference: separate raised keys (`.dp` gradient, bottom 4px shadow, inner highlights), a center hub with a pulsing diamond gem (`pulse-led`), and the lit state (`translateY(3px)`, cyan border, inner/outer cyan glow, `drop-shadow` on the arrow).
- Action buttons as glossy round buttons (`.ab` of the reference): radial highlight, colored ring border, bottom shadow, colored glow, dashed `ab-ring` shown when lit, pressed transform.
- Each button shows a big pixel-font letter inside (A, B, …) and its existing game label (`FIRE`, `ROTATE`…) as a small pixel-font caption under it.
- Letter assignment: `buttons[0]` is **A** and is drawn on the **right**; `buttons[1]` is **B** to its left (general rule: letters A, B, C… by index, drawn right to left).
- Colors come from the existing `variant` (`cyan` / `magenta` / `yellow` / `green`, default `cyan`): each variant defines the reference's `--ab-mid`, `--ab-deep`, `--ab-glow`.
- Games with no buttons (Arkanoid, Snake) keep the full shell with the D-pad on the left and empty space on the right.
- Disabled D-pad directions stay drawn but dim and inert (same rule as SPEC 11).
- Phone portrait sizing: hit areas stay ≥56×56 CSS px and the CRT + controls still fit in 375×812 with no horizontal scroll.
- `prefers-reduced-motion: reduce` stops the gem pulse.
- UI built with the `/frontend-design` skill.

**Out of scope:**

- Any behavior change: `virtual-keys.ts`, pointer handling, multi-touch, D-pad slide, auto-repeat, release rules, `disabled` handling stay as in SPEC 11.
- Showing the gamepad on desktop, mouse hover states, or lighting it from the physical keyboard (the media query `(hover: none) and (pointer: coarse)` stays the only gate).
- Changes to `TouchLayout` / `TouchButton` types, the `touch` entries in `lib/games/registry.ts` or `integration-contract.md`.
- Per-game skin (classic/neon/retro) variants of the gamepad.
- Engine changes, landscape layout, vibration.
- Any change to `references/`.

## Data model

No new data, no type changes, no persistence. The letter is derived at render time from the button index (`String.fromCharCode(65 + i)`).

## Implementation plan

1. **Markup.** In `app/_components/games/touch-controls.tsx`: wrap D-pad and actions in a shell structure (`.touch-controls` keeps its role/aria and pointer handlers untouched; add an inner body if needed); replace the hub `span` with hub + gem; each action button renders the letter (`.touch-letter`) and the dashed ring (`.touch-ring`), plus the caption (`.touch-caption`, `aria-hidden`) under it; render buttons so A ends up on the right (CSS `flex-direction: row-reverse` or reversed order, keeping `key` by label). `aria-label` stays the game label ("Fire"). Check: `npx tsc --noEmit` and lint pass.
2. **CSS.** In `app/globals.css`, replace the `.touch-*` visual rules (base and the portrait coarse-pointer block) with the reference look: shell, raised D-pad keys in a cross with hub/gem, round glossy buttons with per-`variant` custom properties, lit states driven by the existing `data-lit="true"`, `aria-disabled` dim state, reduced-motion rule. Keep: hidden by default, shown only under coarse pointer, `touch-action: none`, no selection/callout rules, `.controls-legend` hidden. Remove the old even-button stagger. Check: lint passes.
3. **Width/height budget.** Portrait phone sizes: D-pad cells 56px (box 168px, D-pad keeps a single pointer target), round buttons ≥60px, shell padding/gaps tuned so the shell fits the 375px viewport content width and `.crt` top → `.touch-controls` bottom ≤ 812px. Check with Playwright measurement.
4. **Verification pass.** `npm run lint`, `npm run build`, then the acceptance criteria with Playwright mobile emulation (375×812, `hasTouch`, `isMobile`) and desktop 1440×900. Screenshots of the four games in `.playwright-screenshots/` (`spec-12-<id>-mobile.png`, plus one with a button and an arrow lit). Visual comparison against `references/gamepad-assets/gamepad-neon.png`.

## Acceptance criteria

- [x] `npm run lint` and `npm run build` finish with no errors.
- [x] No file in `lib/games/` (registry, engines, `shared/`) changed; only `touch-controls.tsx` and `app/globals.css`.
- [x] At 375×812 with touch emulation, all four play pages show the controls inside a rounded shell with inner border and dot texture, D-pad on the left.
- [x] The D-pad is a cross of separate raised keys with a center hub containing a cyan diamond gem that pulses; with `prefers-reduced-motion: reduce` it does not animate.
- [x] Asteroids shows A (FIRE) on the right and B (NOVA) to its left; Tetris shows A (ROTATE, yellow) on the right and B (DROP, magenta) on the left; each round button has its letter inside and its label caption below.
- [x] Button border, glow and gradient match each `variant` color.
- [x] Arkanoid and Snake show the shell with only the D-pad; the right side is empty.
- [x] Holding an arrow shows the pressed/lit style (shifted down, cyan border and glow); holding a button shows the pressed style with the dashed ring visible; releasing restores them.
- [x] Disabled D-pad directions (e.g. ↓ in Asteroids) are dim and emit nothing.
- [x] Every arrow and button keeps a hit area ≥56×56 CSS px.
- [x] At 375×812, `.crt` top → `.touch-controls` bottom ≤ 812px and `scrollWidth === clientWidth`.
- [x] At 1440×900 desktop the controls stay hidden and the keyboard legend is visible.
- [x] All SPEC 11 behavior criteria still pass (multi-touch, D-pad slide, Tetris auto-repeat, release on pause/game over, no selection/callout, no focus steal).
- [x] Screenshots of the four games at 375×812 are saved in `.playwright-screenshots/`.

## Decisions

- **Yes:** letter inside + game label caption below (user's choice). Faithful to the A/B look without losing what each button does.
- **No:** label inside the circle, or letter only.
- **Yes:** keep `variant` colors (user's choice); the registry is not touched.
- **No:** forcing magenta A / cyan B.
- **Yes:** full console shell (user's choice).
- **Yes:** touch-only visibility as in SPEC 11 (user's choice); no hover or keyboard lighting.
- **Yes:** `buttons[0]` = A on the right, under the thumb (user's choice); no `letter` field added.
- **Yes:** hit areas ≥56px over the reference's 46px mobile size (user's choice); SPEC 11's criterion wins.
- **Yes:** empty right side when a game has no buttons (user's choice).
- **Yes:** reduced-motion stops the gem pulse (agent's addition, accessibility; no behavior impact).
- **No:** reusing `references/gamepad-assets/gamepad.html` script; behavior already exists in SPEC 11.

## Risks

| Risk                                                            | Mitigation                                                                            |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Shell padding + 56px cells + round buttons overflow 375px width | Width budget in step 3; measured `scrollWidth` criterion.                             |
| The taller shell breaks the 812px height fit                    | Tight shell padding in the portrait block; measured criterion.                        |
| Restyled children capture pointers and break D-pad slide        | Arrows/hub/gem/caption keep `pointer-events: none`; SPEC 11 behavior criteria re-run. |
| `translateY` on lit keys shifts hit areas                       | Pointer target is the D-pad container, not the arrows.                                |
| iOS text selection on the new caption/letter text               | Existing `.touch-controls *` no-select rules cover new children.                      |

## What is **not** in this spec

- Behavior changes, desktop gamepad, keyboard lighting, skins per game, type/registry changes, landscape layout, `references/` changes.
