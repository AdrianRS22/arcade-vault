# SPEC 02 — Home landing page

> **Status:** Implemented
> **Depends on:** SPEC 01
> **Date:** 2026-11-04
> **Objective:** Add a marketing Home page at `/` ported from `references/templates/home-about/` (in English, fed by mock data) and move the Library from `/` to `/games`.

## Why this spec exists

SPEC 01 put the Library at `/`, so the site has no landing page that explains what Arcade Vault is.
The `home-about` prototype adds one. This spec ports the Home part only; the About page goes in its own spec.

## Scope

**In:**

- Home at `/` with every section of `references/templates/home-about/home-about/home.jsx`, in this order:
  1. Hero: floating pixel silhouettes (8 SVGs), eyebrow `▸ INSERT A COIN_`, three-line title, subtitle, `▶ EXPLORE GAMES` and `✦ CREATE ACCOUNT` CTAs, scroll hint.
  2. `// 01 WHY ARCADE VAULT?`: 4 feature cards with pixel icons (gamepad, free, trophy, rocket).
  3. `// 02 GAMES AVAILABLE NOW`: rail of the first 6 games (mini cards) and a `SEE ALL GAMES →` button.
  4. Stats band: 3 blocks (game count, plays, global ranking).
  5. `// 03 LIVE ACTIVITY`: "Latest scores" ticker (7 rows) and "Top players · today" list (5 rows) with a `HALL OF FAME →` link.
  6. `// 04 PRICING`: single free plan card with feature list, `START FREE →` CTA, `FREE PLAY` stamp, and a 3-item FAQ.
  7. Final CTA: `READY TO PLAY?` and `INSERT COIN →`.
- Scroll reveal animation on sections, disabled under `prefers-reduced-motion`.
- Library moves from `/` to `/games` (same UI and behavior as SPEC 01).
- Nav: links become `Home` (`/`), `Library` (`/games`), `Hall of Fame`. Same in the mobile panel. Logo still goes to `/`.
- "Back to library" links that point to `/` today now point to `/games` (Game Detail Back, Player Back to Vault, Hall of Fame button).
- `/login?mode=create` opens the Auth screen on the Create Account tab.
- New mock data for live activity in `app/data/activity.ts`.
- Home CSS ported from the reference `styles.css` into `app/globals.css`.
- All copy in English, no real-world game brand names.

**Out of scope (for future specs):**

- About page and its nav link.
- Real-time activity (polling, websockets); the ticker is static mock data.
- Real stats (plays per day, player counts).
- Payments or any real pricing logic.
- Changes to the Library, Detail, Player, Auth or Hall of Fame UI beyond the link targets and the `mode` param above.

## Data model

New file `app/data/activity.ts`. Pages only call the async functions.

```ts
// app/data/activity.ts
import type { GameColor } from "./games";

export type RecentScore = {
  player: string;     // e.g. "NEONFOX"
  gameId: string;     // id from games.ts; the title is resolved via getGameById
  score: number;
  ago: string;        // display string, e.g. "2 min ago"
  color: GameColor;
};

export type TopPlayer = {
  rank: number;       // 1..5
  player: string;
  score: number;
};

export async function getRecentScores(limit?: number): Promise<RecentScore[]>;   // 7 fixed rows
export async function getTopPlayersToday(limit?: number): Promise<TopPlayer[]>; // 5 fixed rows, sorted
```

Conventions:

- Games rail and stats use the existing `getGames()` (`app/data/games.ts`); the "games" stat shows `games.length` (8), not the prototype's `12+`.
- Mini card subtitle uses `game.category`.
- Numbers formatted with `toLocaleString("en-US")`.
- Feature, stats copy, pricing list and FAQ are static content inside the Home components (not data).

## Implementation plan

1. Create `app/data/activity.ts` with types, fixed arrays (game ids from `games.ts`) and async accessors.
2. Move the Library: create `app/games/page.tsx` with the current contents of `app/page.tsx` (hero + `LibraryBrowser`). Update nav active logic (`Library` active on `/games` and `/games/*`, `Home` active only on `/`) and add the `Home` link in desktop and mobile nav (`app/_components/nav.tsx`). Change the back links in `app/games/[id]/page.tsx`, `app/_components/game-player.tsx` and `app/_components/hall-of-fame-board.tsx` to `/games`.
3. Port the Home CSS from `references/templates/home-about/home-about/styles.css` into `app/globals.css`: `.home*`, `.hero-eyebrow`, `.hero-scroll`, `.home-silos`/`.silo`, `.section-*`, `.feature-*`, `.mini-*`, `.home-stats`/`.stat-*`, `.activity-*`/`.ac-*`/`.ticker`/`.tick-*`/`.tk-*`, `.top-*`/`.tp-*`, `.pricing-*`/`.price-card`/`.pc-*`/`.faq-*`, `.home-final`/`.final-*`, `.reveal`, `.pulse`, required keyframes (`float`, `bounce`, etc.) and their `@media` rules. Skip classes already present. Add a `prefers-reduced-motion` rule that makes `.reveal` visible and disables silhouette float.
4. Create Home components in `app/_components/home/`: `floating-silhouettes.tsx`, `feature-icon.tsx`, `mini-card.tsx` (Link to `/games/[id]`), and a client `reveal.tsx` that runs the IntersectionObserver and adds `.in`.
5. Replace `app/page.tsx` with the Home server page: loads `getGames()`, `getRecentScores()`, `getTopPlayersToday()`, resolves game titles for the ticker, renders all 7 sections. CTAs: `EXPLORE GAMES`, `SEE ALL GAMES`, `INSERT COIN` → `/games`; `CREATE ACCOUNT`, `START FREE` → `/login?mode=create`; `HALL OF FAME →` → `/hall-of-fame`.
6. Support `mode=create` on `/login`: `app/login/page.tsx` reads `searchParams` and passes `initialTab` to `AuthForm` (`app/_components/auth-form.tsx`), which uses it as the initial tab state. Follow the Cache Components docs for `searchParams` (wrap in `<Suspense>` if required).
7. Run `npm run lint` and `npm run build`, then check the acceptance criteria in the browser at desktop and 375px.

Before writing route code, read `node_modules/next/dist/docs/` (Cache Components, `searchParams`, `Link`). Use the `/frontend-design` skill for UI work.

## Acceptance criteria

- [x] `npm run lint` finishes with no errors.
- [x] `npm run build` finishes with no errors.
- [x] `/` shows the hero with the silhouettes, title, subtitle and both CTAs.
- [x] `/` shows, in order, the sections WHY ARCADE VAULT?, GAMES AVAILABLE NOW, the stats band, LIVE ACTIVITY, PRICING and READY TO PLAY?.
- [x] The games rail shows exactly 6 mini cards; clicking one navigates to `/games/[id]`.
- [x] The stats band shows `8` as the game count.
- [x] The ticker shows 7 rows with player, game title, score and time; the top list shows 5 rows with ranks #01–#05.
- [x] `EXPLORE GAMES`, `SEE ALL GAMES` and `INSERT COIN` navigate to `/games`.
- [x] `CREATE ACCOUNT` and `START FREE` navigate to `/login?mode=create` and the Create Account tab (with email field) is selected.
- [x] `/login` without params still opens on the Sign In tab.
- [x] `HALL OF FAME →` in Live Activity navigates to `/hall-of-fame`.
- [x] `/games` shows the Library (hero, search, chips, 8 cards) with the SPEC 01 behavior.
- [x] Nav shows Home, Library and Hall of Fame; Home is active on `/`, Library on `/games` and `/games/*`.
- [x] Game Detail Back, Player Back to Vault and the Hall of Fame button navigate to `/games`.
- [x] Sections fade in when scrolled into view; with reduced motion emulated they are visible without animation.
- [x] At 375px there is no horizontal scroll and grids collapse (features, rail, stats, activity, pricing).
- [x] No visible text on the Home is in Spanish and no real-world game brand names appear.
- [x] No About link or About page exists.

## Decisions

- **Yes:** Home at `/`, Library at `/games`. Matches `/games/[id]` and `/games/[id]/play`.
- **No:** `/library` or `/home`. Breaks the URL hierarchy or is unconventional.
- **Yes:** live activity as mock data in `app/data/activity.ts` behind async functions. Same swap-to-DB pattern as SPEC 01.
- **No:** hardcoded arrays in the component or deriving activity from `scores.ts`. The first breaks the data pattern; the second can't produce realistic "x min ago" rows.
- **Yes:** all prototype sections, including Pricing + FAQ.
- **Yes:** nav adds `Home`; About deferred to its own spec.
- **Yes:** back links go to `/games`. They meant "back to the library".
- **Yes:** `/login?mode=create` read on the server page and passed as a prop. Avoids `useSearchParams` in the client form.
- **Yes:** generic copy, real game count. The prototype's `12+` and real brand names (Arkanoid, Tetris, Snake) are dropped.
- **Yes:** scroll reveal with `prefers-reduced-motion` respected.
- **Yes:** reuse/port CSS classes from the reference into `app/globals.css`, consistent with SPEC 01.

## Risks

| Risk | Mitigation |
| --- | --- |
| Reading `searchParams` on `/login` under Cache Components makes the route dynamic and may require `<Suspense>` | Follow `node_modules/next/dist/docs/` before writing step 6; wrap the dynamic part in `<Suspense>` if the build asks for it. |
| `.reveal` content stays invisible if JS fails or the observer never fires | Reduced-motion rule shows it; observer also marks elements already in view on mount. |
| Ported CSS collides with existing classes in `globals.css` (`.btn`, `.stat-*`, keyframes) | Port only missing selectors; diff names against `globals.css` before pasting. |
| Old links/bookmarks to `/` expecting the Library | Accepted: Home has prominent CTAs to `/games`. |

## What is **not** in this spec

- About page.
- Real-time activity or real stats.
- Payments.

Each one of those, if it lands, goes in its own spec.
