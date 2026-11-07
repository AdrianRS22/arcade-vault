import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GamePlayer } from "@/app/_components/game-player";
import { PageLoading } from "@/app/_components/page-loading";
import { getGameById, getGames } from "@/app/data/games";

// See app/games/[id]/page.tsx: unknown ids must return 404 on the first request.
export const ensureStatic = "navigation";

export async function generateStaticParams() {
  const games = await getGames();
  return games.map((game) => ({ id: game.id }));
}

// URL data (the game id) is read inside <Suspense>, as in the detail page.
export default function PlayPage({ params }: PageProps<"/games/[id]/play">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Player params={params} />
    </Suspense>
  );
}

async function Player({
  params,
}: Pick<PageProps<"/games/[id]/play">, "params">) {
  const { id } = await params;
  const game = await getGameById(id);
  if (!game) notFound();

  return <GamePlayer game={{ id: game.id, title: game.title }} />;
}
