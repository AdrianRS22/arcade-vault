"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/supabase";

/**
 * `name` is the profile username (uppercase, max 10 chars). While the profile
 * has none (OAuth, before onboarding) `name` is a placeholder and
 * `needsUsername` is true.
 */
export type SessionUser = { id: string; name: string; needsUsername: boolean };

type SessionStatus = "loading" | "ready";

type SessionContextValue = {
  user: SessionUser | null;
  status: SessionStatus;
  /** Signed in, but the profile has no username yet (SPEC 14 onboarding). */
  needsUsername: boolean;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

// Profiles created without a username (OAuth, SPEC 14) get a placeholder
// until onboarding lets the player pick one.
const FALLBACK_NAME = "PLAYER";

async function loadUser(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<SessionUser> {
  const { data } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", id)
    .maybeSingle();
  const username = data?.username ?? null;
  return {
    id,
    name: username ?? FALLBACK_NAME,
    needsUsername: username === null,
  };
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");
  const supabaseRef = useRef<SupabaseClient<Database> | null>(null);
  const syncRef = useRef<(() => void) | null>(null);
  // True while a re-check on navigation is needed: signed out, or signed in
  // without a username. Server Action redirects (sign-in, onboarding) do not
  // remount this provider.
  const staleRef = useRef(false);
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();
    supabaseRef.current = supabase;
    let active = true;

    const apply = async (id: string | null) => {
      const next = id ? await loadUser(supabase, id) : null;
      if (!active) return;
      staleRef.current = next === null || next.needsUsername;
      // Keep the same object when nothing changed (token refreshes).
      setUser((prev) =>
        prev?.id === next?.id &&
        prev?.name === next?.name &&
        prev?.needsUsername === next?.needsUsername
          ? prev
          : next,
      );
      setStatus("ready");
    };

    // Validates the session against the Auth server.
    const sync = () =>
      void supabase.auth
        .getUser()
        .then(({ data }) => apply(data.user?.id ?? null));
    syncRef.current = sync;
    sync();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // INITIAL_SESSION is covered by getUser() above. Defer the work: the
      // callback must not await other Supabase calls.
      if (event === "INITIAL_SESSION") return;
      setTimeout(() => void apply(session?.user.id ?? null), 0);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // A Server Action sign-in (or username choice) redirects without remounting
  // this provider, and the browser client does not see the new cookies by
  // itself. Re-check on navigation while signed out (no cookie means no
  // network call) or while the username is still missing.
  useEffect(() => {
    if (status === "ready" && staleRef.current) syncRef.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const signOut = useCallback(async () => {
    await supabaseRef.current?.auth.signOut();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      needsUsername: user?.needsUsername ?? false,
      signOut,
    }),
    [user, status, signOut],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
