"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import type { GameDefinition } from "@/lib/games/registry";
import type {
  BaseSnapshot,
  GameCallbacks,
  GameEngine,
} from "@/lib/games/types";

export type GameHandle = Pick<
  GameEngine,
  "pause" | "resume" | "end" | "restart"
>;

type Props<S extends BaseSnapshot> = GameCallbacks<S> & {
  load: GameDefinition<S>["load"];
  ariaLabel: string;
  ref?: Ref<GameHandle>;
};

/**
 * Mounts a game engine on a canvas that fills its parent (the 4:3
 * `.crt-screen`). The engine module is loaded lazily and created once per
 * mount; it is destroyed on unmount, so it is safe under StrictMode's double
 * effect run (a `cancelled` flag drops an engine whose mount was undone).
 */
export function GameCanvas<S extends BaseSnapshot>({
  ref,
  load,
  ariaLabel,
  onChange,
  onGameOver,
}: Props<S>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  // Always call the latest callbacks without recreating the engine.
  const callbacksRef = useRef<GameCallbacks<S>>({ onChange, onGameOver });
  const loadRef = useRef(load);

  useEffect(() => {
    callbacksRef.current = { onChange, onGameOver };
    loadRef.current = load;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let engine: GameEngine | null = null;

    loadRef
      .current()
      .then(({ create }) => {
        if (cancelled) return;
        engine = create(canvas, {
          onChange: (snapshot) => callbacksRef.current.onChange(snapshot),
          onGameOver: (finalScore) =>
            callbacksRef.current.onGameOver(finalScore),
        });
        engineRef.current = engine;
      })
      .catch((error: unknown) => {
        console.error("Could not load the game", error);
      });

    return () => {
      cancelled = true;
      engine?.destroy();
      engineRef.current = null;
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      pause: () => engineRef.current?.pause(),
      resume: () => engineRef.current?.resume(),
      end: () => engineRef.current?.end(),
      restart: () => engineRef.current?.restart(),
    }),
    [],
  );

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 block h-full w-full"
      aria-label={ariaLabel}
      role="img"
    />
  );
}
