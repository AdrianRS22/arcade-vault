import type { GameCallbacks } from "../types";

export type TetrisState = "playing" | "gameover";

export type TetrisSnapshot = {
  score: number; // 0..9_999_999, clamped
  lines: number; // total lines cleared, starts at 0
  level: number; // 1 + floor(lines / 10), starts at 1
  freezeSeconds: number; // whole seconds left (ceil), 0 when inactive
  state: TetrisState;
};

export type TetrisCallbacks = GameCallbacks<TetrisSnapshot>;

export type PowerupName = "bomb" | "lightning" | "tint" | "gravity" | "freeze";

export type Piece = {
  /** Board value: 1..7 are pieces, 9 is wild, 10..14 are power-ups. */
  type: number;
  shape: number[][];
  x: number;
  y: number;
  /** Set only on power-up pieces (a single cell). */
  power?: PowerupName;
};
