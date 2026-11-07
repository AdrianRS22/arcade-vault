import type { PowerupName } from "./types";

export const COLS = 10;
export const ROWS = 20;
export const LINE_SCORES = [0, 100, 300, 500, 800]; // multiplied by level
export const SOFT_DROP_POINTS = 1; // per row
export const HARD_DROP_POINTS = 2; // per cell dropped
export const LINES_PER_LEVEL = 10;
export const KICKS = [0, -1, 1, -2, 2]; // tried in this order on rotation
export const POWERUP_EVERY = 5; // lines
export const POWERUP_POINTS = 50; // multiplied by level
export const FREEZE_SECONDS = 5;
export const MAX_SCORE = 9_999_999; // database check on `scores.score`

// Block values: 1..7 are pieces, 8 is unused (the dropped N piece), 9 is wild, 10..14 are power-ups.
export const WILD = 9;
export const POWERUP_BASE = 10;

/** Power-up pieces in board-value order: `POWERUP_BASE + index`. */
export const POWERUPS: readonly { name: PowerupName; icon: string }[] = [
  { name: "bomb", icon: "💣" },
  { name: "lightning", icon: "⚡" },
  { name: "tint", icon: "🎨" },
  { name: "gravity", icon: "⬇️" },
  { name: "freeze", icon: "❄️" },
];

// Logical field (the canvas backing store is scaled by devicePixelRatio).
export const W = 800;
export const H = 600;
export const BLOCK = 28;
export const BOARD_X = 260;
export const BOARD_Y = 20;
export const NEXT_X = 580;
export const NEXT_Y = 20;
export const NEXT_CELLS = 4;

/** Gravity interval in seconds for a level. */
export function dropInterval(level: number): number {
  return Math.max(0.1, 1 - (level - 1) * 0.09);
}

/**
 * Neon palette, indexed by board value (0 is empty). It mirrors the
 * `app/globals.css` tokens (`--cyan`, `--yellow`, `--green`, `--magenta`,
 * `--ink`) and the `cover-tetro` colours.
 */
export const PALETTE: readonly (string | null)[] = [
  null,
  "#00f5ff", // 1 I: --cyan
  "#f5ff00", // 2 O: --yellow
  "#aa00ff", // 3 T: purple (cover-tetro)
  "#00ff88", // 4 S: --green
  "#ff006e", // 5 Z: --magenta
  "#2979ff", // 6 J: blue
  "#ff7700", // 7 L: orange (cover-tetro)
  null, // 8 unused
  "#ffffff", // 9 wild
  "#ff6d00", // 10 bomb
  "#ffea00", // 11 lightning
  "#ff4081", // 12 tint
  "#bcaaa4", // 13 gravity
  "#40c4ff", // 14 freeze
];

export const GRID_COLOR = "rgba(0, 245, 255, 0.08)";
