// Supabase env vars, read once. Both are public by design (NEXT_PUBLIC_), so
// they must be referenced statically for Next to inline them in the browser.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL. Copy .env.example to .env.local and fill it in.",
  );
}

if (!publishableKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local and fill it in.",
  );
}

export const SUPABASE_URL: string = url;
export const SUPABASE_PUBLISHABLE_KEY: string = publishableKey;
