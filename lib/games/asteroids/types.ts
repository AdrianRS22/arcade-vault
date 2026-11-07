export type AsteroidsState = "playing" | "dead" | "gameover";

export type AsteroidsSnapshot = {
  score: number;
  lives: number; // starts at 3
  level: number; // starts at 1
  tripleTimer: number; // whole seconds left (ceil), 0 when inactive
  novaBombs: number; // 0 or 1
  state: AsteroidsState;
};

export type AsteroidsCallbacks = {
  /** Called only when a snapshot field changes, never every frame. */
  onChange: (snapshot: AsteroidsSnapshot) => void;
  /** Called once per game over. */
  onGameOver: (finalScore: number) => void;
};

export type AsteroidsGame = {
  pause(): void;
  resume(): void;
  /** Forces game over with the current score. */
  end(): void;
  /** Starts a fresh game (score 0, 3 lives, level 1). */
  restart(): void;
  /** Cancels the animation frame and removes every listener. */
  destroy(): void;
};
