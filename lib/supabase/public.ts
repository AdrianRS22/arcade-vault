import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";

/**
 * Cookie-less Supabase client for public reads.
 *
 * Safe inside `'use cache'` scopes: it never calls `cookies()` or `headers()`
 * and keeps no session. Use `lib/supabase/server.ts` for anything that needs
 * the user's session.
 */
export function createPublicClient(): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
