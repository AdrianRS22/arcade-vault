"use server";

import { getPlayerBests, type ScoreEntry } from "@/app/data/scores";

// Same rule as the database (`public.scores.player`) and `saveScore`.
const PLAYER_PATTERN = /^[A-Z0-9_]{1,10}$/;

/**
 * The signed-in player's best entry per game, keyed by game id.
 *
 * The session lives in the browser, so the server cannot know the player at
 * render time: the Hall of Fame board asks for it here once it knows the name.
 * Anything that cannot be loaded returns `{}`, which hides the "YOUR BEST" row.
 */
export async function getMyBests(
  player: string,
): Promise<Record<string, ScoreEntry>> {
  const name =
    typeof player === "string" ? player.trim().toUpperCase().slice(0, 10) : "";
  if (!PLAYER_PATTERN.test(name)) return {};

  try {
    return await getPlayerBests(name);
  } catch (e) {
    console.error("[getMyBests] failed:", e);
    return {};
  }
}
