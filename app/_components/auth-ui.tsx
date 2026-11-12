"use client";

import { useFormStatus } from "react-dom";

/** Shared building blocks of the auth screens (login, forgot/reset password). */

export function AuthCard({
  children,
  subtitle = "SYSTEM ACCESS · v2.6",
}: {
  children: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div className="mono mt-1.5 text-[11px] tracking-[0.16em] text-ink-faint">
            {subtitle}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

export function SubmitButton({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn lg mt-2 w-full" disabled={pending}>
      {pending ? busy : idle}
    </button>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="field-error" role="alert">
      {message}
    </p>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="field-error mb-3" role="alert">
      {message}
    </p>
  );
}
