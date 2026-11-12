"use server";

import { redirect } from "next/navigation";

import {
  normalizeUsername,
  PASSWORD_REQUIREMENTS,
  safeNext,
  validateEmail,
  validatePassword,
  validateUsername,
} from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";

import type { AuthFormState } from "./auth-state";

function readField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

type AuthErrorLike = { code?: string; status?: number; message?: string };

function isRateLimited(error: AuthErrorLike): boolean {
  return (
    error.status === 429 ||
    error.code === "over_request_rate_limit" ||
    error.code === "over_email_send_rate_limit"
  );
}

const RATE_LIMITED = "Too many attempts. Wait a few minutes and try again.";
const GENERIC = "Something went wrong. Please try again.";

export async function signUp(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const username = normalizeUsername(readField(formData, "username"));
  const email = readField(formData, "email").trim();
  const password = readField(formData, "password");
  const values = { username, email };

  const usernameError = validateUsername(username);
  if (usernameError) {
    return {
      status: "error",
      message: usernameError,
      field: "username",
      values,
    };
  }
  const emailError = validateEmail(email);
  if (emailError) {
    return { status: "error", message: emailError, field: "email", values };
  }
  const passwordError = validatePassword(password);
  if (passwordError) {
    return {
      status: "error",
      message: passwordError,
      field: "password",
      values,
    };
  }

  const supabase = await createClient();

  const taken: AuthFormState = {
    status: "error",
    message: "That username is taken. Pick another one.",
    field: "username",
    values,
  };

  const { data: available } = await supabase.rpc("username_available", {
    p: username,
  });
  if (available === false) return taken;

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });

  if (error) {
    if (isRateLimited(error)) {
      return { status: "error", message: RATE_LIMITED, values };
    }
    if (error.code === "weak_password") {
      return {
        status: "error",
        message: PASSWORD_REQUIREMENTS,
        field: "password",
        values,
      };
    }
    // The profile trigger fails when the unique username constraint is hit
    // by a concurrent sign-up that passed the availability check.
    if (
      error.code === "unexpected_failure" ||
      /database error saving new user/i.test(error.message)
    ) {
      return taken;
    }
    return { status: "error", message: GENERIC, values };
  }

  return { status: "sent", email };
}

export async function signIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = readField(formData, "email").trim();
  const password = readField(formData, "password");
  const next = safeNext(readField(formData, "next"));
  const values = { username: "", email };

  const emailError = validateEmail(email);
  if (emailError) {
    return { status: "error", message: emailError, field: "email", values };
  }
  if (password === "") {
    return {
      status: "error",
      message: "Enter your password.",
      field: "password",
      values,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.code === "email_not_confirmed") {
      return {
        status: "error",
        message: "Confirm your email first. Check your inbox for the link.",
        values,
      };
    }
    if (error.code === "invalid_credentials") {
      return {
        status: "error",
        message: "Wrong email or password.",
        values,
      };
    }
    if (isRateLimited(error)) {
      return { status: "error", message: RATE_LIMITED, values };
    }
    return { status: "error", message: GENERIC, values };
  }

  redirect(next);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function requestPasswordReset(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = readField(formData, "email").trim();
  const values = { username: "", email };

  const emailError = validateEmail(email);
  if (emailError) {
    return { status: "error", message: emailError, field: "email", values };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email);

  // Anything but a rate limit looks the same to the caller, so the response
  // never reveals whether the email has an account.
  if (error && isRateLimited(error)) {
    return { status: "error", message: RATE_LIMITED, values };
  }

  return { status: "sent", email };
}

export async function updatePassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const password = readField(formData, "password");
  const confirm = readField(formData, "confirm");
  const values = { username: "", email: "" };

  const passwordError = validatePassword(password);
  if (passwordError) {
    return {
      status: "error",
      message: passwordError,
      field: "password",
      values,
    };
  }
  if (password !== confirm) {
    return {
      status: "error",
      message: "Passwords do not match.",
      field: "confirm",
      values,
    };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/forgot-password");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") {
      return {
        status: "error",
        message: "Choose a password you have not used before.",
        field: "password",
        values,
      };
    }
    if (error.code === "weak_password") {
      return {
        status: "error",
        message: PASSWORD_REQUIREMENTS,
        field: "password",
        values,
      };
    }
    if (isRateLimited(error)) {
      return { status: "error", message: RATE_LIMITED, values };
    }
    return { status: "error", message: GENERIC, values };
  }

  redirect("/");
}
