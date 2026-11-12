import { type NextRequest, NextResponse } from "next/server";

import { guestRedirectFor } from "@/lib/auth/routes";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);

  // First gate for private routes. The pages and Server Actions keep their
  // own checks (username / recovery-session rules); data stays behind RLS.
  if (!user) {
    const target = guestRedirectFor(request.nextUrl.pathname);
    if (target) {
      const redirect = NextResponse.redirect(new URL(target, request.url));
      // Carry the refreshed session cookies and the no-cache headers over,
      // otherwise a refresh done in this request would be lost.
      response.cookies
        .getAll()
        .forEach((cookie) => redirect.cookies.set(cookie));
      ["cache-control", "expires", "pragma"].forEach((name) => {
        const value = response.headers.get(name);
        if (value) redirect.headers.set(name, value);
      });
      return redirect;
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Skip Next internals, the health check and static assets.
    "/((?!_next/static|_next/image|api/health|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp3|wav|ogg|json)$).*)",
  ],
};
