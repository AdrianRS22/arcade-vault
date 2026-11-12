"use client";

import Link from "next/link";
import { useActionState } from "react";

import { requestPasswordReset } from "@/app/login/actions";
import type { AuthFormState } from "@/app/login/auth-state";

import { AuthCard, FieldError, FormError, SubmitButton } from "./auth-ui";

const IDLE: AuthFormState = { status: "idle" };

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordReset, IDLE);
  const error = state.status === "error" ? state : null;
  const emailError = error?.field === "email" ? error.message : undefined;

  return (
    <AuthCard subtitle="PASSWORD RESET">
      {state.status === "sent" ? (
        <div className="fade-in py-2 text-center" role="status">
          <div className="pixel neon-cyan mb-3 text-[12px]">
            CHECK YOUR INBOX
          </div>
          <p className="text-[13px] leading-relaxed text-ink-dim">
            If an account exists for{" "}
            <span className="text-ink">{state.email}</span>, a link to reset the
            password is on its way.
          </p>
        </div>
      ) : (
        <form action={formAction} noValidate>
          <p className="mb-4 text-[13px] leading-relaxed text-ink-dim">
            Enter the email of your account and we will send you a link to
            choose a new password.
          </p>
          <div className="field">
            <label htmlFor="forgot-email">Email</label>
            <input
              id="forgot-email"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={error?.values.email ?? ""}
              placeholder="player@vault.gg"
              aria-invalid={emailError ? true : undefined}
              aria-describedby={emailError ? "forgot-email-error" : undefined}
            />
            <FieldError id="forgot-email-error" message={emailError} />
          </div>
          <FormError
            message={error && !error.field ? error.message : undefined}
          />
          <SubmitButton idle="SEND RESET LINK" busy="SENDING…" />
        </form>
      )}
      <div className="mt-4 text-center">
        <Link
          href="/login"
          className="text-[11px] tracking-widest text-ink-faint hover:text-cyan"
        >
          Back to sign in
        </Link>
      </div>
    </AuthCard>
  );
}
