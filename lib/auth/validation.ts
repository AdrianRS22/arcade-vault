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

export function validatePassword(value: string): string | null {
  if (value.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
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
