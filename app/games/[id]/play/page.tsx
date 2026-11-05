import { notFound } from "next/navigation";
import { GamePlayer } from "@/app/_components/game-player";
import { getGameById, getGames } from "@/app/data/games";

export async function generateStaticParams() {
  const games = await getGames();
  return games.map((game) => ({ id: game.id }));
}

export default async function PlayPage({
  params,
}: PageProps<"/games/[id]/play">) {
  const { id } = await params;
  const game = await getGameById(id);
  if (!game) notFound();

  return <GamePlayer game={{ id: game.id, title: game.title }} />;
}
