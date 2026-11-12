"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Game } from "@/app/data/games";
import type { ScoreEntry } from "@/app/data/scores";
import { getMyBests } from "@/app/hall-of-fame/actions";
import { EmptyBoard } from "./empty-board";
import { useSession } from "./session-provider";

type Props = {
  games: Game[];
  leaderboards: Record<string, ScoreEntry[]>;
};

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (n: number) => n.toLocaleString("en-US");

export function HallOfFameBoard({ games, leaderboards }: Props) {
  const { user } = useSession();
  const [tab, setTab] = useState(games[0].id);
  // Tagged with the user it was loaded for, so a result for a previous
  // session is never shown under another account.
  const [bests, setBests] = useState<{
    userId: string;
    data: Record<string, ScoreEntry>;
  } | null>(null);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getMyBests()
      .then((data) => {
        if (!cancelled) setBests({ userId, data });
      })
      .catch(() => {
        if (!cancelled) setBests({ userId, data: {} });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const game = games.find((g) => g.id === tab) ?? games[0];
  const rows = leaderboards[game.id] ?? [];
  const [first, second, third] = rows;
  const mine =
    user && bests?.userId === user.id ? bests.data[game.id] : undefined;

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>HALL OF FAME</h1>
        <p className="pixel text-[10px]">
          THE NAMES THAT NEVER FADE FROM THE SCREEN
        </p>
      </div>

      <div className="hall-tabs">
        {games.map((g) => (
          <button
            key={g.id}
            type="button"
            className={"chip" + (tab === g.id ? " active" : "")}
            onClick={() => setTab(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyBoard
          title="NO SCORES YET"
          action={{
            href: `/games/${game.id}/play`,
            label: `PLAY ${game.title}`,
          }}
        >
          Nobody has saved a score in {game.title} yet. Finish a run and take
          rank #1.
        </EmptyBoard>
      ) : (
        <>
          <div className="podium">
            {second && (
              <div className="podium-slot silver">
                <div className="rank-num">02</div>
                <div className="name">{second.player}</div>
                <div className="score">{fmt(second.score)}</div>
                <div className="date">{second.date}</div>
              </div>
            )}
            {first && (
              <div className="podium-slot gold">
                <div className="pixel text-[9px] tracking-[0.18em] text-gold">
                  CHAMPION
                </div>
                <div className="rank-num mt-1 text-[36px]">01</div>
                <div className="name">{first.player}</div>
                <div className="score text-[20px]">{fmt(first.score)}</div>
                <div className="date">{first.date}</div>
              </div>
            )}
            {third && (
              <div className="podium-slot bronze">
                <div className="rank-num">03</div>
                <div className="name">{third.player}</div>
                <div className="score">{fmt(third.score)}</div>
                <div className="date">{third.date}</div>
              </div>
            )}
          </div>

          <div className="hall-table">
            <div className="th">
              <div>RANK</div>
              <div>PLAYER</div>
              <div>SCORE</div>
              <div>DATE</div>
            </div>
            {rows.map((r, i) => (
              <div
                key={r.player}
                className={
                  "tr" +
                  (i === 0
                    ? " top1"
                    : i === 1
                      ? " top2"
                      : i === 2
                        ? " top3"
                        : "")
                }
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="rk">#{pad(r.rank)}</div>
                <div className="pl">{r.player}</div>
                <div className="sc">{fmt(r.score)}</div>
                <div className="dt">{r.date}</div>
              </div>
            ))}
            {user && mine && (
              <>
                <div className="tr you-label">▸ YOUR BEST IN {game.title}</div>
                <div
                  className="tr you"
                  style={{ animationDelay: `${rows.length * 50 + 50}ms` }}
                >
                  <div className="rk text-yellow">#{pad(mine.rank)}</div>
                  <div className="pl text-yellow">{user.name}</div>
                  <div className="sc text-yellow [text-shadow:0_0_6px_rgba(245,255,0,0.5)]">
                    {fmt(mine.score)}
                  </div>
                  <div className="dt">{mine.date}</div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      <div className="mt-8 text-center">
        <Link href="/games" className="btn lg">
          BACK TO LIBRARY
        </Link>
      </div>
    </div>
  );
}
