// Client-safe route protection map (no server imports), used by `proxy.ts`.
// Adding a private route later means adding one entry here.

/** Private routes: path -> where a guest is sent. */
export const PROTECTED_ROUTES: Record<string, string> = {
  "/onboarding": "/login?next=/onboarding",
  "/reset-password": "/forgot-password",
};

/**
 * Redirect target for a guest requesting `pathname`, or `null` when the route
 * is public. Matches the exact path or any sub-path (`/onboarding/...`).
 */
export function guestRedirectFor(pathname: string): string | null {
  for (const [route, target] of Object.entries(PROTECTED_ROUTES)) {
    if (pathname === route || pathname.startsWith(`${route}/`)) return target;
  }
  return null;
}
