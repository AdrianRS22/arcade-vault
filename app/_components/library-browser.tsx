"use client";

import { useMemo, useState } from "react";
import { CATEGORIES, type Game } from "@/app/data/games";
import { GameCard } from "./game-card";

export function LibraryBrowser({ games }: { games: Game[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("ALL");

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return games.filter(
      (g) =>
        (category === "ALL" || g.category === category) &&
        g.title.toLowerCase().includes(q),
    );
  }, [games, query, category]);

  return (
    <>
      <div className="av-filters">
        <div className="av-search">
          <span className="ico">⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a game by name…"
            aria-label="Search games"
          />
        </div>
        <div className="av-chips">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className={"chip" + (category === c ? " active" : "")}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="av-grid">
        {filtered.map((g) => (
          <GameCard key={g.id} game={g} />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full p-20 text-center text-ink-faint">
            <div className="pixel mb-3 text-[14px] text-(--magenta)">
              NO RESULTS
            </div>
            <div>Try another search or category.</div>
          </div>
        )}
      </div>
    </>
  );
}
