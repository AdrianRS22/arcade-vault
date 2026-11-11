import type { GameCallbacks } from "../types";

export type ToadRoadState = "playing" | "gameover";
export type LaneKind = "safe" | "road" | "river" | "goal";
export type ObjectKind = "car" | "truck" | "log" | "turtles";
export type DeathCause = "run-over" | "drowned" | "swept" | "bushed" | "time";

export type Lane = {
  row: number; // 0 = top (goal), 11 = bottom (start)
  kind: LaneKind;
  dir: 1 | -1; // 1 = moves right; ignored for safe and goal rows
  speed: number; // px/s, always positive
  object: ObjectKind | null;
  width: number; // px of one object
  count: number; // objects in the loop
  spacing: number; // px between the left edges of consecutive objects
};

export type ToadRoadSnapshot = {
  score: number; // 0..9_999_999, clamped
  lives: number; // starts at 3
  home: number; // goal slots filled, 0..5
  time: number; // ceil(seconds left in this attempt)
  state: ToadRoadState;
};

export type ToadRoadCallbacks = GameCallbacks<ToadRoadSnapshot>;
