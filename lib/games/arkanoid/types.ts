import type { GameCallbacks } from "../types";

export type ArkanoidState = "playing" | "gameover";

export type ArkanoidSnapshot = {
  score: number; // 0..9_999_999, clamped
  lives: number; // starts at 3
  level: number; // 1, 2, 3, 4… (layout = (level - 1) % 3)
  state: ArkanoidState;
};

export type ArkanoidCallbacks = GameCallbacks<ArkanoidSnapshot>;

export type BrickColor =
  | "red"
  | "yellow"
  | "cyan"
  | "magenta"
  | "hotpink"
  | "green";

export type Brick = {
  x: number;
  y: number;
  color: BrickColor;
  alive: boolean;
};

export type Explosion = {
  x: number;
  y: number;
  color: BrickColor;
  t: number; // seconds since the brick broke
};
