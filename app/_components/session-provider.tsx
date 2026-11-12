"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
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

/** `name` is the profile username (uppercase, max 10 chars). */
export type SessionUser = { id: string; name: string };

type SessionStatus = "loading" | "ready";

type SessionContextValue = {
  user: SessionUser | null;
  status: SessionStatus;
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
  return { id, name: data?.username ?? FALLBACK_NAME };
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");
  const supabaseRef = useRef<SupabaseClient<Database> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabaseRef.current = supabase;
    let active = true;

    const apply = async (id: string | null) => {
      const next = id ? await loadUser(supabase, id) : null;
      if (!active) return;
      // Keep the same object when nothing changed (token refreshes).
      setUser((prev) =>
        prev?.id === next?.id && prev?.name === next?.name ? prev : next,
      );
      setStatus("ready");
    };

    // Validates the session against the Auth server.
    supabase.auth.getUser().then(({ data }) => apply(data.user?.id ?? null));

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

  const signOut = useCallback(async () => {
    await supabaseRef.current?.auth.signOut();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, status, signOut }),
    [user, status, signOut],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
