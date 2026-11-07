export type GameEngine = {
  pause(): void;
  resume(): void;
  end(): void; // forces game over with the current score
  restart(): void; // fresh run
  destroy(): void; // cancels rAF, detaches input
};

export type BaseSnapshot = { score: number; state: string };

export type GameCallbacks<S extends BaseSnapshot> = {
  onChange: (snapshot: S) => void; // only when a field changes, never every frame
  onGameOver: (finalScore: number) => void; // once per game over
};
