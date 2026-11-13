# Production runbook (Supabase + Vercel)

Arcade Vault runs on two Supabase projects:

| Environment | Supabase project                                                         | Who touches it                                     |
| ----------- | ------------------------------------------------------------------------ | -------------------------------------------------- |
| Dev         | `ekupeshkawfihlnpmpvi` (linked in `supabase/.temp`, used by `.mcp.json`) | Claude Code (MCP + CLI) and you                    |
| Production  | `<PROD_REF>`                                                             | **You only.** Claude Code has no access, by design |

Placeholders: `<PROD_REF>` (project ref), `<PROD_DB_PASSWORD>` (database password), `<PROD_URL>` (production domain).

## 0. Keep Claude out of Production

- Never paste the Prod project ref, database password or API keys into a Claude Code session or a committed file.
- Do not run `supabase link` against Prod. The repo stays linked to Dev.
- Best isolation: create Prod in a **separate Supabase organization** and authorize the MCP server (OAuth) only for the Dev organization.
- A personal access token (`SUPABASE_ACCESS_TOKEN`) is scoped to your whole account. The Prod commands below use `--db-url` (the database password) instead of the token or `link`.
- Run every Prod command in **your own terminal**, not through `!` inside Claude Code (the output would land in the conversation).
- `.claude/settings.json` has `permissions.deny` rules as a safety net. They are not a guarantee.

## 1. Schema and seed data

Prod starts clean: only the schema and the seeded games are migrated. Dev users and scores are test data and stay in Dev.

Get the connection string from the Prod dashboard: Connect > Session pooler (port 5432).

```bash
# 1) Preview: must list the 10 migrations in supabase/migrations/
npx supabase db push --db-url "postgresql://postgres.<PROD_REF>:<PROD_DB_PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres" --dry-run

# 2) Apply
npx supabase db push --db-url "postgresql://postgres.<PROD_REF>:<PROD_DB_PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres"
```

Notes:

- Do **not** use `npm run db:push`: it targets the linked project (Dev).
- Do **not** use `supabase config push`: `supabase/config.toml` holds local defaults (for example minimum password 6) that would overwrite the Prod Auth settings.
- Special characters in the password must be URL-encoded in the connection string.

Then open Prod > SQL Editor, paste `supabase/checks/verify-prod.sql` and run it. Every row must be `ok`. Also open Advisors > Security: the only warnings allowed are the accepted ones (SECURITY DEFINER RPCs `submit_score`, `set_username`, `username_available`, and leaked password protection on the Free plan).

## 2. Auth configuration (Prod dashboard)

Auth settings are not in code, so repeat them by hand:

- **Auth > Email**: confirm email ON; minimum password 8; requirements "lowercase, uppercase letters, digits and symbols" (must match `validatePassword` in `lib/auth/validation.ts`).
- **Auth > Rate Limits**: sign-ups and sign-ins 10 per 5 minutes per IP.
- **Auth > URL Configuration**: Site URL `https://<PROD_URL>`; Redirect URLs `https://<PROD_URL>/**` only (no localhost in Prod).
- **Auth > SMTP (custom SMTP is required in Prod)**: the default SMTP only reaches team members and allows very few emails per hour, so with confirm email ON nobody could sign up. Use Resend with a verified domain: host `smtp.resend.com`, port 465, user `resend`, password = Resend API key, sender on your domain.
- **Auth > Email Templates** (needs custom SMTP):
  - Confirm signup: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup`
  - Reset password: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`
- **Auth > Providers (OAuth)**: create new OAuth clients for Prod (a new GitHub OAuth App and a separate Google client). Callback URL for both: `https://<PROD_REF>.supabase.co/auth/v1/callback`. Enter client id and secret in Supabase, then enable the providers.
- Leaked password protection: same as Dev (off on the Free plan, accepted risk) unless Prod is on Pro.

## 3. Vercel (Production environment only)

| Variable                               | Value                                       |
| -------------------------------------- | ------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | `https://<PROD_REF>.supabase.co`            |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Prod publishable key (`sb_publishable_...`) |
| `RESEND_API_KEY`                       | Resend key                                  |
| `CONTACT_TO_EMAIL`                     | inbox that receives contact messages        |
| `CONTACT_FROM_EMAIL`                   | sender on the verified domain               |

- Preview and Development environments keep pointing to Dev.
- Never add the secret / service-role key or `SUPABASE_ACCESS_TOKEN` to Vercel.
- Redeploy after changing variables: `NEXT_PUBLIC_*` values are baked in at build time.

## 4. Ongoing workflow

1. Claude (or you) applies a new migration to **Dev** and tests it.
2. Merge the PR so `supabase/migrations/` is up to date on `master`.
3. You run step 1 against Prod: `--dry-run` first, then the real push.
4. Re-run `supabase/checks/verify-prod.sql` (update the expected list inside it when you add migrations).

`npm run db:types` keeps generating `types/supabase.ts` from Dev; the schema is identical.

## 5. Smoke test on `https://<PROD_URL>`

- `/api/health` returns 200.
- `/games` lists the 5 games.
- Email sign-up: the email arrives and its link goes through `/auth/confirm`.
- Google and GitHub sign-in, then `/onboarding`.
- Save a score: it shows in the game leaderboard and in `/hall-of-fame`.
- Forgot password: the link ends at `/reset-password`.
- The contact form on `/about` delivers.
- Response headers include the security headers, including `Strict-Transport-Security`.
