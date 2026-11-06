import { connection } from "next/server";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

type HealthResponse =
  { ok: true; latencyMs: number } | { ok: false; error: string };

const TIMEOUT_MS = 5000;

function unhealthy(cause: unknown) {
  // The real cause stays in the server log; the client only gets a generic message.
  console.error("[health] Supabase check failed:", cause);
  const body = {
    ok: false,
    error: "Supabase unavailable",
  } satisfies HealthResponse;
  return Response.json(body, { status: 503 });
}

export async function GET() {
  // Opt out of prerendering: always computed at request time.
  await connection();

  const start = performance.now();

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      return unhealthy(`Auth health returned HTTP ${res.status}`);
    }

    const body = {
      ok: true,
      latencyMs: Math.round(performance.now() - start),
    } satisfies HealthResponse;
    return Response.json(body);
  } catch (error) {
    return unhealthy(error);
  }
}
