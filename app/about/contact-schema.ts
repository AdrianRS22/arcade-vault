export type ContactField = "name" | "email" | "message";

export type ContactFormState =
  | { status: "idle" }
  | {
      status: "invalid";
      errors: Partial<Record<ContactField, string>>;
      values: Record<ContactField, string>;
    }
  | { status: "sent"; name: string }
  | { status: "error"; values: Record<ContactField, string> };

export const CONTACT_LIMITS = { name: 80, email: 254, message: 2000 } as const;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Returns an error message per invalid field. Empty object = valid. */
export function validateContact(
  input: Record<ContactField, string>,
): Partial<Record<ContactField, string>> {
  const errors: Partial<Record<ContactField, string>> = {};
  const name = input.name.trim();
  const email = input.email.trim();
  const message = input.message.trim();

  if (!name) {
    errors.name = "NAME IS REQUIRED";
  } else if (name.length > CONTACT_LIMITS.name) {
    errors.name = `NAME MUST BE ${CONTACT_LIMITS.name} CHARACTERS OR LESS`;
  }

  if (!email) {
    errors.email = "EMAIL IS REQUIRED";
  } else if (email.length > CONTACT_LIMITS.email) {
    errors.email = `EMAIL MUST BE ${CONTACT_LIMITS.email} CHARACTERS OR LESS`;
  } else if (!EMAIL_REGEX.test(email)) {
    errors.email = "ENTER A VALID EMAIL";
  }

  if (!message) {
    errors.message = "MESSAGE IS REQUIRED";
  } else if (message.length > CONTACT_LIMITS.message) {
    errors.message = `MESSAGE MUST BE ${CONTACT_LIMITS.message} CHARACTERS OR LESS`;
  }

  return errors;
}
