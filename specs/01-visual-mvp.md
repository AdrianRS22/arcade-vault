# SPEC 01 — Visual MVP of the Arcade Vault screens

> **Status:** Implemented
> **Depends on:** —
> **Date:** 2026-11-04
> **Objective:** Port the five screens of the `references/templates/` prototype (Library, Game Detail, Player, Auth, Hall of Fame) to Next.js App Router routes, in English, fed by mock data, without implementing any real game.

## Why this spec exists

The prototype in `references/templates/` is a single-page React UMD app with a hash router, `window` globals and Spanish copy.
This spec turns it into idiomatic App Router code that can later swap mock data for a database without touching the UI.

## Scope

**In:**

- Shared layout: top nav (logo, Library and Hall of Fame links, static `CREDITS · 03` counter, Sign In / user button), mobile hamburger panel, footer.
- Library at `/`: hero, name search, category chips (`ALL`, `ARCADE`, `PUZZLE`, `SHOOTER`, `VERSUS`), game grid with tilt cards, empty state.
- Game Detail at `/games/[id]`: cover, tags, description, stat strip, Play Now and Back buttons, top-10 leaderboard aside.
- Player at `/games/[id]/play`: HUD (player, score, lives, level), CRT screen with decorative animated arena, simulated score that rises on an interval, Pause/Resume, End, Exit, Game Over modal with initials input, Save Score (visual only), Play Again, Back to Vault.
- Auth at `/login`: Sign In / Create Account tabs, username, email (create only), password, submit, Play as Guest, decorative Google and GitHub buttons.
- Hall of Fame at `/hall-of-fame`: per-game tabs, podium (top 3), ranking table, "your best" row when a session exists.
- Mock data in `app/data/` exposed through async functions.
- Fake in-memory session via a React context.
- All UI copy in English, including game titles and descriptions.
- Unknown game id returns the Next.js 404 page.

**Out of scope (for future specs):**

- Any real game logic or canvas rendering.
- Database and real data access.
- Real authentication, OAuth (Google/GitHub), password validation.
- Persisting scores; Save Score only shows the toast.
- Persisting the session across reloads (no localStorage).
- Credits/coins system.
- Account screen or sign-out menu beyond clicking the user button to sign out.

## Data model

Lives in `app/data/`. Pages and components only call the async functions, never the raw arrays.

```ts
// app/data/games.ts
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type GameColor = "cyan" | "magenta" | "yellow" | "green";

export type Game = {
  id: string;          // kebab-case slug, used in the URL
  title: string;       // e.g. "BLOCK BUSTER"
  short: string;       // card description
  long: string;        // detail description
  category: GameCategory;
  cover: string;       // CSS class from globals.css, e.g. "cover-bricks"
  color: GameColor;
  best: number;
  plays: string;       // display string, e.g. "12.4K"
};

export const CATEGORIES = ["ALL", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"] as const;

export async function getGames(): Promise<Game[]>;
export async function getGameById(id: string): Promise<Game | undefined>;
```

```ts
// app/data/scores.ts
export type ScoreEntry = {
  rank: number;
  player: string;
  score: number;
  date: string;        // "DD/MM/2026"
};

export async function getLeaderboard(gameId: string, limit?: number): Promise<ScoreEntry[]>;
export async function getPlayerBest(gameId: string, player: string): Promise<ScoreEntry>; // fixed mock
```

```ts
// app/_components/session-provider.tsx (client)
type SessionUser = { name: string };   // uppercased, max 10 chars
// context value: { user: SessionUser | null, signIn(name), signOut() }
```

Conventions:

- The 8 games of `references/templates/data.jsx` are kept with English titles and copy, same `cover` classes and colors.
- Leaderboards are hand-written fixed arrays, 12 rows per game, already sorted by score.
- Numbers are formatted with `toLocaleString("en-US")`.

## Implementation plan

1. Create `app/data/games.ts` and `app/data/scores.ts` with types, mock arrays and async accessors.
2. Create `app/_components/session-provider.tsx` and wrap `{children}` with it in `app/layout.tsx`.
3. Create `app/_components/nav.tsx` (client, active link via `usePathname`, hamburger panel) and `app/_components/footer.tsx`; render both in `app/layout.tsx` around `<main className="av-main">`.
4. Replace `app/page.tsx` with the Library: server page loads games, client `library-browser.tsx` handles search and chips, `game-card.tsx` handles tilt and links to `/games/[id]`.
5. Create `app/games/[id]/page.tsx` (detail + leaderboard aside, `notFound()` for unknown ids, `generateStaticParams` from `getGames`).
6. Create `app/games/[id]/play/page.tsx` with client `game-player.tsx` (simulated score, pause, Game Over modal, visual save).
7. Create `app/login/page.tsx` with client `auth-form.tsx` (tabs, submit calls `signIn` and redirects to `/`, guest button).
8. Create `app/hall-of-fame/page.tsx`: server page loads all games and leaderboards, client `hall-of-fame-board.tsx` handles tabs, podium, table and "your best" row.
9. Remove leftover scaffold assets usage from `app/page.tsx` (already replaced in step 4) and confirm `npm run lint` and `npm run build` pass.

Before writing route code, read the relevant guides in `node_modules/next/dist/docs/` (dynamic params, `generateStaticParams`, `notFound`, Cache Components). Use the `/frontend-design` skill for UI work, reusing the existing classes in `app/globals.css`.

## Acceptance criteria

- [x] `npm run lint` finishes with no errors.
- [x] `npm run build` finishes with no errors.
- [x] `/` shows the hero and 8 game cards.
- [x] Typing in the search filters cards by title; a query with no matches shows the "NO RESULTS" empty state.
- [x] Clicking a category chip shows only games of that category; `ALL` shows all 8.
- [x] Clicking a card or its PLAY button navigates to `/games/[id]`.
- [x] `/games/[id]` shows the game title, description, stat strip and a 10-row leaderboard.
- [x] `/games/unknown-id` renders the 404 page.
- [x] PLAY NOW navigates to `/games/[id]/play`; the score increases on its own.
- [x] PAUSE stops the score and shows the "PAUSED" overlay; RESUME continues it.
- [x] END opens the Game Over modal with the final score.
- [x] SAVE SCORE replaces the input with the "SCORE SAVED" toast and writes nothing to storage.
- [x] PLAY AGAIN resets score to 0, lives to 3 and level to 01.
- [x] Submitting `/login` with a username redirects to `/` and the nav shows that username uppercased.
- [x] The Create Account tab shows the email field; the Sign In tab hides it.
- [x] PLAY AS GUEST redirects to `/` with no session.
- [x] Clicking the username in the nav signs out and shows SIGN IN again.
- [x] `/hall-of-fame` shows one tab per game; switching tabs changes the podium and the table.
- [x] With a session, the Hall of Fame shows the "YOUR BEST" row; without a session it does not.
- [x] Reloading the page after signing in shows SIGN IN again (session is in memory only).
- [x] The nav marks the active link (Library for `/`, `/games/*`; Hall of Fame for `/hall-of-fame`).
- [x] At 375px width the nav links are replaced by the hamburger, which opens the side panel.
- [x] No visible text in the UI is in Spanish.

## Decisions

- **Yes:** real App Router routes (`/`, `/games/[id]`, `/games/[id]/play`, `/login`, `/hall-of-fame`). Shareable URLs and native back/forward.
- **No:** hash-based SPA router from the prototype. Ignores the App Router.
- **Yes:** UI in English. Matches `lang="en"` and metadata already in `app/layout.tsx`.
- **Yes:** mock data in `app/data/` behind async functions. The database spec only swaps function bodies.
- **No:** exported constants imported directly by pages. Switching to a DB would touch every page.
- **Yes:** hand-written fixed leaderboards. Closer to DB output than the seeded generator.
- **No:** porting `seededScores()`. Logic that disappears with the DB.
- **Yes:** in-memory session context. Real auth comes in another spec.
- **No:** localStorage for session or scores (`av_user`, `av_scores` from the prototype are dropped).
- **Yes:** Player keeps the prototype simulation (rising score, pause, Game Over modal). Shows the full flow without a real game.
- **Yes:** Save Score is visual only. Persisting scores belongs to the DB spec.
- **Yes:** reuse the classes already ported to `app/globals.css`. Tailwind utilities only for small layout tweaks that replace inline styles.
- **Yes:** shared components in `app/_components/` (private folder, not routed).

## Risks

| Risk | Mitigation |
| --- | --- |
| Cache Components rejects dynamic access in `/games/[id]` | Use `generateStaticParams` from `getGames()` and follow `node_modules/next/dist/docs/` before writing the route. |
| Session lost on full page reload or direct URL entry | Accepted for the MVP and stated in acceptance criteria. |
| Server/client boundary mistakes (context used in server components) | Only client components read the session; server pages pass data down as props. |

## What is **not** in this spec

- Real games.
- Database or real data access.
- Real authentication or OAuth.
- Persisted scores or persisted session.
- Credits system.

Each one of those, if it lands, goes in its own spec.
