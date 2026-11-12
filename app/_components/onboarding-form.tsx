"use client";

import { useActionState, useState } from "react";

import type { AuthFormState } from "@/app/login/auth-state";
import { setUsername } from "@/app/onboarding/actions";
import { normalizeUsername, validateUsername } from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/client";

import { AuthCard, FieldError, FormError, SubmitButton } from "./auth-ui";

const IDLE: AuthFormState = { status: "idle" };

type UsernameCheck = "idle" | "checking" | "available" | "taken";

export function OnboardingForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(setUsername, IDLE);
  const error = state.status === "error" ? state : null;

  const [username, setName] = useState("");
  const [seen, setSeen] = useState(state);
  const [check, setCheck] = useState<UsernameCheck>("idle");

  // Restore the username the server rejected (the field is controlled).
  if (state !== seen) {
    setSeen(state);
    if (state.status === "error") setName(state.values.username);
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

  const message =
    formatError ??
    (check === "taken"
      ? "That username is taken. Pick another one."
      : undefined) ??
    (error?.field === "username" ? error.message : undefined);

  return (
    <AuthCard subtitle="CHOOSE YOUR NAME">
      <p className="mb-4 text-[13px] leading-relaxed text-ink-dim">
        This is the name shown on the leaderboards. You can&apos;t change it
        later.
      </p>
      <form action={formAction} noValidate>
        <input type="hidden" name="next" value={next} />
        <div className="field">
          <label htmlFor="onboarding-username">Username</label>
          <input
            id="onboarding-username"
            name="username"
            value={username}
            onChange={(e) => {
              setName(normalizeUsername(e.target.value).slice(0, 10));
              setCheck("idle");
            }}
            onBlur={checkAvailability}
            autoComplete="off"
            autoCapitalize="characters"
            autoFocus
            maxLength={10}
            placeholder="PX_KAI"
            aria-invalid={message ? true : undefined}
            aria-describedby={message ? "onboarding-username-msg" : undefined}
          />
          {message ? (
            <FieldError id="onboarding-username-msg" message={message} />
          ) : check === "available" ? (
            <p className="mono m-0 text-[11px] tracking-[0.06em] text-green">
              Username available.
            </p>
          ) : null}
        </div>

        <FormError
          message={error && !error.field ? error.message : undefined}
        />

        <SubmitButton idle="CLAIM THIS NAME" busy="SAVING…" />
      </form>
    </AuthCard>
  );
}
