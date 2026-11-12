import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { safeNext } from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";

const CONFIRM_TYPES: readonly EmailOtpType[] = ["signup", "email", "recovery"];

/**
 * Landing point of the links in the confirmation and password-reset emails:
 * `/auth/confirm?token_hash=…&type=signup|email|recovery[&next=/path]`.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = CONFIRM_TYPES.find((t) => t === searchParams.get("type"));

  if (!tokenHash || !type) redirect("/login?error=invalid_link");

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) redirect("/login?error=link_expired");

  // A recovery session only makes sense on the reset form.
  redirect(
    type === "recovery"
      ? "/reset-password"
      : safeNext(searchParams.get("next")),
  );
}
