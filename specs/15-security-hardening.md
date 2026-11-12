# SPEC 15 — Security hardening

> **Status:** Approved
> **Depends on:** SPEC 13, SPEC 14
> **Date:** 2026-11-11
> **Objective:** Close the basic security checklist (`references/security-checklist.md`): security headers in Next.js, no API access to `rls_auto_enable()`, password rules aligned with the Supabase dashboard, route protection in `proxy.ts` for the private routes, verified RLS and Auth settings, and the remaining linter warnings either fixed or documented as accepted.

## Why this spec exists

Accounts and score saving are live (SPEC 13–14). The Supabase security linter reports SECURITY DEFINER functions callable through `/rest/v1/rpc` and leaked password protection disabled, and the app sends no security headers. This spec fixes what can be fixed in code, sets the dashboard limits, and records why the rest stays.

## Scope

**In:**

- `next.config.ts`: `headers()` applying to `source: "/(.*)"`:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains` **only when `process.env.NODE_ENV === "production"`**.
  - Read `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/headers.md` before writing it.
- Migration `<timestamp>_lock_rls_auto_enable.sql`: `revoke execute on function public.rls_auto_enable() from public, anon, authenticated;`. Guarded with `if exists` (via a `do` block) so it does not fail on a project without the function. The event trigger (if any) keeps working.
- RLS verification (no change expected): `games`, `scores` and `profiles` have `relrowsecurity = true`.
- Accepted linter warnings, documented in `CLAUDE.md` (Supabase section) with their reason:
  - `submit_score(p_game_id, p_score)` — `authenticated` only; takes the player from the session.
  - `set_username(p)` — `authenticated` only; sets the name once.
  - `username_available(p)` — `anon` + `authenticated`; returns only a boolean, needed by sign-up before a session exists.
- Password strength aligned with the dashboard rule "lowercase, uppercase letters, digits and symbols" (already selected by the user):
  - `lib/auth/validation.ts`: `validatePassword` also requires at least one lowercase letter, one uppercase letter, one digit and one symbol (any non-alphanumeric character), with a message naming what is missing. Shared by the client forms and the actions, so `signUp` and `updatePassword` enforce it on the server.
  - `app/login/actions.ts`: the two `weak_password` branches (sign-up, update password) show the full requirements message instead of `validatePassword("")` (today that returns only the length message, which would be wrong).
  - Sign-up and `/reset-password` forms show the rule as a hint under the password field (reusing the existing `.field` styles).
  - Sign-in is not affected: existing passwords keep working, Supabase only checks strength on sign-up and password change.
- Route protection in `proxy.ts` (today the proxy only refreshes cookies; each page checks the session on its own):
  - `lib/auth/routes.ts` (client-safe, no server imports): `PROTECTED_ROUTES`, a map from path to the redirect used for guests: `/onboarding` → `/login?next=/onboarding`, `/reset-password` → `/forgot-password`. Matching is exact or by sub-path (`/onboarding/...`). Adding a private route later means adding one entry.
  - `lib/supabase/proxy.ts`: `updateSession` returns `{ response, user }` (user id from the `getClaims()` result it already calls; no second Supabase call). A guest on a protected route gets a redirect response that **carries the refreshed session cookies and Cache-Control headers** (copy them from the `NextResponse.next` response).
  - `proxy.ts`: applies the map; the matcher stays as it is. Server Action POSTs to a protected page go through the same check.
  - Defense in depth: the existing checks in `app/onboarding/page.tsx`, `app/onboarding/actions.ts`, `app/reset-password/page.tsx` and `app/login/actions.ts` stay (they also cover the username and recovery-session rules). The proxy is only the first gate; data stays protected by RLS and the RPC grants.
  - Not protected by design: `/`, `/games`, `/games/[id]`, `/games/[id]/play` (guests can play), `/hall-of-fame`, `/about`, `/login`, `/forgot-password`, `/auth/*`, `/api/health`. `/login` keeps its own redirect for signed-in users.
  - Read `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md` and the proxy docs before changing `proxy.ts`.
- Manual dashboard steps (done by the user, listed in the verification):
  - Auth → Providers → Email: minimum password length 8 (confirm it is still set) and password requirements "lowercase, uppercase letters, digits and symbols" (already set).
  - Auth → Rate Limits: sign-ups and sign-ins **10 per 5 minutes per IP**.
  - Leaked password protection: not available on the Free plan; recorded as an accepted risk.
- `CLAUDE.md` updated: security headers note (Architecture), route protection (the Auth note currently says "no route protection"), accepted warnings, password rule and dashboard settings (Supabase / Auth dashboard setup).

**Out of scope (for future specs):**

- Content-Security-Policy (needs nonces through `proxy.ts` with Cache Components, Supabase, Google Fonts and the game canvases).
- Moving the RPCs to a private schema with SECURITY INVOKER wrappers.
- Rate limiting `submit_score`, the contact form or other Server Actions; CAPTCHA.
- Roles or permissions beyond signed-in / guest, and protecting public pages such as the player.
- Upgrading to the Pro plan to enable leaked password protection.
- MFA, anti-cheat.

## Data model

No new tables, columns or functions. Only a privilege change:

```sql
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  ) then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
```

`types/supabase.ts` is regenerated afterwards (`npm run db:types`); it may drop `rls_auto_enable` from `Functions`.

## Implementation plan

1. **Headers.** Add `headers()` to `next.config.ts` with the list above, HSTS only in production. Check: `npm run build` + `npm start`, `curl -I http://localhost:3000/` shows the five headers; `npm run dev` shows four (no HSTS).
2. **Migration.** Write `<timestamp>_lock_rls_auto_enable.sql`, `npm run db:push`, `npm run db:types`. Check: `has_function_privilege('anon', 'public.rls_auto_enable()', 'execute')` and the same for `authenticated` return `false`; `get_advisors` (security) no longer lists `rls_auto_enable`.
3. **Password rules.** Update `validatePassword`, the `weak_password` mapping in `app/login/actions.ts` and the hints in the sign-up and reset forms. Check: `Password1` (no symbol) is rejected with a visible message in sign-up and reset; `Password1!` is accepted; signing in with an older weak password still works.
4. **Route protection.** Create `lib/auth/routes.ts`, make `updateSession` return `{ response, user }`, add the guest redirect in `proxy.ts` (cookies and headers copied to the redirect). Check: guest `GET /onboarding` → 307 to `/login?next=%2Fonboarding`; guest `GET /reset-password` → 307 to `/forgot-password`; signed-in user reaches both; `npm run build` passes.
5. **RLS check.** Query `pg_class.relrowsecurity` for `games`, `scores`, `profiles`. Check: all `true`.
6. **Dashboard.** User sets the rate limit to 10 / 5 min / IP and confirms minimum password 8 plus the character requirements. Check: settings visible in the dashboard; a 7-character password and `password1!` (no uppercase) are rejected by Supabase Auth even when the action validation is bypassed (direct `auth.signUp` from the browser client).
7. **Docs.** Update `CLAUDE.md` (headers, route protection, accepted warnings, password rule, dashboard settings, Free-plan note).
8. **Verification pass.** `npm run lint`, `npm run build`; smoke test with Playwright at 375×812 and 1440×900 (home, a game playing, login, saving a score, guest vs signed-in on `/onboarding` and `/reset-password`) to confirm the headers and the proxy redirects break nothing. Screenshots `spec-15-<screen>.png` in `.playwright-screenshots/`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors; `types/supabase.ts` is regenerated, not hand-edited.
- [ ] Every response from the production server (`npm start`) includes `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, the `Permissions-Policy` above and `Strict-Transport-Security: max-age=63072000; includeSubDomains`.
- [ ] The dev server does not send `Strict-Transport-Security`.
- [ ] Home, game play, login (email and OAuth redirect start), onboarding and SAVE SCORE still work with the headers on, at 375×812 and 1440×900.
- [ ] A guest requesting `/onboarding` is redirected by `proxy.ts` to `/login?next=/onboarding`, and `/reset-password` to `/forgot-password`, before any page code runs (checked with `curl -i`, no `Set-Cookie` lost).
- [ ] A signed-in user opens `/onboarding` and `/reset-password` normally; the email confirm link (recovery) and the OAuth callback still land on them with the new session.
- [ ] Public routes (`/`, `/games`, `/games/[id]/play`, `/hall-of-fame`, `/about`, `/login`, `/forgot-password`, `/auth/*`, `/api/health`) stay reachable as a guest.
- [ ] A session refreshed in the proxy keeps working after a redirect (refreshed cookies are present on the redirect response).
- [ ] The per-page checks still reject a guest if the proxy is bypassed (page and Server Action).
- [ ] `anon` and `authenticated` cannot execute `public.rls_auto_enable()`; the security advisor no longer reports it.
- [ ] RLS is enabled on `games`, `scores` and `profiles`.
- [ ] The only remaining security advisor warnings are the three documented SECURITY DEFINER RPCs and leaked password protection.
- [ ] Supabase Auth rejects passwords shorter than 8 characters or missing a lowercase letter, uppercase letter, digit or symbol, and the sign-up/sign-in rate limit is 10 per 5 minutes per IP.
- [ ] Sign-up and `/reset-password` reject a password without a symbol (e.g. `Password1`) with a message listing the requirements, both in the form and in the Server Action; `Password1!` is accepted.
- [ ] A `weak_password` error from Supabase shows the full requirements message, not only the length rule.
- [ ] Existing users sign in with their current password unchanged.
- [ ] `CLAUDE.md` lists the headers, the accepted warnings with their reason and the dashboard settings.

## Decisions taken and discarded

- **Accept the three SECURITY DEFINER RPC warnings.** They are the designed write path (SPEC 13–14), with minimal grants and `search_path = ''`. Discarded: private schema + invoker wrappers (more migrations and regression risk for no real gain).
- **Revoke EXECUTE on `rls_auto_enable()` instead of dropping it.** Keeps automatic RLS on new tables while removing it from the API. Discarded: dropping the function.
- **Checklist headers + HSTS + Permissions-Policy.** Low risk, high value. Discarded: CSP in this spec (complex with Cache Components; own spec).
- **HSTS only in production, 2 years, `includeSubDomains`, no `preload`.** Avoids pinning localhost / LAN IP; `preload` is hard to undo.
- **Rate limit 10 per 5 minutes per IP.** Enough for a human retrying, stops scripted sign-ups. Discarded: default 30 (too loose), 5 (blocks shared IPs).
- **Password requirements: lowercase, uppercase, digits and symbols, mirrored in the app.** Chosen by the user in the dashboard; the app repeats the rule so users see the reason before Supabase rejects it. Discarded: relying only on the Supabase error.
- **Protect private routes in `proxy.ts` and keep the page checks.** The user asked for route protection in this spec. The proxy gives an early redirect from one central map; the page and action checks stay because they also enforce the recovery session and username rules, and because Next advises not to rely on the proxy alone. Discarded: proxy-only protection; a separate spec.
- **Only `/onboarding` and `/reset-password` are private.** They are the only routes that need a session today; guests must still play and see rankings. Discarded: protecting `/games/[id]/play` (would end guest play, a SPEC 13 decision).
- **Reuse the `getClaims()` call already in `updateSession`.** No extra network call per request. Claims are enough for a redirect decision; the pages still verify with `getUser()` where it matters.
- **Leaked password protection not enabled.** Free plan; recorded as accepted risk instead of a plan upgrade.

## Identified risks

- `X-Frame-Options: DENY` blocks embedding the site in any iframe (including preview tools); acceptable, nothing embeds it today.
- The Supabase rate limit is shared by sign-up and sign-in and counts per IP; players behind the same NAT can hit it.
- Leaked password protection stays off: users can choose a known-breached password of 8+ characters.
- `rls_auto_enable()` lives outside the migrations; if the dashboard recreates it, the grants may come back. The migration is idempotent and can be re-run.
- The dashboard rule is already active while the app still checks length only: until step 3 ships, a sign-up with a password like `password1` gets the misleading length message. Ship step 3 early.
- If the app rule and the dashboard rule drift apart (someone changes the dashboard), users see Supabase's `weak_password` message; keep both documented in `CLAUDE.md`.
- A redirect built in the proxy that drops the refreshed `Set-Cookie` headers would log the user out on the next request; the plan copies cookies and Cache-Control headers onto it and the criteria check it.
- Recovery and OAuth flows set the session in a route handler and then redirect to a protected page; the cookie must already be on that request. Test both flows end to end.
- `getClaims()` validates the JWT locally, so a revoked session can pass the proxy until the token expires; the pages' `getUser()` checks remain the authority.
- HSTS depends on `NODE_ENV`; a production deploy that is not built with `NODE_ENV=production` would not send it.
