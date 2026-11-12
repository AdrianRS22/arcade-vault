"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { Game } from "@/app/data/games";
import { isMuted, setMuted, subscribe } from "@/lib/games/shared/audio";
import { registry, type AnyGameDefinition } from "@/lib/games/registry";
import {
  DEFAULT_SKIN,
  getSkin,
  SKIN_LABELS,
  setSkin,
  subscribeSkin,
  type SkinId,
} from "@/lib/games/shared/skins";
import type { BaseSnapshot } from "@/lib/games/types";
import { GameCanvas, type GameHandle } from "./games/game-canvas";
import { TouchControls } from "./games/touch-controls";
import { saveScore } from "@/app/games/[id]/play/actions";
import { useSession } from "./session-provider";

// Every game shares the platform's pause; games only list their own keys.
const PAUSE_CONTROL = { keys: ["P", "Esc"], action: "Pause" };
// Mute is platform UI too; only games that declare `sound` get it.
const MUTE_CONTROL = { keys: ["M"], action: "Mute" };

type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved"; rank: number }
  | { status: "error"; message: string };

type PlayerProps = { game: Pick<Game, "id" | "title"> };

/** Plays the game registered under `game.id`, or says it is not playable yet. */
export function GamePlayer({ game }: PlayerProps) {
  const definition = registry[game.id];
  if (!definition) return <NotPlayable game={game} />;
  return <PlayableGame game={game} definition={definition} />;
}

function NotPlayable({ game }: PlayerProps) {
  return (
    <div className="av-player fade-in">
      <div className="crt">
        <div className="crt-screen">
          <div className="crt-content flex-col gap-3 px-6">
            <div className="pixel neon-magenta text-[22px]">
              NOT PLAYABLE YET
            </div>
            <p className="mono max-w-[44ch] text-[12px] leading-relaxed tracking-[0.04em] text-ink-dim">
              {game.title} is in the vault, but its game is not built yet. Pick
              another game or check back soon.
            </p>
            <div className="flex gap-2.5">
              <Link href={`/games/${game.id}`} className="btn ghost">
                EXIT
              </Link>
              <Link href="/games" className="btn">
                BROWSE GAMES
              </Link>
            </div>
          </div>
        </div>
        <div className="crt-bottom">
          <span className="led">NO SIGNAL</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>LOAD · 0MB</span>
        </div>
      </div>
    </div>
  );
}

function slug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function PlayableGame({
  game,
  definition,
}: PlayerProps & { definition: AnyGameDefinition }) {
  const { user, status } = useSession();
  const engineRef = useRef<GameHandle>(null);
  // Bumped on every restart so a save that finishes late is ignored.
  const runRef = useRef(0);

  const [snapshot, setSnapshot] = useState<BaseSnapshot>(
    definition.initialSnapshot,
  );
  const score = snapshot.score;
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [save, setSave] = useState<SaveState>({ status: "idle" });
  // Server snapshot is muted, so the first client render matches the HTML.
  const muted = useSyncExternalStore(subscribe, isMuted, () => true);
  const hasSound = definition.sound === true;
  // Per-game skin; the server snapshot is the default so hydration matches.
  const skin = useSyncExternalStore(
    subscribeSkin,
    () => getSkin(game.id),
    () => DEFAULT_SKIN,
  );
  // Filled by the engine once created; empty means the game has no skins yet.
  const [skins, setSkins] = useState<readonly SkinId[]>([]);

  // The engine follows the `paused` state.
  useEffect(() => {
    if (paused) engineRef.current?.pause();
    else engineRef.current?.resume();
  }, [paused]);

  // P / Esc toggle pause, and a hidden tab pauses automatically.
  useEffect(() => {
    if (over) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const isMute = hasSound && e.code === "KeyM";
      if (e.code !== "KeyP" && e.code !== "Escape" && !isMute) return;
      if (e.repeat) return;
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      )
        return;
      if (isMute) setMuted(!isMuted());
      else setPaused((p) => !p);
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
  }, [over, hasSound]);

  const handleChange = useCallback((s: BaseSnapshot) => setSnapshot(s), []);

  const handleGameOver = useCallback((finalScore: number) => {
    setSnapshot((s) => ({ ...s, score: finalScore }));
    setPaused(false);
    setOver(true);
  }, []);

  // Runs every time a fresh engine exists: on first load and whenever the
  // route is shown again (Cache Components keeps this component's state while
  // the engine is destroyed). A new engine means a new run, so drop any
  // leftover GAME OVER / pause / save state from the previous one.
  const handleEngineReady = useCallback(
    (available: readonly SkinId[]) => {
      setSkins(available);
      setSnapshot(definition.initialSnapshot);
      setPaused(false);
      setOver(false);
      runRef.current += 1;
      setSave((prev) => (prev.status === "idle" ? prev : { status: "idle" }));
    },
    [definition.initialSnapshot],
  );

  const end = () => {
    setPaused(false);
    engineRef.current?.end(); // reports through onGameOver
  };

  const restart = () => {
    setSnapshot(definition.initialSnapshot);
    setPaused(false);
    setOver(false);
    runRef.current += 1;
    setSave({ status: "idle" });
    engineRef.current?.restart();
  };

  // One save per game over: ignored while saving and once it has succeeded.
  const handleSave = async () => {
    if (save.status === "saving" || save.status === "saved") return;
    const run = runRef.current;
    setSave({ status: "saving" });
    let next: SaveState;
    try {
      const result = await saveScore(game.id, score);
      next = result.ok
        ? { status: "saved", rank: result.rank }
        : { status: "error", message: result.error };
    } catch {
      next = {
        status: "error",
        message: "Could not save your score. Try again.",
      };
    }
    if (run === runRef.current) setSave(next);
  };

  const controls = [
    ...definition.controls,
    PAUSE_CONTROL,
    ...(hasSound ? [MUTE_CONTROL] : []),
  ];

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div className="flex flex-wrap gap-6">
          <div className="hud-stat">
            <div className="l">Player</div>
            <div className="v text-ink">{user ? user.name : "GUEST"}</div>
          </div>
          <div className="hud-stat">
            <div className="l">Score</div>
            <div className="v">{score.toLocaleString("en-US")}</div>
          </div>
          {definition.hud(snapshot).map((stat) => (
            <div
              key={stat.label}
              className={`hud-stat ${slug(stat.label)} ${stat.variant ?? "cyan"}`}
            >
              <div className="l">{stat.label}</div>
              <div className="v">{stat.value}</div>
            </div>
          ))}
        </div>
        <div className="hud-actions">
          {skins.length > 0 && (
            <div className="skin-switch" role="radiogroup" aria-label="Skin">
              {skins.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={skin === id}
                  onClick={(e) => {
                    setSkin(game.id, id);
                    e.currentTarget.blur(); // keep Space/arrows for the game
                  }}
                >
                  {SKIN_LABELS[id]}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            className="btn yellow"
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? "RESUME" : "PAUSE"}
          </button>
          {hasSound && (
            <button
              type="button"
              className="btn"
              onClick={() => setMuted(!muted)}
            >
              {muted ? "UNMUTE" : "MUTE"}
            </button>
          )}
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
          <GameCanvas
            ref={engineRef}
            load={definition.load}
            ariaLabel={definition.ariaLabel}
            skin={skin}
            onSkins={handleEngineReady}
            onChange={handleChange}
            onGameOver={handleGameOver}
          />
          {paused && (
            <div className="crt-content z-5 bg-black/60">
              <div>
                <div className="pixel neon-yellow text-[22px]">PAUSED</div>
                <div className="mono mt-2.5 text-[11px] tracking-[0.16em] text-ink-dim">
                  PRESS P OR RESUME TO CONTINUE
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

      <TouchControls layout={definition.touch} disabled={paused || over} />

      <ul className="controls-legend" aria-label="Keyboard controls">
        {controls.map((c) => (
          <li key={`${c.action}:${c.keys.join("+")}`}>
            <span className="keys">
              {c.keys.map((k) => (
                <kbd key={k}>{k}</kbd>
              ))}
            </span>
            {c.action}
          </li>
        ))}
      </ul>

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>GAME OVER</h2>
            <div className="final-label">FINAL SCORE</div>
            <div className="final">{score.toLocaleString("en-US")}</div>
            {save.status === "saved" ? (
              <>
                <div className="toast-saved" role="status">
                  ▸ SAVED — RANK #{save.rank}_
                </div>
                <div className="mt-3">
                  <Link href="/hall-of-fame" className="lb-link">
                    SEE THE HALL OF FAME →
                  </Link>
                </div>
              </>
            ) : (
              <>
                {score === 0 ? (
                  <p className="mono m-0 text-[11px] tracking-[0.06em] text-ink-faint">
                    A score of 0 is not saved.
                  </p>
                ) : user ? (
                  <div className="input-row">
                    <button
                      type="button"
                      className="btn yellow w-full"
                      onClick={handleSave}
                      disabled={save.status === "saving"}
                    >
                      {save.status === "saving" ? "SAVING…" : "SAVE SCORE"}
                    </button>
                  </div>
                ) : status === "ready" ? (
                  <Link
                    href={`/login?next=/games/${game.id}/play`}
                    className="btn yellow w-full"
                  >
                    SIGN IN TO SAVE
                  </Link>
                ) : null}
                {save.status === "error" && (
                  <p className="save-error" role="alert">
                    {save.message}
                  </p>
                )}
              </>
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
