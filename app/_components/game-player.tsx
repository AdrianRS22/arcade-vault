"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Game } from "@/app/data/games";
import type { AsteroidsSnapshot } from "@/lib/games/asteroids/types";
import {
  AsteroidsCanvas,
  type AsteroidsHandle,
} from "./games/asteroids-canvas";
import { useSession } from "./session-provider";

const CONTROLS: { keys: string[]; action: string }[] = [
  { keys: ["←", "→"], action: "Rotate" },
  { keys: ["↑"], action: "Thrust" },
  { keys: ["Space"], action: "Shoot" },
  { keys: ["B"], action: "Nova bomb" },
  { keys: ["P", "Esc"], action: "Pause" },
];

export function GamePlayer({ game }: { game: Pick<Game, "id" | "title"> }) {
  const { user } = useSession();
  // Only Asteroids has a real engine; every other game keeps the fake arena.
  const isReal = game.id === "asteroids";
  const engineRef = useRef<AsteroidsHandle>(null);

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [realLevel, setRealLevel] = useState(1);
  const [triple, setTriple] = useState(0);
  const [nova, setNova] = useState(0);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [name, setName] = useState(user ? user.name : "GUEST");
  const [saved, setSaved] = useState(false);

  // Fake games: level is derived from the score (one level every 2,500 points).
  const level = isReal ? realLevel : 1 + Math.floor(score / 2500);

  // Fake games only: random score ticker.
  useEffect(() => {
    if (isReal || over || paused) return;
    const t = setInterval(
      () => setScore((s) => s + Math.floor(10 + Math.random() * 90)),
      220,
    );
    return () => clearInterval(t);
  }, [isReal, over, paused]);

  // Real games: the engine follows the `paused` state.
  useEffect(() => {
    if (!isReal) return;
    if (paused) engineRef.current?.pause();
    else engineRef.current?.resume();
  }, [isReal, paused]);

  // Real games: P / Esc toggle pause, and a hidden tab pauses automatically.
  useEffect(() => {
    if (!isReal || over) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "KeyP" && e.code !== "Escape") return;
      if (e.repeat) return;
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      )
        return;
      setPaused((p) => !p);
    };
    const onVisibility = () => {
      if (document.hidden) setPaused(true);
    };

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isReal, over]);

  const handleChange = useCallback((s: AsteroidsSnapshot) => {
    setScore(s.score);
    setLives(s.lives);
    setRealLevel(s.level);
    setTriple(s.tripleTimer);
    setNova(s.novaBombs);
  }, []);

  const handleGameOver = useCallback((finalScore: number) => {
    setScore(finalScore);
    setPaused(false);
    setOver(true);
  }, []);

  const end = () => {
    if (isReal) {
      setPaused(false);
      engineRef.current?.end(); // reports through onGameOver
    } else {
      setOver(true);
    }
  };

  const restart = () => {
    setScore(0);
    setLives(3);
    setRealLevel(1);
    setTriple(0);
    setNova(0);
    setPaused(false);
    setOver(false);
    setSaved(false);
    if (isReal) engineRef.current?.restart();
  };

  const powerText = [
    triple > 0 ? `TRIPLE ${triple}s` : null,
    nova > 0 ? "NOVA [B]" : null,
  ]
    .filter(Boolean)
    .join("  ");

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div className="flex flex-wrap gap-6">
          <div className="hud-stat">
            <div className="l">Player</div>
            <div className="v text-ink">{name}</div>
          </div>
          <div className="hud-stat">
            <div className="l">Score</div>
            <div className="v">{score.toLocaleString("en-US")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Lives</div>
            <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Level</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
          {isReal && (
            <div className="hud-stat power">
              <div className="l">Power-up</div>
              <div className="v">{powerText || "—"}</div>
            </div>
          )}
        </div>
        <div className="hud-actions">
          <button
            type="button"
            className="btn yellow"
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? "RESUME" : "PAUSE"}
          </button>
          <button type="button" className="btn magenta" onClick={end}>
            END
          </button>
          <Link href={`/games/${game.id}`} className="btn ghost">
            EXIT
          </Link>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          {isReal ? (
            <AsteroidsCanvas
              ref={engineRef}
              onChange={handleChange}
              onGameOver={handleGameOver}
            />
          ) : (
            <div className="game-arena">
              <div className="grid-floor"></div>
              <div className="enemy e1"></div>
              <div className="enemy e2"></div>
              <div className="enemy e3"></div>
              <div className="player-ship"></div>
            </div>
          )}
          {paused && (
            <div className="crt-content z-5 bg-black/60">
              <div>
                <div className="pixel neon-yellow text-[22px]">PAUSED</div>
                <div className="mono mt-2.5 text-[11px] tracking-[0.16em] text-ink-dim">
                  {isReal
                    ? "PRESS P OR RESUME TO CONTINUE"
                    : "PRESS RESUME TO CONTINUE"}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SIGNAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>LOAD · 1MB</span>
        </div>
      </div>

      {isReal && (
        <ul className="controls-legend" aria-label="Keyboard controls">
          {CONTROLS.map((c) => (
            <li key={c.action}>
              <span className="keys">
                {c.keys.map((k) => (
                  <kbd key={k}>{k}</kbd>
                ))}
              </span>
              {c.action}
            </li>
          ))}
        </ul>
      )}

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>GAME OVER</h2>
            <div className="final-label">FINAL SCORE</div>
            <div className="final">{score.toLocaleString("en-US")}</div>
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value.toUpperCase().slice(0, 10))
                  }
                  placeholder="YOUR INITIALS"
                  aria-label="Your initials"
                />
                <button
                  type="button"
                  className="btn yellow"
                  onClick={() => setSaved(true)}
                >
                  SAVE SCORE
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ SCORE SAVED_</div>
            )}
            <div className="actions">
              <button type="button" className="btn" onClick={restart}>
                PLAY AGAIN
              </button>
              <Link href="/games" className="btn magenta">
                BACK TO VAULT
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
