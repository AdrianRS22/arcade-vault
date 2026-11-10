import type { SkinId } from "./shared/skins";

export type GameEngine = {
  pause(): void;
  resume(): void;
  end(): void; // forces game over with the current score
  restart(): void; // fresh run
  destroy(): void; // cancels rAF, detaches input
  /** Skins this engine can draw. GamePlayer shows the SKIN selector only if set. */
  skins?: readonly SkinId[];
  /** Swaps the skin live (no restart) and redraws, even while paused. */
  setSkin?(skin: SkinId): void;
};

/** Per-player options the platform passes to every engine factory. */
export type GameOptions = { skin: SkinId };

export type BaseSnapshot = { score: number; state: string };

export type GameCallbacks<S extends BaseSnapshot> = {
  onChange: (snapshot: S) => void; // only when a field changes, never every frame
  onGameOver: (finalScore: number) => void; // once per game over
};
