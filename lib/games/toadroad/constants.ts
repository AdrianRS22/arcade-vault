// Logical field (the canvas backing store is scaled by devicePixelRatio).
export const CELL = 50; // px
export const COLS = 16;
export const ROWS = 12;
export const W = COLS * CELL; // 800
export const H = ROWS * CELL; // 600

export const START_ROW = 11;
export const START_X = 375; // center of column 7
export const FROG_SIZE = 34; // hitbox, px, centered in its cell
export const OBJECT_INSET = 5; // objects are CELL - 2 * OBJECT_INSET = 40 px tall
export const X_MIN = 25; // hop is blocked if the new center leaves [25, 775]
export const X_MAX = 775;

export const GOAL_ROW = 0;
export const SLOT_COUNT = 5;
export const SLOT_CENTERS = [80, 240, 400, 560, 720]; // px
export const SLOT_HALF_WIDTH = 40; // landing counts if |x - center| <= 40

export const LIVES = 3;
export const ATTEMPT_TIME = 30; // s per attempt
export const DEATH_DURATION = 0.9; // s, splat or splash animation, input ignored
export const CLEAR_DURATION = 0.6; // s, round-clear flash, input ignored

export const ROW_POINTS = 10; // per new best row in an attempt
export const SLOT_POINTS = 50; // plus TIME_POINTS × ceil(seconds left)
export const TIME_POINTS = 10;
export const CLEAR_POINTS = 1000;

export const HOP_ANIM = 0.09; // s, visual only, logic is instant
export const MAX_DT = 0.05; // s
export const MAX_SCORE = 9_999_999;

// A canvas cannot read CSS variables, so this mirrors the app/globals.css tokens.
export const PALETTE = {
  bg: "#0a0a0f", // --bg, safe rows and background
  road: "#15151f", // --bg-3, road lanes
  laneDash: "#4a4f70", // --ink-faint, dashed lane separators
  water: "#04243a", // --cyan at about 12% over --bg, river lanes
  wave: "rgba(0, 245, 255, 0.18)", // --line, wave strokes on the river
  grass: "#0b2a1c", // --green at about 15% over --bg, median and start rows
  bush: "#007a44", // --green dimmed, goal row between slots
  slot: "#00f5ff", // --cyan, slot outline
  frog: "#00ff88", // --green, glow only on the live frog
  frogEye: "#e6e9ff", // --ink
  carA: "#ff006e", // --magenta
  carB: "#f5ff00", // --yellow
  carC: "#00f5ff", // --cyan
  truck: "#d97a3a", // --bronze
  log: "#d97a3a", // --bronze, lighter stripe
  logDark: "#7a4320", // --bronze darkened, log body
  turtle: "#00ff88", // --green, shell outline
  turtleBody: "#0b5a3a", // --green darkened, shell fill
  splat: "#ff006e", // --magenta, run-over animation
  splash: "#00f5ff", // --cyan, drowning animation
} as const;
