import { createInput } from "../shared/input";
import type { GameEngine } from "../types";
import {
  BLOCK,
  BOARD_X,
  BOARD_Y,
  COLS,
  FREEZE_SECONDS,
  GRID_COLOR,
  H,
  HARD_DROP_POINTS,
  KICKS,
  LINES_PER_LEVEL,
  LINE_SCORES,
  MAX_SCORE,
  NEXT_CELLS,
  NEXT_X,
  NEXT_Y,
  PALETTE,
  POWERUPS,
  POWERUP_BASE,
  POWERUP_EVERY,
  POWERUP_POINTS,
  ROWS,
  SOFT_DROP_POINTS,
  W,
  WILD,
  dropInterval,
} from "./constants";
import { PIECE_COUNT, randomPiece, randomPowerup, rotateCW } from "./pieces";
import type { Piece, TetrisCallbacks, TetrisSnapshot } from "./types";

export type { TetrisCallbacks, TetrisSnapshot };

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
        for (let r = 0; r < ROWS; r++)
          if (board[r][c]) column.push(board[r][c]);
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

// ── Engine: loop, input and drawing ───────────────────────────────────────────

/** Keys that must not scroll the page while playing. */
const GAME_KEYS = ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

const FIELD_BG = "#000000";
const BOARD_BORDER = "rgba(0, 245, 255, 0.35)";
const LABEL_COLOR = "#8a8fb5"; // --ink-dim
const FREEZE_TINT = "rgba(64, 196, 255, 0.12)";

export function createTetrisGame(
  canvas: HTMLCanvasElement,
  callbacks: TetrisCallbacks,
): GameEngine {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context is not available");

  // Logical field is W×H; the backing store follows devicePixelRatio.
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const input = createInput({ preventDefault: GAME_KEYS });

  // ── State ───────────────────────────────────────────────────────────────────
  let game = createGame();
  let dropAccum = 0;
  let gameOverSent = false;

  // ── Loop control ────────────────────────────────────────────────────────────
  let running = false;
  let paused = false;
  let destroyed = false;
  let rafId = 0;
  let lastTime: number | null = null;

  // Keys held when the game resumed: their auto-repeats are ignored until the
  // key is released, so a held key does not act the moment the game resumes.
  const resumeGuard = new Set<string>();
  const onKeyUp = (e: KeyboardEvent) => resumeGuard.delete(e.code);
  window.addEventListener("keyup", onKeyUp);

  // ── Snapshot (React-facing) ─────────────────────────────────────────────────
  let lastSnap: TetrisSnapshot | null = null;

  function emit() {
    const snap: TetrisSnapshot = {
      score: game.score,
      lines: game.lines,
      level: game.level,
      freezeSeconds: freezeSeconds(game),
      state: game.over ? "gameover" : "playing",
    };
    if (
      lastSnap &&
      lastSnap.score === snap.score &&
      lastSnap.lines === snap.lines &&
      lastSnap.level === snap.level &&
      lastSnap.freezeSeconds === snap.freezeSeconds &&
      lastSnap.state === snap.state
    )
      return;
    lastSnap = snap;
    callbacks.onChange(snap);
  }

  // ── Input ───────────────────────────────────────────────────────────────────
  /** True when `code` was pressed (or auto-repeated) and is not resume-guarded. */
  function took(code: string, repeating: boolean): boolean {
    const hit = repeating ? input.pressedOrRepeat(code) : input.pressed(code);
    return hit && !resumeGuard.has(code);
  }

  // ── Actions ─────────────────────────────────────────────────────────────────
  function lock() {
    lockPiece(game);
    dropAccum = 0;
  }

  function stepDown() {
    const { board, current } = game;
    if (collide(board, current.shape, current.x, current.y + 1)) lock();
    else current.y++;
  }

  function softDrop() {
    const { board, current } = game;
    if (collide(board, current.shape, current.x, current.y + 1)) {
      lock();
      return;
    }
    current.y++;
    addScore(game, SOFT_DROP_POINTS);
    dropAccum = 0;
  }

  function hardDrop() {
    const y = ghostY(game);
    addScore(game, (y - game.current.y) * HARD_DROP_POINTS);
    game.current.y = y;
    lock();
  }

  // ── Update ──────────────────────────────────────────────────────────────────
  function update(dt: number) {
    if (game.over) return;

    if (took("ArrowLeft", true)) tryMove(game, -1);
    if (took("ArrowRight", true)) tryMove(game, 1);
    if (took("ArrowUp", false) || took("KeyX", false)) tryRotate(game);
    if (took("ArrowDown", true)) softDrop();
    if (!game.over && took("Space", false)) hardDrop();
    if (game.over) return;

    tickFreeze(game, dt);
    if (isFrozen(game)) {
      dropAccum = 0;
      return;
    }
    dropAccum += dt;
    if (dropAccum >= dropInterval(game.level)) {
      dropAccum = 0;
      stepDown();
    }
  }

  // ── Draw ────────────────────────────────────────────────────────────────────
  function drawCell(x: number, y: number, value: number, alpha = 1) {
    if (!ctx) return;
    const color = PALETTE[value];
    if (!color) return;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, BLOCK - 2, BLOCK - 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
    ctx.fillRect(x + 1, y + 1, BLOCK - 2, 3);
    ctx.globalAlpha = 1;
  }

  function drawIcon(x: number, y: number, value: number, alpha = 1) {
    if (!ctx) return;
    const icon = POWERUPS[value - POWERUP_BASE]?.icon;
    if (!icon) return;
    ctx.globalAlpha = alpha;
    ctx.font = `${Math.round(BLOCK * 0.62)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(icon, x + BLOCK / 2, y + BLOCK / 2 + 1);
    ctx.globalAlpha = 1;
  }

  /** Draws a piece with its top-left matrix cell at column `x`, row `y`. */
  function drawPiece(
    piece: Piece,
    x: number,
    y: number,
    alpha: number,
    glow: boolean,
  ) {
    if (!ctx) return;
    if (glow) {
      ctx.shadowColor = PALETTE[piece.type] ?? "#ffffff";
      ctx.shadowBlur = 12;
    }
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        const v = piece.shape[r][c];
        if (!v || y + r < 0) continue;
        drawCell(
          BOARD_X + (x + c) * BLOCK,
          BOARD_Y + (y + r) * BLOCK,
          v,
          alpha,
        );
      }
    }
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
    if (piece.power) {
      drawIcon(BOARD_X + x * BLOCK, BOARD_Y + y * BLOCK, piece.type, alpha);
    }
  }

  function drawNext() {
    if (!ctx) return;
    const size = NEXT_CELLS * BLOCK;
    ctx.strokeStyle = BOARD_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(NEXT_X + 0.5, NEXT_Y + 0.5, size, size);

    // Center the piece's filled cells inside the 4×4 box.
    const { shape } = game.next;
    let minR = shape.length;
    let maxR = -1;
    let minC = shape[0].length;
    let maxC = -1;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
        minC = Math.min(minC, c);
        maxC = Math.max(maxC, c);
      }
    }
    const offX = NEXT_X + (size - (maxC - minC + 1) * BLOCK) / 2 - minC * BLOCK;
    const offY = NEXT_Y + (size - (maxR - minR + 1) * BLOCK) / 2 - minR * BLOCK;
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const v = shape[r][c];
        if (!v) continue;
        drawCell(offX + c * BLOCK, offY + r * BLOCK, v);
        if (game.next.power) drawIcon(offX + c * BLOCK, offY + r * BLOCK, v);
      }
    }

    ctx.font = "bold 14px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = LABEL_COLOR;
    ctx.fillText("NEXT", NEXT_X, NEXT_Y + size + 22);
  }

  function draw() {
    if (!ctx) return;
    ctx.fillStyle = FIELD_BG;
    ctx.fillRect(0, 0, W, H);

    // Grid and frame
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 1; c < COLS; c++) {
      const x = BOARD_X + c * BLOCK + 0.5;
      ctx.moveTo(x, BOARD_Y);
      ctx.lineTo(x, BOARD_Y + ROWS * BLOCK);
    }
    for (let r = 1; r < ROWS; r++) {
      const y = BOARD_Y + r * BLOCK + 0.5;
      ctx.moveTo(BOARD_X, y);
      ctx.lineTo(BOARD_X + COLS * BLOCK, y);
    }
    ctx.stroke();
    ctx.strokeStyle = BOARD_BORDER;
    ctx.strokeRect(BOARD_X + 0.5, BOARD_Y + 0.5, COLS * BLOCK, ROWS * BLOCK);

    // Locked blocks
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = game.board[r][c];
        if (v) drawCell(BOARD_X + c * BLOCK, BOARD_Y + r * BLOCK, v);
      }
    }

    if (!game.over) {
      drawPiece(game.current, game.current.x, ghostY(game), 0.2, false);
      drawPiece(game.current, game.current.x, game.current.y, 1, true);
    }
    drawNext();

    if (isFrozen(game)) {
      ctx.fillStyle = FREEZE_TINT;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ── Game over ───────────────────────────────────────────────────────────────
  /** Reports a finished run once and stops the loop on its final frame. */
  function settle() {
    if (!game.over || gameOverSent) return;
    gameOverSent = true;
    emit();
    draw();
    stop();
    callbacks.onGameOver(game.score);
  }

  // ── Main loop ───────────────────────────────────────────────────────────────
  function loop(ts: number) {
    if (!running) return;
    // dt capped at 0.05 s to avoid big jumps after tab switches
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    update(dt);
    if (game.over) {
      settle();
      return;
    }
    draw();
    emit();
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (running || destroyed) return;
    running = true;
    lastTime = null; // no dt jump after a pause or restart
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
  }

  // ── Public API ──────────────────────────────────────────────────────────────
  emit();
  draw();
  start();

  return {
    pause() {
      if (destroyed || paused || game.over) return;
      paused = true;
      stop();
    },
    resume() {
      if (destroyed || !paused) return;
      paused = false;
      // Keys still held (or tapped while paused) must not act on resume.
      for (const [code, held] of Object.entries(input.keys)) {
        if (held) resumeGuard.add(code);
      }
      input.reset();
      start();
    },
    end() {
      if (destroyed || game.over) return;
      paused = false;
      game.over = true;
      settle();
    },
    restart() {
      if (destroyed) return;
      stop();
      paused = false;
      game = createGame();
      dropAccum = 0;
      gameOverSent = false;
      resumeGuard.clear();
      input.reset();
      emit();
      draw();
      start();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stop();
      input.detach();
      window.removeEventListener("keyup", onKeyUp);
    },
  };
}
