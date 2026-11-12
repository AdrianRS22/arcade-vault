import { redirect } from "next/navigation";
import { Suspense } from "react";

import { safeNext } from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";

import { OnboardingForm } from "../_components/onboarding-form";

// `searchParams` and the session are runtime data under Cache Components:
// both are read inside a <Suspense> boundary.
export default function OnboardingPage({
  searchParams,
}: PageProps<"/onboarding">) {
  return (
    <Suspense fallback={null}>
      <OnboardingGate searchParams={searchParams} />
    </Suspense>
  );
}

async function OnboardingGate({
  searchParams,
}: Pick<PageProps<"/onboarding">, "searchParams">) {
  const { next: rawNext } = await searchParams;
  const next = safeNext(Array.isArray(rawNext) ? rawNext[0] : rawNext);

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    redirect(`/login?next=${encodeURIComponent("/onboarding")}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profile?.username) redirect(next);

  return <OnboardingForm next={next} />;
}
