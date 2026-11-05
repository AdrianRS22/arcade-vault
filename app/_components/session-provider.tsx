"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type SessionUser = { name: string }; // uppercased, max 10 chars

type SessionContextValue = {
  user: SessionUser | null;
  signIn: (name: string) => void;
  signOut: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);

  const signIn = useCallback((name: string) => {
    const normalized = name.trim().toUpperCase().slice(0, 10);
    if (normalized) setUser({ name: normalized });
  }, []);

  const signOut = useCallback(() => setUser(null), []);

  const value = useMemo(
    () => ({ user, signIn, signOut }),
    [user, signIn, signOut],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
