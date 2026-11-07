import { cacheLife, cacheTag } from "next/cache";

import { createPublicClient } from "@/lib/supabase/public";
import type { Database } from "@/types/supabase";

export type ScoreEntry = {
  rank: number;
  player: string;
  score: number;
  date: string; // "DD/MM/YYYY"
};

type PlayerBestRow = Database["public"]["Views"]["player_bests"]["Row"];

const pad = (n: number) => String(n).padStart(2, "0");

// UTC on purpose: the server timezone must not change the date shown.
function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

// Every column of a view is typed as nullable; the schema guarantees them.
function toEntry(row: PlayerBestRow): ScoreEntry & { gameId: string } {
  if (
    row.game_id === null ||
    row.player === null ||
    row.score === null ||
    row.rank === null ||
    row.achieved_at === null
  ) {
    throw new Error("player_bests returned a row with missing columns");
  }
  return {
    gameId: row.game_id,
    rank: row.rank,
    player: row.player,
    score: row.score,
    date: formatDate(row.achieved_at),
  };
}

/** Best score per player for one game, best first. Empty when nobody played. */
export async function getLeaderboard(
  gameId: string,
  limit?: number,
): Promise<ScoreEntry[]> {
  "use cache";
  cacheTag("scores");
  cacheLife("hours");

  let query = createPublicClient()
    .from("player_bests")
    .select("*")
    .eq("game_id", gameId)
    .order("rank", { ascending: true })
    .order("player", { ascending: true });
  if (limit !== undefined) query = query.limit(limit);

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load leaderboard "${gameId}": ${error.message}`);
  }
  return data.map((row) => {
    const { rank, player, score, date } = toEntry(row);
    return { rank, player, score, date };
  });
}

/**
 * One player's best entry per game, keyed by game id. Not cached: it depends
 * on who is asking, so it is meant to be called from a Server Action.
 */
export async function getPlayerBests(
  player: string,
): Promise<Record<string, ScoreEntry>> {
  const { data, error } = await createPublicClient()
    .from("player_bests")
    .select("*")
    .eq("player", player);

  if (error) {
    throw new Error(`Failed to load bests for "${player}": ${error.message}`);
  }
  return Object.fromEntries(
    data.map((row) => {
      const { gameId, ...entry } = toEntry(row);
      return [gameId, entry] as const;
    }),
  );
}
