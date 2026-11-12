# SPEC 14 — OAuth and username onboarding

> **Status:** Implemented
> **Depends on:** SPEC 13
> **Date:** 2026-11-11
> **Objective:** Add Google and GitHub sign-in and a mandatory `/onboarding` step where OAuth players choose their unique username before they can save scores.

## Why this spec exists

SPEC 13 delivers email + password accounts with the username chosen at sign-up. OAuth users arrive without one, and the leaderboard needs a unique `^[A-Z0-9_]{1,10}$` name. This spec adds the two providers and the onboarding step that fills `profiles.username`.

## Scope

**In:**

- GOOGLE and GITHUB buttons back in `app/_components/auth-form.tsx`, calling `signInWithOAuth` with `redirectTo = <origin>/auth/callback?next=<safe next>`. Same `next` safety rule as SPEC 13.
- `app/auth/callback/route.ts` (GET): `exchangeCodeForSession(code)`, then redirects to `/onboarding?next=…` if the profile has no username, otherwise to `next` or `/`. On error: `/login?error=oauth`.
- Migration `<timestamp>_set_username.sql`: RPC `public.set_username(p text) returns void` (`security definer`, `set search_path = ''`, `execute` to `authenticated` only). It validates the pattern, uppercases, and updates the caller's profile only while `username is null`; a duplicate raises a clear error.
- `/onboarding` page: username form (reuses `username_available`), requires a session (guest → `/login`), redirects to `next` or `/` if the username already exists. Server Action `setUsername` in `app/onboarding/actions.ts`.
- `SessionProvider` exposes `needsUsername` (signed in, profile username null). Nav shows a `CHOOSE NAME` link to `/onboarding` instead of `USERNAME ▾` in that case.
- `saveScore` returns a "Choose your username first" error when the username is null; the GAME OVER modal shows a link to `/onboarding?next=/games/<id>/play`.
- `CLAUDE.md` updated (routes, OAuth notes).
- UI built with the `/frontend-design` skill.
- Manual dashboard steps, done by the user:
  - Google Cloud: OAuth client (Web), authorized redirect URI `https://ekupeshkawfihlnpmpvi.supabase.co/auth/v1/callback`.
  - GitHub: OAuth App with the same callback URL.
  - Supabase → Auth → Providers: enable Google and GitHub with the client id/secret; add `/auth/callback` to the redirect URLs (local and production).

**Out of scope (for future specs):**

- Other providers, linking or unlinking identities from a settings page.
- Changing the username after onboarding.
- Importing avatar or display name from the provider.

## Data model

No new tables. One new function:

```sql
create function public.set_username(p text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if p is null or upper(p) !~ '^[A-Z0-9_]{1,10}$' then
    raise exception 'invalid username' using errcode = '22023';
  end if;
  update public.profiles set username = upper(p)
  where id = auth.uid() and username is null;
  if not found then raise exception 'username already set' using errcode = '22023'; end if;
end; $$;
```

A unique violation on `profiles.username` surfaces as "username taken" in the action. `SessionContextValue` gains `needsUsername: boolean`.

## Implementation plan

1. **Migration.** `set_username`, `npm run db:push`, `npm run db:types`. Check: anon call fails; authenticated call with a taken or invalid name fails.
2. **Callback route.** `app/auth/callback/route.ts`. Check: build passes; a bad code redirects to `/login?error=oauth`.
3. **Buttons.** OAuth buttons in `AuthForm` and `/login?error=oauth` message. Check: lint passes; click starts the provider redirect.
4. **Onboarding.** Page, action, redirects. Check: a user with null username can pick a name once.
5. **Session, Nav and saveScore.** `needsUsername`, `CHOOSE NAME` link, game-over link. Check: an OAuth user without username cannot save a score and is guided to onboarding.
6. **Docs and verification.** Update `CLAUDE.md`; `npm run lint`, `npm run build`; Playwright at 375×812 and 1440×900; screenshots `spec-14-<screen>.png` in `.playwright-screenshots/`.

## Acceptance criteria

- [x] `npm run lint` and `npm run build` finish with no errors.
- [x] GOOGLE and GITHUB buttons start the provider flow and return to `/auth/callback`.
- [x] A first-time OAuth user ends up in `/onboarding`; an existing user with a username goes straight to `next` or `/`.
- [x] `/onboarding` rejects invalid or taken usernames with a visible message and accepts a valid one, then redirects to `next` or `/`.
- [x] `set_username` cannot change an existing username and cannot be called as `anon`.
- [x] Without a username, Nav shows `CHOOSE NAME` and SAVE SCORE is replaced by a link to `/onboarding`; `saveScore` refuses.
- [x] An unsafe `next` (`//evil.com`, absolute URLs) falls back to `/` in callback and onboarding.
- [x] A failed or cancelled OAuth attempt shows an error on `/login` and creates no session.

## Decisions taken and discarded

- **Mandatory onboarding screen.** The user chooses the public ranking name. Discarded: autogenerated username (e.g. `KAI_4821`), which would need a rename feature right away.
- **One-time `set_username` RPC instead of a general update policy.** Keeps `profiles` write-locked; renaming is out of scope.
- **Google and GitHub only.** Discarded: other providers.

## Identified risks

- The same email used with password and OAuth: Supabase links verified identities, so test both orders.
- Provider apps need real URLs for production; local and production callbacks differ.
- Users who abandon onboarding keep a profile with a null username; harmless, but they cannot save scores.
- Two users picking the same username at once: the unique constraint decides, the loser sees "username taken".
