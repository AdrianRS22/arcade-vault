import Link from "next/link";
import { notFound } from "next/navigation";
import { formatPlays, getGameById, getGames } from "@/app/data/games";
import { getLeaderboard } from "@/app/data/scores";

// Unknown ids must answer 404 on the very first request. With Partial
// Prefetching, an unlisted param otherwise gets the App Shell (status 200)
// first. 'navigation' makes Next wait for the complete static page instead.
export const ensureStatic = "navigation";

export async function generateStaticParams() {
  const games = await getGames();
  return games.map((game) => ({ id: game.id }));
}

export default async function GameDetailPage({
  params,
}: PageProps<"/games/[id]">) {
  const { id } = await params;
  const game = await getGameById(id);
  if (!game) notFound();

  const scores = await getLeaderboard(game.id, 10);

  return (
    <div className="av-detail fade-in">
      <div>
        <div className="detail-cover">
          <div className={`cover-bg ${game.cover}`}></div>
        </div>
        <div className="detail-info mt-5">
          <div className="detail-tags">
            <span>{game.category}</span>
            <span>1 PLAYER</span>
            <span>KEYBOARD / TOUCH</span>
            <span>RETRO 1985</span>
          </div>
          <h2 className="neon-cyan">{game.title}</h2>
          <p>{game.long}</p>
          <div className="stat-strip">
            <div>
              <div className="l">Plays</div>
              <div className="v">{formatPlays(game.plays)}</div>
            </div>
            <div>
              <div className="l">Global best</div>
              <div className="v text-magenta [text-shadow:0_0_6px_rgba(255,0,110,0.5)]">
                {game.best.toLocaleString("en-US")}
              </div>
            </div>
            <div>
              <div className="l">Difficulty</div>
              <div className="v text-yellow [text-shadow:0_0_6px_rgba(245,255,0,0.5)]">
                ★ ★ ★ ☆ ☆
              </div>
            </div>
          </div>
          <div className="detail-actions">
            <Link href={`/games/${game.id}/play`} className="btn xl pulse">
              ▶ PLAY NOW
            </Link>
            <Link href="/games" className="btn ghost lg">
              BACK TO VAULT
            </Link>
          </div>
        </div>
      </div>

      <aside>
        <div className="leaderboard">
          <h3>TOP SCORES</h3>
          {scores.map((r, i) => (
            <div
              key={r.player}
              className={
                "lb-row" +
                (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")
              }
            >
              <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
              <div className="pl">
                {r.player}
                <div className="text-[10px] tracking-widest text-ink-faint">
                  {r.date}
                </div>
              </div>
              <div className="sc">{r.score.toLocaleString("en-US")}</div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
