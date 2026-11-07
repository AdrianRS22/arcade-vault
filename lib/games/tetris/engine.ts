import {
  COLS,
  FREEZE_SECONDS,
  KICKS,
  LINES_PER_LEVEL,
  LINE_SCORES,
  MAX_SCORE,
  POWERUP_EVERY,
  POWERUP_POINTS,
  ROWS,
  WILD,
} from "./constants";
import { PIECE_COUNT, randomPiece, randomPowerup, rotateCW } from "./pieces";
import type { Piece } from "./types";

/** `ROWS × COLS` matrix: 0 is empty, 1..7 pieces, 9 wild. Power-ups never stay. */
export type Board = number[][];

/** Pure game state. Everything else (loop, input, drawing) lives around it. */
export type TetrisGame = {
  board: Board;
  current: Piece;
  next: Piece;
  score: number;
  lines: number;
  level: number;
  over: boolean;
  /** A power-up piece is due as the next spawn (set every `POWERUP_EVERY` lines). */
  powerupPending: boolean;
  nextPowerupAt: number;
  /** Milliseconds of freeze left, 0 when inactive. */
  freezeMs: number;
};

export function createBoard(): Board {
  return Array.from({ length: ROWS }, () => new Array<number>(COLS).fill(0));
}

/** A fresh run: empty board, score 0, lines 0, level 1. */
export function createGame(): TetrisGame {
  return {
    board: createBoard(),
    current: randomPiece(),
    next: randomPiece(),
    score: 0,
    lines: 0,
    level: 1,
    over: false,
    powerupPending: false,
    nextPowerupAt: POWERUP_EVERY,
    freezeMs: 0,
  };
}

/** Level for a total of cleared lines: 1 + floor(lines / 10). */
export function levelFor(lines: number): number {
  return 1 + Math.floor(lines / LINES_PER_LEVEL);
}

/** Adds points, clamped to the database limit. */
export function addScore(game: TetrisGame, points: number): void {
  game.score = Math.min(MAX_SCORE, game.score + points);
}

/** True when `shape` at (`x`, `y`) leaves the walls/floor or overlaps a block. */
export function collide(
  board: Board,
  shape: readonly (readonly number[])[],
  x: number,
  y: number,
): boolean {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = x + c;
      const ny = y + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

/** Rotates the current piece clockwise, trying `KICKS` in order. */
export function tryRotate(game: TetrisGame): boolean {
  const { board, current } = game;
  const rotated = rotateCW(current.shape);
  for (const kick of KICKS) {
    if (!collide(board, rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return true;
    }
  }
  return false;
}

/** Moves the current piece sideways. False when a wall or block is in the way. */
export function tryMove(game: TetrisGame, dx: number): boolean {
  const { board, current } = game;
  if (collide(board, current.shape, current.x + dx, current.y)) return false;
  current.x += dx;
  return true;
}

/** Writes the current piece into the board. */
export function merge(game: TetrisGame): void {
  const { board, current } = game;
  for (let r = 0; r < current.shape.length; r++) {
    for (let c = 0; c < current.shape[r].length; c++) {
      if (current.shape[r][c]) {
        board[current.y + r][current.x + c] = current.shape[r][c];
      }
    }
  }
}

/** A row clears when full, or with exactly one gap and a wild block. */
export function rowComplete(row: readonly number[]): boolean {
  const gaps = row.filter((v) => v === 0).length;
  return gaps === 0 || (gaps === 1 && row.includes(WILD));
}

/**
 * Removes the complete rows, then adds their points (using the level before
 * the clear) and the new level. Returns how many rows were removed.
 */
export function clearLines(game: TetrisGame): number {
  const { board } = game;
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (rowComplete(board[r])) {
      board.splice(r, 1);
      board.unshift(new Array<number>(COLS).fill(0));
      cleared++;
      r++; // the rows shifted down: check this index again
    }
  }
  if (cleared) {
    game.lines += cleared;
    addScore(game, (LINE_SCORES[cleared] ?? 0) * game.level);
    game.level = levelFor(game.lines);
    // Counted by total lines, so a clear that crosses a multiple of 5 counts.
    // Crossing several at once still queues a single power-up.
    while (game.lines >= game.nextPowerupAt) {
      game.powerupPending = true;
      game.nextPowerupAt += POWERUP_EVERY;
    }
  }
  return cleared;
}

/** Row where the current piece would land if dropped straight down. */
export function ghostY(game: TetrisGame): number {
  const { board, current } = game;
  let y = current.y;
  while (!collide(board, current.shape, current.x, y + 1)) y++;
  return y;
}

/**
 * Promotes `next` to `current` and draws a new `next` (a power-up when one is
 * pending). Sets `over` when the new piece collides at once.
 */
export function spawn(game: TetrisGame): void {
  game.current = game.next;
  game.next = game.powerupPending ? randomPowerup() : randomPiece();
  game.powerupPending = false;
  if (collide(game.board, game.current.shape, game.current.x, game.current.y)) {
    game.over = true;
  }
}

/**
 * Applies the landed power-up piece at its landing cell. The piece is never
 * merged into the board. Every power-up adds `POWERUP_POINTS × level`.
 */
export function applyPowerup(game: TetrisGame): void {
  const { board, current } = game;
  const cx = current.x;
  const cy = current.y;

  switch (current.power) {
    case "bomb":
      for (let r = cy - 1; r <= cy + 1; r++) {
        for (let c = cx - 1; c <= cx + 1; c++) {
          if (r >= 0 && r < ROWS && c >= 0 && c < COLS) board[r][c] = 0;
        }
      }
      break;
    case "lightning":
      board[cy].fill(0);
      for (let r = 0; r < ROWS; r++) board[r][cx] = 0;
      break;
    case "tint": {
      // The colour directly below the landing cell, else the most frequent one.
      let target = cy + 1 < ROWS ? board[cy + 1][cx] : 0;
      if (target < 1 || target > PIECE_COUNT) {
        const counts = new Array<number>(PIECE_COUNT + 1).fill(0);
        for (const row of board) {
          for (const v of row) if (v >= 1 && v <= PIECE_COUNT) counts[v]++;
        }
        const max = Math.max(...counts);
        target = max ? counts.indexOf(max) : 0;
      }
      if (target) {
        for (const row of board) {
          for (let c = 0; c < COLS; c++) if (row[c] === target) row[c] = WILD;
        }
      }
      break;
    }
    case "gravity":
      for (let c = 0; c < COLS; c++) {
        const column: number[] = [];
        for (let r = 0; r < ROWS; r++) if (board[r][c]) column.push(board[r][c]);
        for (let r = ROWS - 1; r >= 0; r--) board[r][c] = column.pop() ?? 0;
      }
      break;
    case "freeze":
      game.freezeMs = FREEZE_SECONDS * 1000;
      break;
  }

  addScore(game, POWERUP_POINTS * game.level);
}

/** Counts the freeze down. Gravity must not run while `isFrozen`. */
export function tickFreeze(game: TetrisGame, dt: number): void {
  if (game.freezeMs > 0) game.freezeMs = Math.max(0, game.freezeMs - dt * 1000);
}

export function isFrozen(game: TetrisGame): boolean {
  return game.freezeMs > 0;
}

/** Whole seconds of freeze left (ceil), 0 when inactive. */
export function freezeSeconds(game: TetrisGame): number {
  return Math.ceil(game.freezeMs / 1000);
}

/**
 * Locks the current piece: a power-up applies its effect, any other piece is
 * merged. Then rows clear and the next piece spawns (`over` if it collides).
 */
export function lockPiece(game: TetrisGame): void {
  if (game.current.power) applyPowerup(game);
  else merge(game);
  clearLines(game);
  spawn(game);
}
