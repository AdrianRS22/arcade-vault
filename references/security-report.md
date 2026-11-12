# Security report

- Date: 2026-11-11
- Mode: full
- Branch / commit: spec-15-security-hardening / d3844a5
- Summary: Critical 0, High 0, Medium 0, Low 2, Info 2. New this run: 4 (first run). Resolved: 0. Regressed: 0.

## Findings

| ID | Severity | Area | Location | Status |
| --- | --- | --- | --- | --- |
| SEC-001 | Low | DB | views `games_with_best`, `player_bests`, `top_players_today` | open |
| SEC-002 | Low | Config | `next.config.ts` (`poweredByHeader`) | open |
| SEC-003 | Info | App | `npm audit --omit=dev` (4 low) | open |
| SEC-004 | Info | Config | `.env*` git history | open |

### SEC-001 Views carry full table privileges for anon and authenticated (Low, DB)

Evidence: `information_schema.role_table_grants` shows `DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE` for `anon` and `authenticated` on the three views. All are `security_invoker=true`, they aggregate (not auto-updatable), and the underlying `games`/`scores` grants are SELECT only, with no write policies. So no write path exists today.

Impact: defense in depth only. If a view is ever redefined as a simple updatable view, or a write grant is added to `scores`/`games`, the view becomes a write path. Writes would still hit RLS, but the surface is wider than the intended read-only design.

Fix (new migration, text only):

```sql
revoke insert, update, delete, truncate, references, trigger
  on public.games_with_best, public.player_bests, public.top_players_today
  from anon, authenticated;
-- and to cover future views:
alter default privileges in schema public
  revoke insert, update, delete, truncate, references, trigger on tables from anon, authenticated;
```

### SEC-002 `X-Powered-By: Next.js` header is sent (Low, Config)

Evidence: `curl -sI http://localhost:3000/` returns `X-Powered-By: Next.js`.

Impact: minor fingerprinting, no direct attack.

Fix: in `next.config.ts` add `poweredByHeader: false,` to `nextConfig`.

### SEC-003 Dependency audit: 4 low vulnerabilities (Info, App)

Evidence: `npm audit --omit=dev`: critical 0, high 0, moderate 0, low 4 (`@react-email/components` -> `@react-email/render` -> `html-to-text` -> `deepmerge` prototype poisoning, GHSA-gcqx-w48m-w2h4). No fix available. Used only to render the contact email from validated input.

Fix: none required; re-check when `@react-email/components` publishes a fix.

### SEC-004 `.env*` history contains only `.env.example` (Info, Config)

Evidence: `git log --all -- '.env*'` touches only `.env.example`; `git ls-files` lists no other env file; `.env.local` exists locally and is ignored. The `eyJ` string hits in `references/templates/.../arcade-vault-standalone.html` are base64 noise in an embedded bundle, not JWTs. No `service_role`, `sk_` or private key found in tracked code.

Fix: none. Rotate `SUPABASE_ACCESS_TOKEN` and the DB password if they were ever exposed (see Manual checks); commit `4b03b7a` message mentions a DB password in env config, but only `.env.example` was tracked.

## Verified OK

- RLS enabled on `games`, `scores`, `profiles` (all tables in `public`). Policies: SELECT only (`games`, `scores` for anon + authenticated; `profiles` own row via `(select auth.uid())`). No insert/update/delete policies.
- Table grants: tables have SELECT only (`profiles` only for `authenticated`).
- Functions: all SECURITY DEFINER with fixed `search_path` (empty; `rls_auto_enable` uses `pg_catalog`). Execute: `submit_score`, `set_username` authenticated only; `username_available` anon + authenticated; `handle_new_user` and `rls_auto_enable` not executable by anon/authenticated/public.
- Views are `security_invoker=true` and expose no `auth.users` data, emails or `user_id`.
- Trigger `on_auth_user_created` enabled; handles missing username metadata.
- Constraints: username pattern + unique, `scores_score_check` 0..9,999,999, `scores_player_check`.
- Migrations: 10 remote, 10 local files, no drift.
- App: five headers present, HSTS gated on production; `proxy.ts` map and matcher correct; every action validates server-side and takes identity from the session; `safeNext` guards login, onboarding, confirm and callback; forgot-password answers uniformly; no `dangerouslySetInnerHTML`; email rendered through React Email (escaped); no service-role usage; `createClient()` not used inside `"use cache"` files; `validatePassword` matches the documented rule.
- Runtime (dev server on localhost:3000): guest `/onboarding` 307 to `/login?next=/onboarding`; `/reset-password` 307 to `/forgot-password`; `/auth/confirm` and `/auth/callback` with `next=//evil.com` stay on-site.

## Accepted risks

- `submit_score`, `set_username` (authenticated) and `username_available` (anon + authenticated, boolean) as SECURITY DEFINER RPCs: SPEC 15. Advisor warnings for these are baseline.
- Leaked password protection disabled: Free plan.

## Known gaps (not findings)

No CSP, no rate limit on `submit_score` or the contact form, no anti-cheat, no MFA, no CAPTCHA, `X-Frame-Options: DENY` blocks embedding.

## Manual checks

- Confirm email on; minimum password 8 with lowercase, uppercase, digits and symbols.
- Rate limit 10 sign-ups/sign-ins per 5 minutes per IP.
- Site URL and redirect URLs (local and production, `/auth/confirm`, `/auth/callback`).
- Email templates (signup, recovery) and custom SMTP.
- Google and GitHub provider secrets not shared; rotate any exposed project access token or DB password.

## Not verified

- HSTS header (dev server runs with `NODE_ENV=development`; check against a production build/deploy).
- Dashboard auth settings above (not visible from code or SQL).
- Auth/API logs not queried (no bursts check done).

## Changes since the previous run

First run: baseline created. Advisors match the baseline (3 SECURITY DEFINER warnings for the accepted RPCs, leaked password protection); performance advisor shows only an unused index `scores_user_idx` (Info, not a finding).
