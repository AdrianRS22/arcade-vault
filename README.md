## Arcade Vault

Es una plataforma para jugar online y competir por la mayor cantidad de puntos.

## Usa Spec Driven Design

Basado en /spec y /spec-impl

Siguiendo las buenas practicas recomendadas aquí:
https://github.com/Klerith/fernando-skills

## Skills usadas

```bash
npx skills@latest add Klerith/fernando-skills
```

## Commands

- `npm run dev` — dev server (Turbopack)
- `npm run build` / `npm start` — production build / serve
- `npm run lint` — ESLint (flat config, `eslint.config.mjs`)
- No test runner is configured yet.

## Supabase

The app is connected to the Supabase project `ekupeshkawfihlnpmpvi` (remote, no Docker). There is no schema yet; this is only the foundation.

### Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Var                                    | Purpose                                                                                      |
| -------------------------------------- | -------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Project API URL                                                                              |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (`sb_publishable_…`), safe in the browser once RLS exists                    |
| `SUPABASE_ACCESS_TOKEN`                | Personal access token (Dashboard > Account > Access Tokens). Supabase CLI only, never public |

Never add a secret / service-role key to the code or the env files.

### Clients

- `lib/supabase/server.ts`: `await createClient()` for Server Components, Server Actions and Route Handlers (dynamic contexts only, not inside `"use cache"`).
- `lib/supabase/client.ts`: `createClient()` for Client Components.
- Both are typed with `Database` from `types/supabase.ts` (generated, never edit by hand).

### Database commands

- `npm run db:types` — regenerate `types/supabase.ts` from the remote schema.
- `npm run db:push` — apply the migrations in `supabase/migrations/` to the remote project.

First time on a machine: `npx supabase link --project-ref ekupeshkawfihlnpmpvi` (needs `SUPABASE_ACCESS_TOKEN`).

### Health check

`GET /api/health` checks from the server that the URL and key reach Supabase:

- `200` `{ "ok": true, "latencyMs": 123 }`
- `503` `{ "ok": false, "error": "Supabase unavailable" }` — the real cause is in the server log.

```bash
curl localhost:3000/api/health
```
