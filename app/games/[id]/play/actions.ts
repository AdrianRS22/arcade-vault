"use server";

import { updateTag } from "next/cache";

import { createClient } from "@/lib/supabase/server";

// Same rules as the database: public.scores checks and public.submit_score.
const PLAYER_PATTERN = /^[A-Z0-9_]{1,10}$/;
const MAX_SCORE = 9_999_999;

export type SaveScoreResult =
  { ok: true; rank: number } | { ok: false; error: string };

/**
 * Saves a finished run through the `submit_score` Postgres function, the only
 * write path to `scores`. Returns the player's new rank for that game.
 *
 * There is no Auth yet, so the name is whatever the player typed: it is
 * normalized and validated here, and validated again by the database.
 */
export async function saveScore(
  gameId: string,
  player: string,
  score: number,
): Promise<SaveScoreResult> {
  const name =
    typeof player === "string" ? player.trim().toUpperCase().slice(0, 10) : "";

  if (typeof gameId !== "string" || gameId === "") {
    return { ok: false, error: "This game cannot save scores." };
  }
  if (!PLAYER_PATTERN.test(name)) {
    return {
      ok: false,
      error: "Use 1 to 10 letters, numbers or underscores for your initials.",
    };
  }
  if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) {
    return { ok: false, error: "This score cannot be saved." };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("submit_score", {
      p_game_id: gameId,
      p_player: name,
      p_score: score,
    });

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
