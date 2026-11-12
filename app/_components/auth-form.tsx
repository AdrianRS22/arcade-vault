"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";

import { signIn, signUp } from "@/app/login/actions";
import type { AuthFormState } from "@/app/login/auth-state";
import {
  MIN_PASSWORD_LENGTH,
  normalizeUsername,
  PASSWORD_REQUIREMENTS,
  validateUsername,
} from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/client";

import { AuthCard, FieldError, FormError, SubmitButton } from "./auth-ui";
import { useSession } from "./session-provider";

export type AuthTab = "in" | "up";

const IDLE: AuthFormState = { status: "idle" };

const NOTICES: Record<string, string> = {
  invalid_link: "That link is not valid. Request a new one.",
  link_expired: "That link has expired or was already used. Request a new one.",
  oauth: "Sign-in with that provider did not complete. Try again.",
};

type OAuthProvider = "google" | "github";

const PROVIDERS: { id: OAuthProvider; label: string }[] = [
  { id: "google", label: "GOOGLE" },
  { id: "github", label: "GITHUB" },
];

function OAuthButtons({ next }: { next: string }) {
  const [pending, setPending] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(provider: OAuthProvider) {
    setPending(provider);
    setError(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    // On success the browser leaves for the provider; only failures return.
    if (error) {
      setPending(null);
      setError("Could not start the sign-in. Try again.");
    }
  }

  return (
    <>
      <div className="auth-divider" role="separator">
        OR CONTINUE WITH
      </div>
      <div className="social">
        {PROVIDERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className="btn"
            disabled={pending !== null}
            onClick={() => void start(id)}
          >
            {pending === id ? "REDIRECTING…" : label}
          </button>
        ))}
      </div>
      <FormError message={error ?? undefined} />
    </>
  );
}

function SignInForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(signIn, IDLE);
  const error = state.status === "error" ? state : null;
  const fieldError = (f: string) =>
    error?.field === f ? error.message : undefined;

  return (
    <form action={formAction} noValidate>
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="signin-email">Email</label>
        <input
          id="signin-email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={error?.values.email ?? ""}
          placeholder="player@vault.gg"
          aria-invalid={fieldError("email") ? true : undefined}
          aria-describedby={
            fieldError("email") ? "signin-email-error" : undefined
          }
        />
        <FieldError id="signin-email-error" message={fieldError("email")} />
      </div>
      <div className="field">
        <label htmlFor="signin-password">Password</label>
        <input
          id="signin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          aria-invalid={fieldError("password") ? true : undefined}
          aria-describedby={
            fieldError("password") ? "signin-password-error" : undefined
          }
        />
        <FieldError
          id="signin-password-error"
          message={fieldError("password")}
        />
      </div>

      <FormError message={error && !error.field ? error.message : undefined} />

      <SubmitButton idle="ENTER THE VAULT" busy="ENTERING…" />
      <div className="mt-3 text-center">
        <Link
          href="/forgot-password"
          className="text-[11px] tracking-widest text-ink-faint hover:text-cyan"
        >
          Forgot password?
        </Link>
      </div>
    </form>
  );
}

type UsernameCheck = "idle" | "checking" | "available" | "taken";

function SignUpForm() {
  const [state, formAction] = useActionState(signUp, IDLE);
  const error = state.status === "error" ? state : null;

  const [username, setUsername] = useState("");
  const [seen, setSeen] = useState(state);
  const [check, setCheck] = useState<UsernameCheck>("idle");

  // Restore the username the server rejected (the field is controlled).
  if (state !== seen) {
    setSeen(state);
    if (state.status === "error") setUsername(state.values.username);
  }

  const formatError = username ? validateUsername(username) : null;

  async function checkAvailability() {
    if (!username || validateUsername(username)) return;
    setCheck("checking");
    const { data } = await createClient().rpc("username_available", {
      p: username,
    });
    // Ignore a stale answer if the user kept typing.
    setCheck((prev) =>
      prev === "checking" ? (data === false ? "taken" : "available") : prev,
    );
  }

  const usernameMessage =
    formatError ??
    (check === "taken"
      ? "That username is taken. Pick another one."
      : undefined) ??
    (error?.field === "username" ? error.message : undefined);
  const fieldError = (f: string) =>
    error?.field === f ? error.message : undefined;

  if (state.status === "sent") {
    return (
      <div className="fade-in py-2 text-center" role="status">
        <div className="pixel neon-cyan mb-3 text-[12px]">CHECK YOUR INBOX</div>
        <p className="text-[13px] leading-relaxed text-ink-dim">
          We sent a confirmation link to{" "}
          <span className="text-ink">{state.email}</span>. Open it to activate
          your account, then sign in.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} noValidate>
      <div className="field">
        <label htmlFor="signup-username">Username</label>
        <input
          id="signup-username"
          name="username"
          value={username}
          onChange={(e) => {
            setUsername(normalizeUsername(e.target.value).slice(0, 10));
            setCheck("idle");
          }}
          onBlur={checkAvailability}
          autoComplete="username"
          autoCapitalize="characters"
          maxLength={10}
          placeholder="PX_KAI"
          aria-invalid={usernameMessage ? true : undefined}
          aria-describedby={usernameMessage ? "signup-username-msg" : undefined}
        />
        {usernameMessage ? (
          <FieldError id="signup-username-msg" message={usernameMessage} />
        ) : check === "available" ? (
          <p className="mono m-0 text-[11px] tracking-[0.06em] text-green">
            Username available.
          </p>
        ) : null}
      </div>
      <div className="field">
        <label htmlFor="signup-email">Email</label>
        <input
          id="signup-email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={error?.values.email ?? ""}
          placeholder="player@vault.gg"
          aria-invalid={fieldError("email") ? true : undefined}
          aria-describedby={
            fieldError("email") ? "signup-email-error" : undefined
          }
        />
        <FieldError id="signup-email-error" message={fieldError("email")} />
      </div>
      <div className="field">
        <label htmlFor="signup-password">Password</label>
        <input
          id="signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
          aria-invalid={fieldError("password") ? true : undefined}
          aria-describedby={
            fieldError("password")
              ? "signup-password-error"
              : "signup-password-hint"
          }
        />
        <p id="signup-password-hint" className="field-hint">
          {PASSWORD_REQUIREMENTS}
        </p>
        <FieldError
          id="signup-password-error"
          message={fieldError("password")}
        />
      </div>

      <FormError message={error && !error.field ? error.message : undefined} />

      <SubmitButton idle="CREATE AND PLAY" busy="CREATING…" />
    </form>
  );
}

export function AuthForm({
  initialTab = "in",
  next = "/",
  errorCode,
}: {
  initialTab?: AuthTab;
  /** Already sanitized with `safeNext`. */
  next?: string;
  /** `?error=` code set by /auth/confirm or /auth/callback. */
  errorCode?: string;
}) {
  const router = useRouter();
  const { signOut } = useSession();
  const [tab, setTab] = useState<AuthTab>(initialTab);
  const notice = errorCode ? NOTICES[errorCode] : undefined;

  const playAsGuest = () => {
    void signOut();
    router.push("/");
  };

  return (
    <AuthCard>
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

      {notice && <FormError message={notice} />}

      {tab === "in" ? <SignInForm next={next} /> : <SignUpForm />}

      <OAuthButtons next={next} />

      <button
        type="button"
        className="btn ghost mt-2.5 w-full"
        onClick={playAsGuest}
      >
        PLAY AS GUEST
      </button>

      <div className="mt-4.5 text-center text-[11px] tracking-widest text-ink-faint">
        BY ENTERING YOU ACCEPT THE ARCADE HALL TERMS
      </div>
    </AuthCard>
  );
}
