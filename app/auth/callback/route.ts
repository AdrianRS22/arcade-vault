import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { safeNext } from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";

/**
 * Return point of the OAuth providers (Google, GitHub):
 * `/auth/callback?code=…[&next=/path]`.
 *
 * Exchanges the code for a session, then sends players without a username to
 * `/onboarding` and everyone else to `next` (or `/`).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (!code) redirect("/login?error=oauth");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) redirect("/login?error=oauth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile?.username) {
    redirect(`/onboarding?next=${encodeURIComponent(next)}`);
  }

  redirect(next);
}
