// Client-safe on purpose: Client Components import this value, and
// `games.ts` pulls in server-only APIs (`next/cache`, Supabase).
export const CATEGORIES = [
  "ALL",
  "ARCADE",
  "PUZZLE",
  "SHOOTER",
  "VERSUS",
] as const;
