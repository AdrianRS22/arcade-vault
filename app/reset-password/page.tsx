import { redirect } from "next/navigation";
import { Suspense } from "react";

import { createClient } from "@/lib/supabase/server";

import { ResetPasswordForm } from "../_components/reset-password-form";

// The session is runtime data under Cache Components, so it is read inside a
// <Suspense> boundary. Only a signed-in session (a recovery link signs the
// user in through /auth/confirm) gets the form.
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordGate />
    </Suspense>
  );
}

async function ResetPasswordGate() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/forgot-password");
  return <ResetPasswordForm />;
}
