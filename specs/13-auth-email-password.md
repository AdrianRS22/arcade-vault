# SPEC 13 — Auth with email and password

> **Status:** Implemented
> **Depends on:** SPEC 05, SPEC 07
> **Date:** 2026-11-11
> **Objective:** Replace the mock session with Supabase Auth (email + password, email confirmation, password reset) and make score saving require a signed-in player whose username comes from the `profiles` table.

## Why this spec exists

`/login` is a mock today: `AuthForm` and `SessionProvider` keep a name in memory, and `submit_score` accepts any `player` string from `anon`, so anyone can post a score under someone else's name. This spec introduces real accounts. The ranking name becomes a unique username stored in `profiles`, and only signed-in players can save scores. OAuth (Google/GitHub) and the username onboarding it needs are split into SPEC 14.

## Scope

**In:**

- Migration `<timestamp>_auth_profiles.sql`:
  - Table `public.profiles` (see Data model), RLS on, each user can `select` only their own row.
  - Trigger function `public.handle_new_user()` (`security definer`, `set search_path = ''`) on `auth.users` insert: creates the profile with `username` taken from `raw_user_meta_data->>'username'` (uppercased), or `null` when absent.
  - RPC `public.username_available(p text) returns boolean`, granted to `anon` and `authenticated`.
- Migration `<timestamp>_scores_require_user.sql`:
  - `delete from public.scores;` and `update public.games set plays = 0;` (existing scores were saved with free-form names and cannot be attributed).
  - `scores.user_id uuid not null references auth.users (id) on delete cascade`, plus an index.
  - `submit_score` replaced by `submit_score(p_game_id text, p_score integer)`: reads `auth.uid()`, takes the username from `profiles`, raises if there is no session or the username is null. `execute` granted to `authenticated` only (revoked from `anon` and `public`). The old 3-argument function is dropped.
  - `scores.player` and the three views are unchanged; `player` is filled from the profile.
- `npm run db:types` to regenerate `types/supabase.ts`.
- `proxy.ts` at the repo root plus `lib/supabase/proxy.ts`: refreshes the session cookies on each request. Read the Next 16 `proxy` docs and `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md` before writing it.
- `/login` (`app/_components/auth-form.tsx` rewritten):
  - SIGN IN tab: email + password.
  - CREATE ACCOUNT tab: username + email + password (min 8 characters). Username validated against `^[A-Z0-9_]{1,10}$` (input uppercased) and checked with `username_available` before submitting.
  - `?next=` param honored after login; only paths starting with a single `/` are accepted, anything else falls back to `/`.
  - A signed-in user visiting `/login` is redirected to `next` or `/`.
  - The GOOGLE / GITHUB buttons are removed (they return in SPEC 14). PLAY AS GUEST stays.
  - States: idle, submitting, error (invalid credentials, email not confirmed, username taken or invalid, password too short, rate limited, generic), and a "CHECK YOUR INBOX" state after sign-up.
  - "Forgot password?" link to `/forgot-password`.
- Server Actions in `app/login/actions.ts`: `signUp`, `signIn`, `signOut`, `requestPasswordReset`, `updatePassword`. All validate their input on the server.
- `app/auth/confirm/route.ts` (GET): `verifyOtp({ token_hash, type })` for `signup`/`email` and `recovery`, then redirects to the safe `next` (recovery goes to `/reset-password`) or to `/login?error=<code>` on failure.
- `/forgot-password`: email form; always shows "CHECK YOUR INBOX" whether or not the email exists.
- `/reset-password`: new-password form (min 8, confirm field); needs the recovery session, otherwise redirects to `/forgot-password`.
- `app/_components/session-provider.tsx` rewritten: browser client `getUser()` + `onAuthStateChange`, loads `profiles.username`. Exposes `{ user: { id: string; name: string } | null, status: "loading" | "ready", signOut }`. The `signIn(name)` function is removed.
- Nav (`app/_components/nav.tsx`): signed in shows `USERNAME ▾` opening a menu with SIGN OUT (desktop and mobile panel); guest keeps the Sign In link.
- `app/_components/game-player.tsx`: the free-name input is removed. Signed in → SAVE SCORE calls `saveScore(gameId, score)`. Guest → GAME OVER shows a `SIGN IN TO SAVE` link to `/login?next=/games/<id>/play`; that run's score is not kept.
  - A final score of 0 is never offered for saving: GAME OVER shows "A score of 0 is not saved." instead of SAVE SCORE / SIGN IN TO SAVE (UI only; `submit_score` still accepts 0).
  - Every new engine starts a clean run: `GamePlayer` resets score, pause, GAME OVER and save state in the callback that runs when the engine is created. Cache Components keeps the component's state when the route is shown again (for example after returning from `/login`) while the engine is destroyed, which left a stale GAME OVER with score 0.
- `saveScore(gameId, score)` and `getMyBests()` lose the `player` argument: the server resolves the user and username from the session (`await createClient()`).
- `CLAUDE.md` updated (Session, Supabase schema, routes, Auth notes).
- UI built with the `/frontend-design` skill, reusing `.auth-card`, `.field`, `.btn` from `app/globals.css`.
- Manual dashboard steps, listed in the spec's verification and done by the user:
  - Auth → Providers → Email: "Confirm email" on, minimum password length 8.
  - Auth → URL Configuration: Site URL and redirect URLs (`http://localhost:3000/**` plus the production URL).
  - Email templates (Confirm signup, Reset password) linking to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup` and `…&type=recovery&next=/reset-password`.
  - Auth → SMTP: custom SMTP with Resend.

**Out of scope (for future specs):**

- Google / GitHub sign-in and username onboarding (SPEC 14).
- Editing username or profile, avatar, account deletion.
- Saving a guest's score to send after login.
- Anti-cheat, server-verified scores and rate limiting of `submit_score`.
- Protecting routes (only `/reset-password` needs a session), roles, MFA.
- Login with username instead of email.

## Data model

```sql
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text unique check (username ~ '^[A-Z0-9_]{1,10}$'),  -- null until chosen (SPEC 14)
  created_at timestamptz not null default now()
);
```

```sql
alter table public.scores
  add column user_id uuid not null references auth.users (id) on delete cascade;
create index scores_user_idx on public.scores (user_id);
```

- RLS on `profiles`: `select` where `id = auth.uid()`; no insert/update/delete policies (the trigger writes it).
- `submit_score(p_game_id text, p_score integer) returns integer`: `security definer`, `set search_path = ''`; same validations and rank return as SPEC 07, with the player taken from `profiles.username`.
- TypeScript: `SessionUser = { id: string; name: string }` in `session-provider.tsx`. `SaveScoreResult` is unchanged.

## Implementation plan

1. **Migrations and types.** Write both migrations, `npm run db:push`, `npm run db:types`. Check: tables, trigger and functions exist (`list_tables`, `get_advisors` shows no new security warnings); anon calling `submit_score` fails.
2. **Proxy and helpers.** `proxy.ts` + `lib/supabase/proxy.ts`; update the comment in `lib/supabase/server.ts`. Check: `npm run build` passes and pages still render.
3. **Session and Nav.** Rewrite `SessionProvider`; Nav user menu with SIGN OUT (desktop + mobile). `AuthForm` temporarily keeps compiling. Check: tsc and lint pass, guest nav unchanged.
4. **Login, sign-up and confirm.** Actions, `AuthForm`, `/login` redirect when signed in, `/auth/confirm`. Check: sign-up shows CHECK YOUR INBOX; confirm link signs the user in.
5. **Password reset.** `/forgot-password`, `/reset-password`, `requestPasswordReset`, `updatePassword`. Check: the full reset flow works.
6. **Scores.** New `saveScore` / `getMyBests`, `game-player.tsx` (SAVE SCORE for users, SIGN IN TO SAVE for guests), `hall-of-fame-board.tsx` adapted. Check: a saved score has `user_id` and the profile username.
7. **Docs.** Update `CLAUDE.md`; list the dashboard checklist.
8. **Verification pass.** `npm run lint`, `npm run build`, the acceptance criteria with Playwright (375×812 and 1440×900). Screenshots in `.playwright-screenshots/` (`spec-13-<screen>.png`).

## Acceptance criteria

- [x] `npm run lint` and `npm run build` finish with no errors; `types/supabase.ts` is regenerated, not hand-edited.
- [x] Creating an account creates a row in `auth.users` and one in `profiles` with the uppercased username.
- [x] A username already taken, or not matching `^[A-Z0-9_]{1,10}$`, is rejected with a visible message.
- [x] A password under 8 characters is rejected in the form and by the server action.
- [x] Signing in before confirming the email shows a "confirm your email" message and creates no session.
- [x] The confirmation link signs the user in and lands on `next` (or `/`).
- [x] The session survives a page reload; SIGN OUT clears it and the Nav returns to Sign In.
- [x] `/login` redirects a signed-in user away; `?next=//evil.com` and `?next=https://evil.com` fall back to `/`.
- [x] `/forgot-password` shows the same response for existing and unknown emails; the reset link opens `/reset-password`, and the new password works at login. Opening `/reset-password` without a recovery session redirects to `/forgot-password`.
- [x] A guest at GAME OVER sees SIGN IN TO SAVE (no name input); calling `submit_score` as `anon` returns a permission error.
- [x] A guest who reaches `/login` from GAME OVER and comes back lands on a fresh run (HUD score 0, no GAME OVER modal). A final score of 0 shows "A score of 0 is not saved." and no save button.
- [x] A signed-in player's SAVE SCORE stores a row with `user_id` and `player` equal to their username, and shows `SAVED — RANK #N`.
- [x] Hall of Fame "YOUR BEST" shows the signed-in player's real best without any client-supplied name.
- [x] After the migration, `scores` is empty and every `games.plays` is 0.
- [x] No secret or service-role key appears in code or env files.

## Decisions taken and discarded

- **Email + password now, OAuth in SPEC 14.** OAuth needs external apps and a callback route; splitting keeps each spec verifiable. Discarded: one big spec.
- **Login with email; username in `profiles`.** Simple and does not expose which usernames exist. Discarded: login by username (needs a resolver RPC), `user_metadata` (no uniqueness).
- **Only signed-in players save scores; guests can play.** Ends name spoofing while keeping the low-friction play. Discarded: free names for guests; mandatory login to play.
- **Guest score is not kept after login.** Saving it in the browser to replay later would let anyone forge scores. Discarded: pending score in `sessionStorage`.
- **A score of 0 is not saved.** Found during implementation: a 0 offered a pointless SAVE SCORE, and a stale GAME OVER appeared after returning from login. Hidden in the UI only; the database rule (`0..9,999,999`) is unchanged. Discarded: rejecting 0 in `submit_score` and `saveScore`.
- **Delete existing scores.** They carry free-form names with no owner; clean rankings beat a legacy mix. Discarded: keep them with `user_id null`.
- **Email confirmation on, SMTP via Resend.** Avoids fake accounts and the very low default SMTP limit. Discarded: no confirmation; default SMTP.
- **Minimum password 8 characters.** Discarded: Supabase default of 6.
- **`username` is nullable in `profiles`.** SPEC 14 creates profiles for OAuth users before they pick a name.
- **Extras in:** user menu with SIGN OUT, password reset. **Out:** editing the username.

## Identified risks

- Resend without a verified domain only delivers to the account owner's email; real users need a verified domain.
- Race between `username_available` and sign-up: the unique constraint makes the trigger fail, and the action maps that error to "username taken".
- Cache Components: session reads must happen in dynamic code or inside `<Suspense>`, never inside `"use cache"`.
- Deleting scores is irreversible; do it only on the intended project.
- If the trigger fails, sign-up fails entirely; it must be tested with and without a username in metadata.
