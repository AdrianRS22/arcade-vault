"use server";

import { redirect } from "next/navigation";

import type { AuthFormState } from "@/app/login/auth-state";
import {
  normalizeUsername,
  safeNext,
  validateUsername,
} from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";

function readField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** One-time username choice for players who signed in without one (OAuth). */
export async function setUsername(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const username = normalizeUsername(readField(formData, "username"));
  const next = safeNext(readField(formData, "next"));
  const values = { username, email: "" };

  const fail = (message: string): AuthFormState => ({
    status: "error",
    message,
    field: "username",
    values,
  });

  const usernameError = validateUsername(username);
  if (usernameError) return fail(usernameError);

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    redirect(`/login?next=${encodeURIComponent("/onboarding")}`);
  }

  const taken = "That username is taken. Pick another one.";

  const { data: available } = await supabase.rpc("username_available", {
    p: username,
  });
  if (available === false) return fail(taken);

  const { error } = await supabase.rpc("set_username", { p: username });

  if (error) {
    // The unique constraint decides when two players pick the same name at once.
    if (error.code === "23505") return fail(taken);
    // Already has a username: nothing left to do here.
    if (/already set/i.test(error.message)) redirect(next);
    if (error.code === "28000") redirect("/login");
    return {
      status: "error",
      message: "Something went wrong. Please try again.",
      values,
    };
  }

  redirect(next);
}
