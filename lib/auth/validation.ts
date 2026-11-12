// Client-safe auth validation, shared by the forms and the Server Actions.
// The same rules are enforced again in the database (profiles check constraint).

export const USERNAME_PATTERN = /^[A-Z0-9_]{1,10}$/;
export const MIN_PASSWORD_LENGTH = 8;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Usernames are stored uppercase; input is normalized before validating. */
export function normalizeUsername(value: string): string {
  return value.trim().toUpperCase();
}

export function validateUsername(value: string): string | null {
  if (!USERNAME_PATTERN.test(value)) {
    return "Username must be 1–10 characters: letters, numbers or underscore.";
  }
  return null;
}

export function validateEmail(value: string): string | null {
  if (!EMAIL_PATTERN.test(value) || value.length > 254) {
    return "Enter a valid email address.";
  }
  return null;
}

/** Shown as a hint under the password fields and in `weak_password` errors. */
export const PASSWORD_REQUIREMENTS = `At least ${MIN_PASSWORD_LENGTH} characters, with a lowercase letter, an uppercase letter, a number and a symbol.`;

/**
 * Mirrors the Supabase dashboard rule (lowercase, uppercase, digits and
 * symbols). Only applied on sign-up and password change, never on sign-in.
 */
export function validatePassword(value: string): string | null {
  const missing: string[] = [];
  if (value.length < MIN_PASSWORD_LENGTH) {
    missing.push(`${MIN_PASSWORD_LENGTH}+ characters`);
  }
  if (!/[a-z]/.test(value)) missing.push("a lowercase letter");
  if (!/[A-Z]/.test(value)) missing.push("an uppercase letter");
  if (!/[0-9]/.test(value)) missing.push("a number");
  if (!/[^A-Za-z0-9]/.test(value)) missing.push("a symbol");
  if (missing.length === 0) return null;
  return `Password needs ${missing.join(", ")}.`;
}

/**
 * Only same-site absolute paths are accepted as redirect targets: a single
 * leading `/`, never `//host`, `/\host`, or anything with control characters.
 * Everything else falls back to `/`.
 */
export function safeNext(value: unknown): string {
  if (typeof value !== "string") return "/";
  if (!/^\/(?![/\\])/.test(value)) return "/";

  if (/[\u0000-\u001f\u007f\\]/.test(value)) return "/";
  return value;
}
