"use client";

import { useActionState } from "react";

import { updatePassword } from "@/app/login/actions";
import type { AuthFormState } from "@/app/login/auth-state";
import {
  MIN_PASSWORD_LENGTH,
  PASSWORD_REQUIREMENTS,
} from "@/lib/auth/validation";

import { AuthCard, FieldError, FormError, SubmitButton } from "./auth-ui";

const IDLE: AuthFormState = { status: "idle" };

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(updatePassword, IDLE);
  const error = state.status === "error" ? state : null;
  const fieldError = (f: string) =>
    error?.field === f ? error.message : undefined;

  return (
    <AuthCard subtitle="NEW PASSWORD">
      <form action={formAction} noValidate>
        <div className="field">
          <label htmlFor="reset-password">New password</label>
          <input
            id="reset-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            aria-invalid={fieldError("password") ? true : undefined}
            aria-describedby={
              fieldError("password")
                ? "reset-password-error"
                : "reset-password-hint"
            }
          />
          <p id="reset-password-hint" className="field-hint">
            {PASSWORD_REQUIREMENTS}
          </p>
          <FieldError
            id="reset-password-error"
            message={fieldError("password")}
          />
        </div>
        <div className="field">
          <label htmlFor="reset-confirm">Confirm password</label>
          <input
            id="reset-confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            aria-invalid={fieldError("confirm") ? true : undefined}
            aria-describedby={
              fieldError("confirm") ? "reset-confirm-error" : undefined
            }
          />
          <FieldError
            id="reset-confirm-error"
            message={fieldError("confirm")}
          />
        </div>
        <FormError
          message={error && !error.field ? error.message : undefined}
        />
        <SubmitButton idle="SAVE NEW PASSWORD" busy="SAVING…" />
      </form>
    </AuthCard>
  );
}
