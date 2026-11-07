import { cacheLife, cacheTag } from "next/cache";

import { createPublicClient } from "@/lib/supabase/public";

import type { GameColor } from "./games";

export type RecentScore = {
  player: string; // e.g. "NEONFOX"
  gameId: string; // id from games.ts; the title is resolved via getGameById
  score: number;
  ago: string; // display string, e.g. "2 min ago"
  color: GameColor;
};

export type TopPlayer = {
  rank: number; // 1..5
  player: string;
  score: number;
};

function timeAgo(iso: string, now: number): string {
  const seconds = Math.max(
    0,
    Math.floor((now - new Date(iso).getTime()) / 1000),
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

/** The latest saved scores across every game, newest first. */
export async function getRecentScores(limit = 7): Promise<RecentScore[]> {
  "use cache";
  cacheTag("scores");
  // `ago` is computed here, so the entry has to refresh often. Anything with
  // an `expire` under 5 minutes would leave a dynamic hole in the home page.
  cacheLife("minutes");

  const { data, error } = await createPublicClient()
    .from("scores")
    .select("player, game_id, score, created_at, games(color)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load recent scores: ${error.message}`);

  const now = Date.now();
  return data.map((row) => ({
    player: row.player,
    gameId: row.game_id,
    score: row.score,
    ago: timeAgo(row.created_at, now),
    color: (row.games?.color ?? "cyan") as GameColor,
  }));
}

/** Top players of the last 24 hours (sum of each player's best per game). */
export async function getTopPlayersToday(limit = 5): Promise<TopPlayer[]> {
  "use cache";
  cacheTag("scores");
  cacheLife("minutes");

  const { data, error } = await createPublicClient()
    .from("top_players_today")
    .select("player, total")
    .order("total", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load top players: ${error.message}`);

  return data.flatMap((row, i) =>
    row.player === null || row.total === null
      ? []
      : [{ rank: i + 1, player: row.player, score: Number(row.total) }],
  );
}
