import { HallOfFameBoard } from "../_components/hall-of-fame-board";
import { getGames } from "../data/games";
import { getLeaderboard } from "../data/scores";

export default async function HallOfFamePage() {
  const games = await getGames();

  const leaderboards = Object.fromEntries(
    await Promise.all(
      games.map(async (g) => [g.id, await getLeaderboard(g.id, 12)] as const),
    ),
  );

  return <HallOfFameBoard games={games} leaderboards={leaderboards} />;
}
