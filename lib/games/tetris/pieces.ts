import { COLS, POWERUPS, POWERUP_BASE } from "./constants";
import type { Piece } from "./types";

/** Piece matrices by board value (1..8). Each cell holds the piece's own value. */
export const PIECES: Readonly<Record<number, readonly (readonly number[])[]>> =
  {
    1: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ], // I
    2: [
      [2, 2],
      [2, 2],
    ], // O
    3: [
      [0, 3, 0],
      [3, 3, 3],
      [0, 0, 0],
    ], // T
    4: [
      [0, 4, 4],
      [4, 4, 0],
      [0, 0, 0],
    ], // S
    5: [
      [5, 5, 0],
      [0, 5, 5],
      [0, 0, 0],
    ], // Z
    6: [
      [6, 0, 0],
      [6, 6, 6],
      [0, 0, 0],
    ], // J
    7: [
      [0, 0, 7],
      [7, 7, 7],
      [0, 0, 0],
    ], // L
    // 8: [
    //   [8, 8, 8],
    //   [8, 0, 8],
    //   [8, 8, 8],
    // ], // N (nut)
  };

export const PIECE_COUNT = 8;

/** Rotates a matrix 90° clockwise. */
export function rotateCW(shape: readonly (readonly number[])[]): number[][] {
  const rows = shape.length;
  const cols = shape[0].length;
  const result = Array.from({ length: cols }, () =>
    new Array<number>(rows).fill(0),
  );
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      result[c][rows - 1 - r] = shape[r][c];
    }
  }
  return result;
}

/** A plain random piece (no 7-bag), centered at the top. */
export function randomPiece(rng: () => number = Math.random): Piece {
  const type = Math.floor(rng() * PIECE_COUNT) + 1;
  const shape = PIECES[type].map((row) => [...row]);
  return {
    type,
    shape,
    x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
    y: 0,
  };
}

/** A single-cell power-up piece that spawns at column 5. */
export function randomPowerup(rng: () => number = Math.random): Piece {
  const i = Math.floor(rng() * POWERUPS.length);
  const type = POWERUP_BASE + i;
  return {
    type,
    shape: [[type]],
    power: POWERUPS[i].name,
    x: Math.floor(COLS / 2),
    y: 0,
  };
}
