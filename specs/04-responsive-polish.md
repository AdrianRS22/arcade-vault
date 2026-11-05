# SPEC 04 — Responsive polish: Home scroll hint and Hall of Fame table

> **Status:** Approved
> **Depends on:** SPEC 01, SPEC 02, SPEC 03
> **Date:** 2026-11-05
> **Objective:** Fix the Home hero scroll indicator that overlaps the CTA buttons and the Hall of Fame table that overflows horizontally at 375px, with CSS changes and one small markup move.

## Why this spec exists

Both problems were found while verifying SPEC 03 and were left out of its scope.

- **Home hero:** `.hero-scroll` (`app/globals.css`) is `position: absolute; bottom: -20px` but lives inside `.home-hero-inner`, which is `position: relative`. It is anchored to the bottom edge of the content (the CTAs), not to the hero, so it hangs over `EXPLORE GAMES` and `CREATE ACCOUNT` at any viewport height.
- **Hall of Fame:** at ≤720px `.hall-table` uses `grid-template-columns: 50px 1fr 90px 90px`. The `1fr` column has an automatic minimum (`min-content`), so a long player name widens the row past the container. Measured at 375px: `scrollWidth` 373 vs `clientWidth` 360.

SPEC 03 already fixed the shared nav overflow at ≤480px; it is not part of this spec.

## Scope

**In:**

- Move `<div className="hero-scroll">` out of `.home-hero-inner` and make it a direct child of `.home-hero` in `app/page.tsx`, anchored to the bottom edge of the hero with a positive offset (the hero has `overflow: hidden`, so a negative `bottom` would clip it).
- Adjust `.home-hero` bottom padding if needed so the indicator never overlaps the CTAs.
- At ≤720px, make the Hall of Fame table columns shrink: `minmax(0, 1fr)` for the flexible column, and the player name (`.pl`) truncated with an ellipsis (`min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap`). Column widths may be tuned inside that media query.
- Measure `scrollWidth` vs `clientWidth` at 375px on every route and record the result in the PR.

**Out of scope (for future specs):**

- Any overflow found on other routes during the measurement: it is listed, not fixed here.
- Redesigning the Hall of Fame table (stacked cards, internal horizontal scroll).
- Hiding or redesigning the scroll indicator for short viewports.
- Changes to the shared nav (already done in SPEC 03).
- Any change to the table or hero above their current breakpoints (>720px for the table, desktop look of the hero).

## Data model

This feature introduces no new data structures. It only changes markup position and CSS.

## Implementation plan

1. Reproduce the baseline, no code: at 375×812 measure `document.documentElement.scrollWidth` vs `clientWidth` on `/`, `/games`, `/games/block-buster`, `/games/block-buster/play`, `/hall-of-fame`, `/login` and `/about`; at 1440×900 and 1920×900 compare the bounding boxes of `.hero-scroll` and the two CTAs on `/`. Keep the numbers for the PR.
2. In `app/page.tsx` move `.hero-scroll` to be a direct child of `.home-hero`. In `app/globals.css` change `.hero-scroll` to `bottom: 20px` and tune `.home-hero` bottom padding if the indicator is too close to the CTAs. Manual check: `/` at 1440×900 shows `SCROLL` below the buttons.
3. In `app/globals.css`, inside the existing `@media (max-width: 720px)` block, change the `.hall-table` grid to use `minmax(0, 1fr)` and add the ellipsis rules for `.hall-table .tr .pl`. Manual check: `/hall-of-fame` at 375px has no horizontal scroll and the desktop table is unchanged.
4. Run `npm run lint` and `npm run build`, then repeat the measurements from step 1 and compare with the baseline.

## Acceptance criteria

- [ ] `npm run lint` finishes with no errors.
- [ ] `npm run build` finishes with no errors.
- [ ] On `/` at 1440×900 the bounding box of `.hero-scroll` does not intersect the box of `EXPLORE GAMES` nor `CREATE ACCOUNT`.
- [ ] On `/` at 1920×900 the same boxes do not intersect.
- [ ] On `/` at 375×812 the same boxes do not intersect.
- [ ] `.hero-scroll` is visible (not clipped by the hero's `overflow: hidden`) at the three viewports above.
- [ ] On `/hall-of-fame` at 375px `scrollWidth` equals `clientWidth` for every game tab.
- [ ] A player name longer than the available width is cut with an ellipsis and does not push the row wider.
- [ ] On `/hall-of-fame` above 720px the table looks the same as before (same columns and widths).
- [ ] `scrollWidth` vs `clientWidth` at 375px was measured on `/`, `/games`, `/games/block-buster`, `/games/block-buster/play`, `/hall-of-fame`, `/login` and `/about`; the PR lists any route that still overflows.

## Decisions

- **Yes:** anchor `.hero-scroll` to the hero (move the markup). The bug is the anchor, not the viewport height, so it is fixed for every height.
- **No:** keep it in the content flow. It would never overlap, but it stops sitting at the bottom edge of the hero.
- **No:** hide it on short viewports with a height media query. It treats the symptom and the indicator would disappear on common laptops.
- **Yes:** shrinking columns with ellipsis for the Hall table. Keeps the 4-column table and adds no inner scroll.
- **No:** horizontal scroll container for the table. Simple, but the table slides sideways on phones.
- **No:** stacking rows as cards on mobile. Most readable, but it changes the UI and markup beyond a polish fix.
- **Yes:** verify at 375×812, 1440×900 and 1920×900. They cover the phone width that failed and the two desktop sizes where the overlap was seen.
- **Yes:** measure all routes at 375px but fix only the two known problems. Any other finding goes to its own spec so this one keeps a closed scope.

## Risks

| Risk | Mitigation |
| --- | --- |
| The hero is `overflow: hidden`, so a wrong `bottom` value clips the indicator | Use a positive `bottom` and check visibility in the acceptance criteria. |
| On very short viewports (e.g. 1366×768) the centered content may still reach the indicator | Keep bottom padding on `.home-hero` large enough; that viewport is not a criterion, so note it in the PR if it fails. |
| Truncated player names hide part of the name on mobile | Accepted trade-off; the full name stays in the DOM and desktop is unchanged. |
| The measurement reveals other overflowing routes | They are listed in the PR and moved to a future spec, not fixed here. |

## What is **not** in this spec

- Fixes for any route other than `/` (hero indicator) and `/hall-of-fame` (table).
- A redesign of the table or of the scroll indicator.
- Changes to the shared nav.

Each one of those, if it lands, goes in its own spec.
