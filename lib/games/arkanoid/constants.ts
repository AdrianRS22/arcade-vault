import type { BrickColor } from "./types";

// Logical field (the canvas backing store is scaled by devicePixelRatio).
export const W = 800;
export const H = 600;
export const PADDLE = { w: 120, h: 16, y: 560, speed: 600 }; // px, px/s
export const BALL = { size: 16, speed: 360 }; // px, px/s (base speed)
export const BRICKS = { cols: 10, w: 64, h: 32, gap: 4, top: 80 }; // wall left = 62
export const START_LIVES = 3;
export const SERVE_DELAY = 1; // s, ball rests on the paddle, then launches at 45° up-right
export const LEVEL_INTRO = 1.5; // s, everything frozen, "LEVEL N" banner
export const EXPLOSION_FRAME = 0.15; // s per frame, 4 frames
export const MAX_DT = 0.05; // s (the reference used 1/30; the platform contract wins)
export const MAX_STEP = 8; // px, ball movement per sub-step (anti-tunnelling)

export const BRICK_POINTS: Record<BrickColor, number> = {
  red: 70,
  yellow: 60,
  cyan: 50,
  magenta: 40,
  hotpink: 30,
  green: 20,
};
export const LEVEL_CLEAR_BONUS = 1_000; // multiplied by the level just cleared
export const SPEED_STEP = 0.1; // +10% ball speed per full loop of the 3 layouts
export const MAX_SPEED_FACTOR = 2; // 720 px/s
// speedFactor(level) = min(MAX_SPEED_FACTOR, 1 + SPEED_STEP * floor((level - 1) / LEVELS.length))
export const MAX_SCORE = 9_999_999; // database check on `scores.score`
