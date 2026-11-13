# SPEC 16 — Auth and score hardening

> **Status:** Approved
> **Depends on:** SPEC 13, SPEC 14, SPEC 15
> **Date:** 2026-11-12
> **Objective:** Close the findings of the `security-guidance` review of authentication: password changes only from a fresh recovery session that revokes the other sessions, a database throttle on `submit_score`, a validated username in `handle_new_user`, and an honest "username taken" error in `signUp`.

## Why this spec exists

A review of the auth code (2026-11-12, `security-guidance` plugin criteria) found four fixable issues on top of the SPEC 15 baseline:

1. `/reset-password` and `updatePassword` accept **any** signed-in session, so a stolen session can set a new password without knowing the old one, and the other sessions stay alive afterwards.
2. `submit_score` can be called in a loop by any signed-in user (also through `/rest/v1/rpc`), flooding `scores` and inflating `games.plays`.
3. `handle_new_user` trusts `raw_user_meta_data.username`, which a client can set freely when it calls `auth/v1/signup` directly.
4. `signUp` shows "username taken" for any `unexpected_failure`, hiding real errors.

Two low/info findings are **accepted, not fixed**: `username_available` is callable by `anon` (usernames are already public in the leaderboard and SPEC 15 documents the RPC), and `getClaims()` in the proxy does not notice a revoked session until the token expires (pages and actions that matter use `getUser()`).

## Scope

**In:**

- **Password change only from a recovery session** (finding 1):
  - `lib/auth/recovery.ts` (server-only helper): `isFreshRecoverySession(claims)` is true when the JWT `amr` array has an entry with `method: "otp"` and a `timestamp` less than 15 minutes old. Reads claims from `supabase.auth.getClaims()`.
  - `app/reset-password/page.tsx`: after the existing `getUser()` check, a session that is not a fresh recovery session is redirected to `/forgot-password`.
  - `updatePassword` in `app/login/actions.ts`: same check before `updateUser`; a non-recovery session gets `redirect("/forgot-password")`.
  - After a successful `updateUser`, call `supabase.auth.signOut({ scope: "others" })` so every other session of the account is revoked; the current one stays signed in.
- **Throttle in `submit_score`** (finding 2): minimum **10 seconds** between accepted submissions of the same user for the same game.
  - Migration `<timestamp>_auth_and_score_hardening.sql` creates `public.score_submissions` and replaces `submit_score` (same signature and grants).
  - `saveScore` maps the new error to the message "Wait a few seconds before saving again."
- **Validated username in `handle_new_user`** (finding 3): the trigger keeps the username only when `upper(value)` matches `^[A-Z0-9_]{1,10}$`, otherwise it stores `null`. The player then goes through `/onboarding` (SPEC 14). Same migration, `create or replace function`.
- **`signUp` error mapping** (finding 4): when `auth.signUp` fails with `unexpected_failure` or "Database error saving new user", the action calls `username_available` again: `false` → "That username is taken"; anything else → the generic message.
- `types/supabase.ts` regenerated (`npm run db:types`).
- `CLAUDE.md` updated: Auth note (reset-password needs a recovery session, other sessions revoked), `submit_score` throttle, `score_submissions`, trigger validation, accepted low findings.
- `references/security-report.md` is **not** edited here; the `security-auditor` agent records the findings afterwards.

**Out of scope (for future specs):**

- Anti-cheat or server-side validation of scores (the game runs in the browser; the 0–9,999,999 range stays the only check).
- A "change password" screen for signed-in users with the current password, MFA, re-authentication nonce flow.
- Supabase dashboard option "secure password change" (discarded below; no dashboard step in this spec).
- Making `username_available` private, or detecting revoked sessions in the proxy.
- Rate limiting other Server Actions (contact form, sign-in beyond the Supabase limits), CAPTCHA.

## Data model

New table, written only by `submit_score`:

```sql
create table public.score_submissions (
  user_id uuid not null references auth.users (id) on delete cascade,
  game_id text not null references public.games (id) on delete cascade,
  last_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

alter table public.score_submissions enable row level security;  -- no policies
revoke all on public.score_submissions from anon, authenticated;
```

Throttle inside `submit_score`, after the existing score and game checks and before the `insert` into `scores` (atomic, one statement):

```sql
insert into public.score_submissions as s (user_id, game_id, last_at)
values (v_user_id, p_game_id, now())
on conflict (user_id, game_id) do update set last_at = now()
  where s.last_at <= now() - interval '10 seconds';
get diagnostics v_rows = row_count;
if v_rows = 0 then
  raise exception 'too many submissions' using errcode = '54000';
end if;
```

Trigger change in `handle_new_user`:

```sql
insert into public.profiles (id, username)
values (
  new.id,
  case when upper(new.raw_user_meta_data ->> 'username') ~ '^[A-Z0-9_]{1,10}$'
       then upper(new.raw_user_meta_data ->> 'username') end
);
```

Recovery check shape (no new persisted data):

```ts
// lib/auth/recovery.ts
export const RECOVERY_MAX_AGE_SECONDS = 15 * 60;
export function isFreshRecoverySession(
  claims: { amr?: { method: string; timestamp: number }[] } | null,
): boolean;
```

## Implementation plan

1. **Verify the claim.** With a throwaway test account, run the three flows (password sign-in, OAuth sign-in, recovery link through `/auth/confirm`) and log `getClaims().data.claims.amr` for each. Confirm that only the recovery link (and signup confirmation) yields `method: "otp"`. Adjust `isFreshRecoverySession` to what is observed. Nothing is committed in this step.
2. **Recovery helper and page gate.** Create `lib/auth/recovery.ts` and use it in `app/reset-password/page.tsx`. Check: a password-signed-in user opening `/reset-password` lands on `/forgot-password`; a user arriving from a recovery link sees the form.
3. **`updatePassword`.** Add the recovery check and `signOut({ scope: "others" })` after a successful update. Check: after changing the password from the recovery session, a second browser session of the same account is signed out on its next request.
4. **Migration.** Write `<timestamp>_auth_and_score_hardening.sql` (table, RLS, `submit_score`, `handle_new_user`), `npm run db:push`, `npm run db:types`. Check with `execute_sql` inside a rolled-back transaction (see criteria).
5. **`saveScore` mapping.** Handle error code `54000` with the "Wait a few seconds…" message. Check: saving twice within 10 seconds shows it; after 10 seconds the second save works and the rank is returned.
6. **`signUp` mapping.** Re-check `username_available` on `unexpected_failure`. Check: a forced duplicate (two sign-ups with the same name racing, or the trigger failing for another reason) shows "taken" only when the name is really taken.
7. **Docs.** Update `CLAUDE.md` as listed in Scope.
8. **Verification pass.** `npm run lint`, `npx tsc --noEmit`, `npm run build`; security advisors (`get_advisors`, security) show no new warning; Playwright smoke test at 375×812 and 1440×900: sign in, play a game, save a score, save again immediately (throttle message), open `/reset-password` while signed in with a password. Screenshots `spec-16-<screen>.png` in `.playwright-screenshots/`.

## Acceptance criteria

- [ ] `npm run lint`, `npx tsc --noEmit` and `npm run build` finish with no errors; `types/supabase.ts` is regenerated, not hand-edited.
- [ ] A user signed in with email and password (no recovery link) who opens `/reset-password` is redirected to `/forgot-password`.
- [ ] A user who arrives through a recovery link (`/auth/confirm?type=recovery`) sees the reset form and can set a new password within 15 minutes of the link.
- [ ] Calling `updatePassword` with a non-recovery session does not change the password and redirects to `/forgot-password`.
- [ ] After a successful password change, every other session of that account is signed out and the current one stays signed in.
- [ ] `public.score_submissions` has RLS enabled, no policies, and no grants for `anon` or `authenticated`.
- [ ] Calling `submit_score` twice for the same user and game within 10 seconds raises error `54000` on the second call and inserts exactly one row in `scores` and increments `games.plays` once (checked in a rolled-back transaction with `request.jwt.claims` set).
- [ ] A second submission for a **different game** inside the 10 seconds succeeds.
- [ ] A submission 10 seconds or more after the previous one succeeds and returns the rank.
- [ ] An invalid score or unknown game does not consume the 10-second window.
- [ ] `saveScore` returns "Wait a few seconds before saving again." for `54000` and the GAME OVER modal shows it.
- [ ] Inserting a row into `auth.users` (rolled back) with `raw_user_meta_data.username` = `bad name!` creates a profile with `username = null`; with `ok_1` creates `OK_1`.
- [ ] A sign-up whose database insert fails while the username is still free shows the generic error, not "taken"; one whose username is already used shows "taken".
- [ ] The security advisors report no new warning beyond the four documented in SPEC 15.
- [ ] `CLAUDE.md` describes the recovery-only reset, the session revocation, the throttle and the validated trigger.

## Decisions taken and discarded

- **Yes:** recovery-only password change via the JWT `amr` claim, fresh for 15 minutes. It is stateless, tied to the session and needs no new UI. Discarded: Supabase "secure password change" in the dashboard (needs a nonce email flow and more UI for a screen that does not exist: signed-in users have no change-password form today). Discarded: both layers (extra manual step for little gain).
- **Yes:** 15 minutes of freshness. Longer than a person needs to type a password, much shorter than the 1-hour link validity. Discarded: no freshness check (a signup-confirmation session would qualify for as long as its token lives).
- **Yes:** `signOut({ scope: "others" })` after the change, keeping the current session. Discarded: `scope: "global"` (would sign out the person who just reset the password and force another login).
- **Yes:** throttle of 10 seconds per user and game, stored in `score_submissions` and updated atomically with one `insert … on conflict … where`. Cheap (primary-key lookup), no race between two parallel calls. Discarded: N submissions per minute counted over `scores` (more expensive and lets bursts through); 3 seconds per user (too permissive); an in-memory limit in the Server Action (bypassable through `/rest/v1/rpc`).
- **Yes:** the throttle sits after the validations, so rejected calls do not burn the window. A double click on SAVE SCORE is also absorbed by it.
- **Yes:** invalid trigger username becomes `null`, the player continues through `/onboarding`. Discarded: raising an exception (the sign-up would fail with the opaque "Database error saving new user").
- **Yes:** re-check `username_available` to tell "taken" from other failures, because Supabase Auth hides the 23505 code behind a generic error. Discarded: `on conflict do nothing` in the trigger (changes the sign-up flow and silently drops the chosen name).
- **Yes:** one spec for both domains. All four fixes ship from one migration and one review report. Discarded: two specs (extra branch and PR for a small change).
- **Accepted, not fixed:** `username_available` for `anon` and `getClaims()` not seeing revoked sessions. Reasons in "Why this spec exists".

## Identified risks

| Risk                                                                                                      | Mitigation                                                                                                                    |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `amr` content differs from what the docs suggest (for example the signup confirmation also yields `otp`). | Step 1 observes the real claims before coding; the 15-minute window limits the exposure of a confirmation session.            |
| Recovery link opened, then the user takes longer than 15 minutes.                                         | They are redirected to `/forgot-password` and request a new link; the message is the same as for a guest.                     |
| A legitimate fast game (under 10 seconds) is saved twice in a row.                                        | The window is per game and only blocks the second save inside 10 seconds; a real run longer than 10 seconds is never blocked. |
| `create or replace function` changes `submit_score` without losing its grants.                            | The migration repeats the `revoke`/`grant` lines of SPEC 13 and the criteria check the grants.                                |
| A signed-in user wants to change their password and now has to go through the email flow.                 | Intended for this spec; a change-password form with the current password is a future spec.                                    |
| `/forgot-password` redirects signed-in users away, which would trap them.                                 | Step 2 checks it; if so, the redirect is removed for that page in the same step.                                              |

## What is **not** in this spec

- Anti-cheat or server-side score validation.
- A change-password screen with the current password, MFA or re-authentication nonce.
- Dashboard changes (secure password change, new rate limits).
- Private `username_available`, revoked-session detection in the proxy, CAPTCHA.
- Changes to the security-report file (the `security-auditor` agent owns it).

Each one of those, if it lands, goes in its own spec.
