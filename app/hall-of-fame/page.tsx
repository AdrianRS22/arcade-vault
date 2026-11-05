import { HallOfFameBoard } from "../_components/hall-of-fame-board";
import { getGames } from "../data/games";
import { getLeaderboard, getPlayerBest } from "../data/scores";

export default async function HallOfFamePage() {
  const games = await getGames();

  const leaderboards = Object.fromEntries(
    await Promise.all(
      games.map(async (g) => [g.id, await getLeaderboard(g.id)] as const),
    ),
  );

  // The session lives on the client, so the server loads the (fixed) best
  // entry per game; the board shows it under the signed-in user's name.
  const playerBests = Object.fromEntries(
    await Promise.all(
      games.map(async (g) => [g.id, await getPlayerBest(g.id, "")] as const),
    ),
  );

  return (
    <HallOfFameBoard
      games={games}
      leaderboards={leaderboards}
      playerBests={playerBests}
    />
  );
}
