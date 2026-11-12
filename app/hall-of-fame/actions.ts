"use server";

import { getPlayerBests, type ScoreEntry } from "@/app/data/scores";
import { createClient } from "@/lib/supabase/server";

/**
 * The signed-in player's best entry per game, keyed by game id.
 *
 * The player comes from the session, never from the client: the user is
 * resolved from the auth cookie and the username from their `profiles` row.
 * Guests, or anything that cannot be loaded, return `{}`, which hides the
 * "YOUR BEST" row.
 */
export async function getMyBests(): Promise<Record<string, ScoreEntry>> {
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return {};

    // RLS only lets a user read their own profile row.
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (!profile?.username) return {};

    return await getPlayerBests(profile.username);
  } catch (e) {
    console.error("[getMyBests] failed:", e);
    return {};
  }
}
