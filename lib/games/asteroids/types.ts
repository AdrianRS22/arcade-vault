import type { GameCallbacks, GameEngine } from "../types";

export type AsteroidsState = "playing" | "dead" | "gameover";

export type AsteroidsSnapshot = {
  score: number;
  lives: number; // starts at 3
  level: number; // starts at 1
  tripleTimer: number; // whole seconds left (ceil), 0 when inactive
  novaBombs: number; // 0 or 1
  state: AsteroidsState;
};

export type AsteroidsCallbacks = GameCallbacks<AsteroidsSnapshot>;

export type AsteroidsGame = GameEngine;
