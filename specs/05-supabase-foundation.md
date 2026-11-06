# SPEC 05 — Supabase foundation

> **Status:** Implemented
> **Depends on:** SPEC 01
> **Date:** 2026-11-06
> **Objective:** Connect the Next.js app to the existing Supabase project with typed server and browser clients, a versioned migrations folder and a `/api/health` endpoint that proves the connection, without changing any feature yet.

## Why this spec exists

The Supabase project is created and the MCP is configured, but the app has no client, no env vars for the API and no place for schema changes. Auth, scores and games will move to Supabase in later specs. They all need the same base, so it lands first and alone.

## Scope

**In:**

- Install `@supabase/supabase-js` and `@supabase/ssr` (dependencies) and `supabase` CLI (devDependency).
- `supabase init` → `supabase/config.toml` and an empty `supabase/migrations/` (with `.gitkeep`), linked to project `ekupeshkawfihlnpmpvi`.
- `lib/supabase/server.ts`: `createClient()` for Server Components, Server Actions and Route Handlers (`createServerClient` + `await cookies()`).
- `lib/supabase/client.ts`: `createClient()` for Client Components (`createBrowserClient`).
- `lib/supabase/env.ts`: reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` once (static `process.env.*` references so Next inlines them in the browser) and throws a clear error if one is missing. Shared by both clients.
- `types/supabase.ts`: generated `Database` type, committed; both clients typed with it.
- npm scripts `db:types` (regenerate types) and `db:push` (apply migrations).
- `app/api/health/route.ts`: `GET` that checks Supabase from the server.
- Env vars `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.example` (empty) and `.env.local` (real values).
- Short "Supabase" section in `README.md` (env vars, `db:types`, `db:push`, `/api/health`).

**Out of scope (for future specs):**

- Supabase Auth and replacing `session-provider.tsx`.
- `proxy.ts` (session refresh); goes with the Auth spec.
- Any table, RLS policy or migration with real schema.
- Moving `app/data/games.ts`, `scores.ts` or `activity.ts` to the database.
- Secret / service-role key and admin operations.
- Local Supabase stack with Docker.
- Any visible UI change.

## Data model

No tables. New types, files and env vars:

```ts
// types/supabase.ts — generated, never edited by hand
export type Database = {
  public: { Tables: {}; Views: {}; Functions: {} /* … */ };
};
```

```ts
// lib/supabase/server.ts
export async function createClient(): Promise<SupabaseClient<Database>>;
// lib/supabase/client.ts
export function createClient(): SupabaseClient<Database>;
```

```ts
// GET /api/health
type HealthResponse =
  | { ok: true; latencyMs: number } // 200
  | { ok: false; error: string }; // 503, generic message, no secrets
```

| Var                                    | Example                                    | Purpose                                           |
| -------------------------------------- | ------------------------------------------ | ------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | `https://ekupeshkawfihlnpmpvi.supabase.co` | Project API URL                                   |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_xxx`                       | Public key, safe in the browser once RLS exists   |
| `SUPABASE_ACCESS_TOKEN`                | (already exists)                           | Supabase CLI only: `link`, `db push`, `gen types` |

npm scripts:

- `db:types`: `supabase gen types typescript --remote > types/supabase.ts`
- `db:push`: `supabase db push --remote`

## Implementation plan

1. Install `@supabase/supabase-js`, `@supabase/ssr` and `supabase` (dev). Check peer deps with React 19.3 / Next 16.4.5. App still builds.
2. Add the two `NEXT_PUBLIC_SUPABASE_*` vars to `.env.example` (empty, with comments) and real values to `.env.local` (URL and publishable key from the Supabase MCP / dashboard). Confirm `.env*.local` stays ignored.
3. Run `npx supabase init` and `npx supabase link --project-ref ekupeshkawfihlnpmpvi`. Add `supabase/migrations/.gitkeep`. Make sure `supabase/.temp/` and `supabase/.branches/` are git-ignored.
4. Add the `db:types` and `db:push` scripts and generate `types/supabase.ts`.
5. Create `lib/supabase/env.ts` (reads the env vars once and throws a clear error if one is missing), then `lib/supabase/server.ts` and `lib/supabase/client.ts`, typed with `Database` and using the values from `env.ts`.
6. Create `app/api/health/route.ts`. It runs dynamically (check `node_modules/next/dist/docs/` for Route Handlers under `cacheComponents`, e.g. `await connection()`), calls `${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health` with the publishable key as `apikey`, measures latency, returns 200 / 503 with the shape above and logs the real cause server-side. Manual check: `curl localhost:3000/api/health`.
7. Add the "Supabase" section to `README.md`.

Before writing code, read `node_modules/next/dist/docs/` (Route Handlers, `cookies()`, Cache Components, environment variables) and the current `@supabase/ssr` Next.js guide.

## Acceptance criteria

- [x] `npm run lint` finishes with no errors.
- [x] `npm run build` finishes with no errors.
- [x] `GET /api/health` with valid env vars returns 200 and `{ "ok": true, "latencyMs": <number> }`.
- [x] With a wrong `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `GET /api/health` returns 503 with `ok: false` and the server log shows the cause.
- [x] `/api/health` is not cached: two calls return different `latencyMs` or are both computed at request time (no prerendered response in the build output).
- [x] `npm run db:types` regenerates `types/supabase.ts` with no diff on a clean tree.
- [x] `lib/supabase/server.ts` and `lib/supabase/client.ts` return clients typed with `Database`; a missing env var fails with a clear error from `lib/supabase/env.ts`.
- [x] `supabase/config.toml` and `supabase/migrations/` exist in the repo; `supabase/.temp/` is not committed.
- [x] `.env.example` lists `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` with empty values; no real key is committed.
- [x] No secret / service-role key appears anywhere in the code or env files.
- [x] Every existing route (`/`, `/games`, `/games/block-buster`, `/hall-of-fame`, `/login`, `/about`) looks and behaves the same as before.

## Decisions

- **Yes:** foundation-only spec. Auth, scores and games each need their own decisions; mixing them makes the spec too big.
- **Yes:** `@supabase/ssr` for both clients. Official way to share the session through cookies with the App Router; ready for the Auth spec.
- **Yes:** Supabase CLI + `supabase/migrations/` in the repo. Versioned, reproducible schema history.
- **No:** migrations only through the MCP or by hand in the dashboard. No history in the code.
- **Yes:** generated `types/supabase.ts`, committed. Fits TypeScript `strict`; regenerated with `db:types`.
- **Yes:** remote project `ekupeshkawfihlnpmpvi` for development. No Docker needed.
- **No:** local stack with Docker. More setup for no benefit while there is no schema.
- **Yes:** publishable key (`sb_publishable_`). Supabase's current key system.
- **No:** legacy anon JWT key. Being phased out.
- **No:** secret / service-role key. No admin use case yet.
- **No:** `proxy.ts` now. Without real login there is no session to refresh; it would run on every request for nothing.
- **Yes:** `/api/health` Route Handler to verify. Works with an empty database and can be reused for monitoring.
- **Yes:** health check hits `/auth/v1/health` with the publishable key. It validates URL and key without needing a table.
- **No:** a throwaway migration just to test the connection. Puts fake schema in a foundation spec.
- **No:** `npm run db:check` script instead of the endpoint. Does not prove the deployed app can reach Supabase.
- **Yes:** `lib/supabase/` and `types/` at repo root (`@/lib/...`). Matches the official Supabase guide.

## Risks

| Risk                                                                                         | Mitigation                                                                                                                   |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `cacheComponents` prerenders or caches `/api/health`                                         | Read the Route Handler docs in `node_modules/next/dist/docs/`; force request-time rendering; acceptance criterion checks it. |
| `@supabase/ssr` cookie API differs from older examples (`get/set/remove` vs `getAll/setAll`) | Follow the current guide; use `getAll`/`setAll`.                                                                             |
| `cookies()` called in a cached scope breaks the build                                        | `lib/supabase/server.ts` is only used in dynamic contexts; documented in the file.                                           |
| `supabase link` / `db push` need a personal access token                                     | `SUPABASE_ACCESS_TOKEN` in `.env.local`; never committed.                                                                    |
| Publishable key is public and there are no RLS policies yet                                  | No tables exist; every future table spec must enable RLS.                                                                    |
| Generated types change between CLI versions                                                  | `supabase` CLI pinned as devDependency.                                                                                      |

## What is **not** in this spec

- Supabase Auth, login and `proxy.ts`.
- Tables, RLS and moving games/scores/activity to the database.
- Secret key and local Docker stack.

Each one of those, if it lands, goes in its own spec.
