"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { createAsteroidsGame } from "@/lib/games/asteroids/engine";
import type {
  AsteroidsCallbacks,
  AsteroidsGame,
} from "@/lib/games/asteroids/types";

export type AsteroidsHandle = Pick<
  AsteroidsGame,
  "pause" | "resume" | "end" | "restart"
>;

type Props = AsteroidsCallbacks & {
  ref?: Ref<AsteroidsHandle>;
};

/**
 * Mounts the Asteroids engine on a canvas that fills its parent
 * (the 4:3 `.crt-screen`). The engine is created once per mount and destroyed
 * on unmount, so it is safe under StrictMode's double effect run.
 */
export function AsteroidsCanvas({ ref, onChange, onGameOver }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<AsteroidsGame | null>(null);
  // Always call the latest callbacks without recreating the engine.
  const callbacksRef = useRef<AsteroidsCallbacks>({ onChange, onGameOver });

  useEffect(() => {
    callbacksRef.current = { onChange, onGameOver };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = createAsteroidsGame(canvas, {
      onChange: (snapshot) => callbacksRef.current.onChange(snapshot),
      onGameOver: (finalScore) => callbacksRef.current.onGameOver(finalScore),
    });
    gameRef.current = game;
    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      pause: () => gameRef.current?.pause(),
      resume: () => gameRef.current?.resume(),
      end: () => gameRef.current?.end(),
      restart: () => gameRef.current?.restart(),
    }),
    [],
  );

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 block h-full w-full"
      aria-label="Asteroids game"
      role="img"
    />
  );
}
