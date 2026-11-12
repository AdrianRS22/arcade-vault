"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSession } from "./session-provider";

export type AuthTab = "in" | "up";

export function AuthForm({ initialTab = "in" }: { initialTab?: AuthTab }) {
  const router = useRouter();
  const { signOut } = useSession();
  const [tab, setTab] = useState<AuthTab>(initialTab);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Temporary: real sign-in arrives in Step 4.
    router.push("/");
  };

  const playAsGuest = () => {
    void signOut();
    router.push("/");
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div className="mono mt-1.5 text-[11px] tracking-[0.16em] text-ink-faint">
            SYSTEM ACCESS · v2.6
          </div>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={tab === "in" ? "on" : ""}
            onClick={() => setTab("in")}
          >
            SIGN IN
          </button>
          <button
            type="button"
            className={tab === "up" ? "on" : ""}
            onClick={() => setTab("up")}
          >
            CREATE ACCOUNT
          </button>
        </div>

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="auth-username">Username</label>
            <input
              id="auth-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="px_kai"
            />
          </div>
          {tab === "up" && (
            <div className="field slide-in">
              <label htmlFor="auth-email">Email</label>
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="player@vault.gg"
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button type="submit" className="btn lg mt-2 w-full">
            {tab === "in" ? "ENTER THE VAULT" : "CREATE AND PLAY"}
          </button>
        </form>

        <button
          type="button"
          className="btn ghost mt-2.5 w-full"
          onClick={playAsGuest}
        >
          PLAY AS GUEST
        </button>

        <div className="auth-divider">OR CONTINUE WITH</div>
        <div className="social">
          <button type="button" className="btn ghost">
            ◆ GOOGLE
          </button>
          <button type="button" className="btn ghost">
            ▣ GITHUB
          </button>
        </div>

        <div className="mt-4.5 text-center text-[11px] tracking-widest text-ink-faint">
          BY ENTERING YOU ACCEPT THE ARCADE HALL TERMS
        </div>
      </div>
    </div>
  );
}
