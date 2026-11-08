import type { GameCallbacks } from "../types";

export type SnakeState = "waiting" | "playing" | "gameover";

export type Dir = "up" | "down" | "left" | "right";

/** Grid coordinates, origin top-left. */
export type Cell = { x: number; y: number };

export type Fruit = { cell: Cell; sprite: number }; // sprite: index into FRUIT_SPRITES

export type Bonus = Fruit & { remaining: number }; // seconds left

export type SnakeSnapshot = {
  score: number; // 0..9_999_999, clamped
  length: number; // starts at 3
  level: number; // 1, 2, 3…
  bonusSeconds: number; // 0 = no bonus on screen, else ceil(remaining)
  state: SnakeState;
};

export type SnakeCallbacks = GameCallbacks<SnakeSnapshot>;
