import { Suspense } from "react";
import { AuthForm } from "../_components/auth-form";

// `searchParams` is runtime data under Cache Components: it is awaited inside
// a <Suspense> boundary so the rest of the route can still prerender.
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
  const { mode } = await searchParams;
  return <AuthForm initialTab={mode === "create" ? "up" : "in"} />;
}
