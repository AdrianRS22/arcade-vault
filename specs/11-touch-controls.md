# SPEC 11 — Touch controls

> **Status:** Approved
> **Depends on:** SPEC 06, SPEC 08, SPEC 09, SPEC 10
> **Date:** 2026-11-09
> **Objective:** Let every playable game be played on a touch-screen phone through an on-screen D-pad and per-game action buttons that emit the same keyboard events the engines already read.

## Why this spec exists

The four games (Asteroids, Tetris, Arkanoid, Snake) are keyboard-only (Arkanoid also takes the mouse). On a phone there is no keyboard, so `/games/[id]/play` loads but nothing can be controlled. SPEC 10 listed "touch controls" as out of scope for a future spec; this is it.

Every engine reads input through `window` `keydown` / `keyup` and `KeyboardEvent.code`, via the shared `createInput` (`lib/games/shared/input.ts`). So an on-screen control that dispatches synthetic `KeyboardEvent`s on `window` drives every game without touching any engine. `createInput` ignores events whose target is a text field; a `window` target is not, so synthetic events pass.

## Scope

**In:**

- A required `touch` field in `GameDefinition` (`lib/games/registry.ts`) that declares which D-pad arrows and which action buttons a game shows, and which codes auto-repeat.
- `touch` layouts for the four registered games (see Data model).
- `lib/games/shared/virtual-keys.ts`: dispatches synthetic `keydown` / `keyup` on `window`, with auto-repeat for the declared codes and `releaseAll()`.
- `app/_components/games/touch-controls.tsx` (Client Component): D-pad on the left, action buttons on the right, under the CRT. Pointer Events with multi-touch (one `pointerId` per finger); sliding a finger across D-pad arrows changes direction without lifting it.
- `GamePlayer` renders `TouchControls` under the CRT; the controls release every held key on pause, on game over and on unmount, and ignore touches while paused or over.
- Visibility by CSS only: shown under `@media (hover: none) and (pointer: coarse)`, hidden otherwise; in that same media query the keyboard legend (`.controls-legend`) is hidden.
- The control itself uses `touch-action: none`, `user-select: none` and no context menu, so a held finger does not scroll, zoom, select text or open the callout (needed for Pointer Events to keep firing; the rest of the page is unchanged, except the play area in the next bullet).
- No text selection and no iOS callout on the play page: on a coarse pointer, `body:has(.av-player)` and all its children (header, HUD, CRT, canvas, site footer) get `user-select: none`, `-webkit-user-select: none` and `-webkit-touch-callout: none`, so a long press on the canvas, a gap or a label never opens "Copy / Search". `.av-player` only exists in `GamePlayer`, so no other page is affected. A real iPhone (Chrome) test showed the menu on the controls, then on the canvas and HUD, then on the footer copyright: iOS selects the nearest text, so protecting only part of the page just moves the selection. Text fields (the GAME OVER initials input) stay selectable and typable. Desktop is unchanged.
- Height fit: on a coarse pointer in portrait, the player margins and CRT padding shrink so the CRT and the touch controls fit together in one phone screen (375×812) without scrolling between them.
- Update `.claude/skills/new-game/integration-contract.md` and the "Game platform" section of `CLAUDE.md` so new games declare `touch`.
- UI pieces use the `/frontend-design` skill (retro/neon look matching `.btn`, `.crt`, `kbd`).

**Out of scope (for future specs):**

- Any engine change (`lib/games/<id>/`) and any change to `createInput`.
- Gestures on the canvas (swipe, tap-to-move, Arkanoid paddle drag).
- Gamepad API.
- Landscape layout with controls at the sides (portrait under the CRT only; landscape just shows the same stack).
- A manual TOUCH ON/OFF toggle or persisting a preference.
- Haptic vibration.
- Fullscreen API, orientation lock, PWA install.
- Blocking zoom or gestures outside the control.
- Changing the HUD, the GAME OVER modal or the on-canvas texts (Snake's "PRESS AN ARROW" stays).
- Any change to `references/`.

## Data model

No persisted data, no schema change, no `localStorage`. Only TypeScript types.

```ts
// lib/games/registry.ts
export type TouchDir = "up" | "down" | "left" | "right";

export type TouchButton = {
  label: string; // pixel-font text on the button, max ~6 chars ("FIRE", "DROP")
  code: string; // KeyboardEvent.code it emits ("Space", "KeyB", "ArrowUp")
  variant?: "cyan" | "magenta" | "yellow" | "green";
};

export type TouchLayout = {
  /** Arrows shown on the D-pad; each emits ArrowUp / ArrowDown / ArrowLeft / ArrowRight. */
  dpad: TouchDir[];
  /** Action buttons on the right, in order. May be empty. */
  buttons: TouchButton[];
  /** Codes that auto-repeat while held (like the OS key repeat). */
  repeat?: string[];
};

// added to GameDefinition<S>
touch: TouchLayout;
```

Layouts:

| Game      | `dpad`                | `buttons`                                         | `repeat`                               |
| --------- | --------------------- | ------------------------------------------------- | -------------------------------------- |
| asteroids | left, up, right       | FIRE `Space` (cyan), NOVA `KeyB` (magenta)        | —                                      |
| tetris    | left, right, down     | ROTATE `ArrowUp` (yellow), DROP `Space` (magenta) | `ArrowLeft`, `ArrowRight`, `ArrowDown` |
| arkanoid  | left, right           | —                                                 | —                                      |
| snake     | up, down, left, right | —                                                 | —                                      |

A D-pad direction not in `dpad` is drawn disabled (dim, no events), so the cross keeps its shape.

```ts
// lib/games/shared/virtual-keys.ts
export const REPEAT_DELAY = 170; // ms before the first repeat
export const REPEAT_INTERVAL = 50; // ms between repeats

export type VirtualKeys = {
  down(code: string): void; // keydown on window; starts repeat if code is in `repeat`
  up(code: string): void; // keyup on window; stops its repeat
  releaseAll(): void; // keyup for every held code
};
export function createVirtualKeys(repeat?: readonly string[]): VirtualKeys;
```

Conventions:

- `down` dispatches `new KeyboardEvent("keydown", { code, key, bubbles: true, cancelable: true })` on `window`; repeats dispatch the same with `repeat: true`. A code already held by another pointer is reference-counted: `keyup` fires only when the last pointer holding it releases.
- `createInput` sets `justPressed` only when the key was not held, so repeats never retrigger one-shot actions (Asteroids FIRE fires once per touch, exactly like holding Space) while Tetris `pressedOrRepeat` sees every repeat.
- D-pad: one element with `setPointerCapture`; the direction is computed from the pointer position relative to the D-pad center (dominant axis, dead zone in the middle ~20% of the radius). On `pointermove` a new direction sends `up(old)` then `down(new)`. `pointerup`, `pointercancel` and `lostpointercapture` send `up`.
- Buttons: each tracks its own `pointerId`; `pointerdown` → `down`, `pointerup` / `pointercancel` / `lostpointercapture` → `up`. `pointerdown` calls `preventDefault()` so the button never takes focus.
- Buttons are `type="button"`, `tabIndex={-1}`, with `aria-label` ("Up", "Fire"…); the wrapper is `role="group" aria-label="Touch controls"`.
- `TouchControls` props: `layout: TouchLayout`, `disabled: boolean` (`paused || over`). When `disabled` turns true it calls `releaseAll()` and ignores new touches; it also calls `releaseAll()` on unmount and on `visibilitychange` to hidden.
- Minimum hit area 56×56 CSS px per arrow and button.

## Implementation plan

1. **Types and layouts.** Add `TouchDir`, `TouchButton`, `TouchLayout` and the required `touch` field to `GameDefinition` in `lib/games/registry.ts`, and the four layouts from the table. Check: `npx tsc --noEmit` and `npm run lint` pass; nothing renders differently yet.
2. **Virtual keys.** Create `lib/games/shared/virtual-keys.ts` (no React). Check: lint passes; the behavior is verified end to end in step 4.
3. **Touch component.** Create `app/_components/games/touch-controls.tsx` with the D-pad (multi-touch, slide) and buttons, styled with `/frontend-design`. Add its CSS in `app/globals.css` (`.touch-controls` hidden by default, shown under `@media (hover: none) and (pointer: coarse)`, `touch-action: none`, `user-select: none`, `-webkit-touch-callout: none`). Check: lint passes.
4. **Wire into GamePlayer.** Render `<TouchControls layout={definition.touch} disabled={paused || over} />` right after the CRT in `app/_components/game-player.tsx`; hide `.controls-legend` under the coarse-pointer media query. Check: Playwright at 375×812 with `hasTouch`/`isMobile` shows the controls on all four play pages; at 1440×900 desktop they are hidden and the legend is visible.
5. **Height fit.** Under the coarse-pointer media query in portrait, reduce `.av-player` top margin, `.crt` padding/radius and the HUD margin so the CRT and the controls fit in 375×812. Check: measured distance from `.crt` top to `.touch-controls` bottom ≤ 812 px.
6. **Docs.** Add the `touch` field to `.claude/skills/new-game/integration-contract.md` and to the "Game platform" section of `CLAUDE.md`.
7. **Verification pass.** `npm run lint`, `npm run build`, then every acceptance criterion with Playwright mobile emulation (375×812, `hasTouch`, `isMobile`); screenshots of each game with controls in `.playwright-screenshots/`. A real-device test is optional and, if done, noted in the PR.

Before writing code, read `node_modules/next/dist/docs/` for Client Components.

## Acceptance criteria

- [ ] `npm run lint` finishes with no errors.
- [ ] `npm run build` finishes with no errors.
- [ ] `GameDefinition` has a required `touch` field and the four registered games declare the layouts from the table.
- [ ] No file in `lib/games/asteroids/`, `tetris/`, `arkanoid/`, `snake/` or `lib/games/shared/input.ts` changed.
- [ ] At 375×812 with touch emulation, `/games/<id>/play` shows the D-pad and the declared buttons under the CRT for all four games, and the keyboard legend is hidden.
- [ ] At 1440×900 desktop (mouse), the touch controls are not visible and the keyboard legend is.
- [ ] Asteroids: holding ← / → rotates the ship while held, holding ↑ thrusts while held, FIRE shoots one bullet per touch, NOVA detonates a bomb when one is available; ↑ + → + FIRE held by three fingers work at the same time.
- [ ] Tetris: tapping ← / → moves one column; holding moves one column, then repeats after ~170 ms every ~50 ms; holding ↓ soft-drops repeatedly; ROTATE rotates once per touch; DROP hard-drops once per touch.
- [ ] Arkanoid: holding ← / → moves the paddle while held and it stops on release.
- [ ] Snake: the first arrow (not ←) starts the run; each arrow turns the snake; sliding a finger from ↑ to → without lifting turns up then right.
- [ ] Disabled D-pad directions (e.g. ↓ in Asteroids) emit nothing.
- [ ] Lifting a finger, or the browser cancelling the pointer, always releases the key (no ship that keeps rotating, no paddle that keeps moving).
- [ ] While PAUSED or with the GAME OVER modal open, touches on the controls do nothing; pausing while holding a key releases it, and resuming does not leave a key stuck.
- [ ] Holding a control does not scroll or zoom the page, select text or open the long-press callout; the page still scrolls when dragging outside the control.
- [ ] On a coarse pointer, a long press on the canvas, the CRT frame, the HUD, the gap between controls or the site footer selects no text and opens no "Copy / Search" menu (computed `user-select` is `none` on them); the GAME OVER initials input still accepts typing; on desktop text stays selectable.
- [ ] Touching a control never moves focus away from the page (typing initials in the modal still works afterwards).
- [ ] At 375×812 the distance from the top of `.crt` to the bottom of `.touch-controls` is ≤ 812 px, and `scrollWidth` equals `clientWidth`.
- [ ] Every arrow and button has a hit area of at least 56×56 CSS px.
- [ ] Leaving the play page while holding a control and coming back leaves no key stuck and runs a single game loop.
- [ ] Keyboard play on desktop is unchanged for all four games (P / Esc, M on Arkanoid, saving scores).
- [ ] `integration-contract.md` and `CLAUDE.md` mention the `touch` field.
- [ ] Screenshots of the four games with touch controls at 375×812 are saved in `.playwright-screenshots/`.

## Decisions

- **Yes:** synthetic `KeyboardEvent`s on `window` (user's choice). Zero engine changes; every game already reads `e.code` through `createInput`.
- **No:** a virtual press API in `createInput`. Cleaner, but touches the shared layer every engine depends on.
- **No:** a per-engine touch callback. Changes four engines and every future one.
- **Yes:** per-game layout declared in the registry (user's choice). Each game shows only what it uses (Asteroids FIRE/NOVA, Tetris ROTATE/DROP).
- **No:** fixed D-pad + A + B for all games. Shows dead buttons in Arkanoid and Snake.
- **No:** D-pad only. Asteroids could not shoot and Tetris could not hard-drop.
- **Yes:** `touch` is required, so a new game cannot ship without deciding its touch layout.
- **Yes:** Tetris ROTATE emits `ArrowUp` (also a rotate key), so the D-pad has no ↑ and no gesture conflict.
- **Yes:** shown automatically by `(hover: none) and (pointer: coarse)` (user's choice), pure CSS, so no hydration mismatch.
- **No:** a manual TOUCH ON/OFF toggle. Can come later if hybrid devices need it.
- **Yes:** under the CRT, D-pad left, buttons right (user's choice). Never covers the game.
- **No:** overlay on the canvas or a landscape side layout.
- **Yes:** hold with auto-repeat for declared codes (user's choice), mirroring the OS key repeat Tetris relies on (170 ms delay, 50 ms interval).
- **Yes:** multi-touch with Pointer Events and finger sliding across the D-pad (user's choice).
- **Yes:** `touch-action: none` and no selection/callout on the control only. Not chosen as an "extra" by the user, but required for Pointer Events to keep firing while a finger is held; page-wide zoom blocking stays out of scope.
- **Yes:** no text selection or callout on the whole play page (`body:has(.av-player)`, footer included) on a coarse pointer (user's choice, extended after a real iPhone test showed "Copy / Search" on the canvas, the HUD and then the footer copyright). Inputs are exempt so initials can be typed.
- **No:** blocking selection on other pages or on desktop; only the play page on touch devices loses text selection.
- **No:** vibration (not chosen by the user).
- **Yes:** height fit in portrait (user's choice) so the player does not scroll between the screen and the controls.
- **Yes:** verification with Playwright mobile emulation (user's choice); a real device is optional and noted in the PR.
- **Yes:** keyboard legend hidden on touch devices; it describes keys the player does not have.

## Risks

| Risk                                                               | Mitigation                                                                                               |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| A missed `pointerup` leaves a key held (ship keeps rotating)       | Release on `pointerup`, `pointercancel`, `lostpointercapture`, pause, game over, hidden tab and unmount. |
| Two fingers on the same code release it early                      | Reference count per code in `virtual-keys.ts`.                                                           |
| The browser scrolls or zooms and cancels the pointer               | `touch-action: none` on the control; a criterion checks it.                                              |
| Coarse-pointer media query misses a device (some tablets, hybrids) | Accepted; a manual toggle is a future spec. Hybrids with a keyboard still play with keys.                |
| Tapping the canvas sends compatibility `mousemove` to Arkanoid     | Controls live outside the canvas; canvas gestures are out of scope.                                      |
| Emulation differs from a real phone (iOS Safari callout, notch)    | `-webkit-touch-callout: none`; optional real-device test noted in the PR.                                |
| Shrinking the CRT padding on phones changes the desktop look       | Changes only inside the coarse-pointer media query; a criterion checks desktop is unchanged.             |
| Synthetic events are `isTrusted: false`                            | No engine checks `isTrusted`; verified by the per-game criteria.                                         |

## What is **not** in this spec

- Engine or `createInput` changes.
- Canvas gestures, gamepad, landscape layout.
- A manual touch toggle, vibration, fullscreen, orientation lock, PWA.
- Page-wide zoom or gesture blocking.
- Any change to `references/`.

Each one of those, if it lands, goes in its own spec.
