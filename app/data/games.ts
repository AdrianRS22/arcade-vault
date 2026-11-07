import { cacheLife, cacheTag } from "next/cache";

import { createPublicClient } from "@/lib/supabase/public";
import type { Database } from "@/types/supabase";

export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type GameColor = "cyan" | "magenta" | "yellow" | "green";

export type Game = {
  id: string; // kebab-case slug, used in the URL
  title: string; // e.g. "ASTEROIDS"
  short: string; // card description
  long: string; // detail description
  category: GameCategory;
  cover: string; // CSS class from globals.css, e.g. "cover-rocas"
  color: GameColor;
  best: number; // derived from scores, 0 when there are none
  plays: number; // saved games; format with formatPlays()
};

type GameRow = Database["public"]["Views"]["games_with_best"]["Row"];

// Every column of a view is typed as nullable. The table constraints
// guarantee the values, so a null here means the schema changed under us.
function toGame(row: GameRow): Game {
  if (
    row.id === null ||
    row.title === null ||
    row.short === null ||
    row.long === null ||
    row.category === null ||
    row.cover === null ||
    row.color === null
  ) {
    throw new Error("games_with_best returned a row with missing columns");
  }
  return {
    id: row.id,
    title: row.title,
    short: row.short,
    long: row.long,
    category: row.category as GameCategory,
    cover: row.cover,
    color: row.color as GameColor,
    best: row.best ?? 0,
    plays: row.plays ?? 0,
  };
}

/** 0 → "0", 999 → "999", 1240 → "1.2K", 12400 → "12.4K", 2500000 → "2.5M". */
export function formatPlays(n: number): string {
  if (n < 1_000) return String(n);
  if (n < 1_000_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

export async function getGames(): Promise<Game[]> {
  "use cache";
  cacheTag("games", "scores");
  cacheLife("hours");

  const { data, error } = await createPublicClient()
    .from("games_with_best")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`Failed to load games: ${error.message}`);
  return data.map(toGame);
}

export async function getGameById(id: string): Promise<Game | undefined> {
  "use cache";
  cacheTag("games", "scores");
  cacheLife("hours");

  const { data, error } = await createPublicClient()
    .from("games_with_best")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to load game "${id}": ${error.message}`);
  return data ? toGame(data) : undefined;
}
