import { X_MAX, X_MIN } from "./constants";
import type { Lane } from "./types";

const none = {
  dir: 1,
  speed: 0,
  object: null,
  width: 0,
  count: 0,
  spacing: 0,
} as const;

/**
 * Row 0 is the top (goal), row 11 the bottom (start). Every moving lane is a
 * conveyor belt: count × spacing is the loop length and is at least W + width,
 * so the lane never shows a gap that is not a real gap.
 */
export const LANES: readonly Lane[] = [
  { row: 0, kind: "goal", ...none },
  {
    row: 1,
    kind: "river",
    dir: 1,
    speed: 90,
    object: "log",
    width: 150,
    count: 3,
    spacing: 380,
  },
  {
    row: 2,
    kind: "river",
    dir: -1,
    speed: 70,
    object: "turtles",
    width: 100,
    count: 4,
    spacing: 300,
  },
  {
    row: 3,
    kind: "river",
    dir: 1,
    speed: 110,
    object: "log",
    width: 250,
    count: 3,
    spacing: 400,
  },
  {
    row: 4,
    kind: "river",
    dir: -1,
    speed: 80,
    object: "turtles",
    width: 150,
    count: 3,
    spacing: 360,
  },
  {
    row: 5,
    kind: "river",
    dir: 1,
    speed: 60,
    object: "log",
    width: 150,
    count: 3,
    spacing: 380,
  },
  { row: 6, kind: "safe", ...none },
  {
    row: 7,
    kind: "road",
    dir: -1,
    speed: 150,
    object: "car",
    width: 50,
    count: 4,
    spacing: 300,
  },
  {
    row: 8,
    kind: "road",
    dir: 1,
    speed: 100,
    object: "truck",
    width: 100,
    count: 3,
    spacing: 400,
  },
  {
    row: 9,
    kind: "road",
    dir: -1,
    speed: 120,
    object: "car",
    width: 50,
    count: 4,
    spacing: 290,
  },
  {
    row: 10,
    kind: "road",
    dir: 1,
    speed: 80,
    object: "car",
    width: 50,
    count: 4,
    spacing: 280,
  },
  { row: 11, kind: "safe", ...none },
];

/** Length in px of one full loop of a lane. */
export function loopLength(lane: Lane): number {
  return lane.count * lane.spacing;
}

/** Maps `v` into [0, len). Works for negative values too. */
export function wrap(v: number, len: number): number {
  return ((v % len) + len) % len;
}

/** Left edge (px) of object `i` of a lane, given the lane's current offset. */
export function objectLeft(lane: Lane, offset: number, i: number): number {
  return wrap(offset + i * lane.spacing, loopLength(lane)) - lane.width;
}

/** Index of the object of the lane whose span contains `x`, or -1 if none. */
export function platformAt(lane: Lane, offset: number, x: number): number {
  for (let i = 0; i < lane.count; i++) {
    const left = objectLeft(lane, offset, i);
    if (x >= left && x <= left + lane.width) return i;
  }
  return -1;
}

/** Snaps a center x to the nearest cell center, clamped to [X_MIN, X_MAX]. */
export function snapToCell(x: number): number {
  const snapped = 25 + 50 * Math.round((x - 25) / 50);
  return Math.min(X_MAX, Math.max(X_MIN, snapped));
}
