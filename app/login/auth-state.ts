// Shared (client + server) state types for the auth Server Actions.
// Kept out of actions.ts because a "use server" file may only export async
// functions.

export type AuthField = "username" | "email" | "password" | "confirm";

export type AuthFormState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      /** Field the message belongs to, when there is one. */
      field?: AuthField;
      /** Non-secret values to repopulate the form with (never the password). */
      values: { username: string; email: string };
    }
  /** Sign-up done: the confirmation email is on its way. */
  | { status: "sent"; email: string };
