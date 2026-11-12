"use server";

import { updateTag } from "next/cache";

import { createClient } from "@/lib/supabase/server";

// Same rule as the database: public.scores check and public.submit_score.
const MAX_SCORE = 9_999_999;

export type SaveScoreResult =
  { ok: true; rank: number } | { ok: false; error: string };

/**
 * Saves a finished run through the `submit_score` Postgres function, the only
 * write path to `scores`. Returns the player's new rank for that game.
 *
 * The player is never sent by the client: the database reads the signed-in
 * user from the session cookie and takes the username from `profiles`.
 */
export async function saveScore(
  gameId: string,
  score: number,
): Promise<SaveScoreResult> {
  if (typeof gameId !== "string" || gameId === "") {
    return { ok: false, error: "This game cannot save scores." };
  }
  if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) {
    return { ok: false, error: "This score cannot be saved." };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("submit_score", {
      p_game_id: gameId,
      p_score: score,
    });

    // 28000: no session. 22023 + "username": profile without a username.
    if (error?.code === "28000" || error?.code === "42501") {
      return { ok: false, error: "Sign in to save your score." };
    }
    if (error?.code === "22023" && /username/.test(error.message)) {
      return { ok: false, error: "Choose your username first." };
    }
    if (error || data === null) {
      console.error(
        "[saveScore] submit_score failed:",
        error?.message ?? "no rank returned",
      );
      return { ok: false, error: "Could not save your score. Try again." };
    }

    // Read-your-own-writes: the next request must see the new score and the
    // new play count, so expire both tags now instead of serving stale data.
    updateTag("scores");
    updateTag("games");

    return { ok: true, rank: data };
  } catch (e) {
    console.error("[saveScore] unexpected error:", e);
    return { ok: false, error: "Could not save your score. Try again." };
  }
}
