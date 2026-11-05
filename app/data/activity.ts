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

const RECENT_SCORES: RecentScore[] = [
  { player: "NEONFOX", gameId: "drop", score: 184220, ago: "2 min ago", color: "magenta" },
  { player: "PX_KAI", gameId: "glutton", score: 96400, ago: "5 min ago", color: "yellow" },
  { player: "Z3R0COOL", gameId: "invaders", score: 54190, ago: "8 min ago", color: "green" },
  { player: "VAULT_07", gameId: "rocks", score: 41200, ago: "12 min ago", color: "yellow" },
  { player: "GLITCHA", gameId: "block-buster", score: 28450, ago: "18 min ago", color: "cyan" },
  { player: "ARKADYA", gameId: "serpentine", score: 7820, ago: "24 min ago", color: "green" },
  { player: "CYBER_LU", gameId: "froggy", score: 18900, ago: "31 min ago", color: "green" },
];

const TOP_PLAYERS_TODAY: TopPlayer[] = [
  { rank: 1, player: "NEONFOX", score: 312840 },
  { rank: 2, player: "PX_KAI", score: 248110 },
  { rank: 3, player: "M00NRYU", score: 196720 },
  { rank: 4, player: "VAULT_07", score: 154300 },
  { rank: 5, player: "GLITCHA", score: 138900 },
];

export async function getRecentScores(limit?: number): Promise<RecentScore[]> {
  return limit === undefined ? RECENT_SCORES : RECENT_SCORES.slice(0, limit);
}

export async function getTopPlayersToday(limit?: number): Promise<TopPlayer[]> {
  return limit === undefined
    ? TOP_PLAYERS_TODAY
    : TOP_PLAYERS_TODAY.slice(0, limit);
}
