import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { safeNext } from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";

import { AuthForm } from "../_components/auth-form";

// `searchParams` and the session are runtime data under Cache Components:
// both are read inside a <Suspense> boundary so the rest of the route can
// still prerender.
export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Suspense fallback={<AuthForm />}>
      <LoginForm searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginForm({
  searchParams,
}: Pick<PageProps<"/login">, "searchParams">) {
  // Per-request data (session cookie), never prerendered.
  await connection();
  const { mode, next: rawNext, error } = await searchParams;
  const first = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const next = safeNext(first(rawNext));

  // A signed-in user has nothing to do here.
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect(next);

  return (
    <AuthForm
      initialTab={mode === "create" ? "up" : "in"}
      next={next}
      errorCode={first(error)}
    />
  );
}
