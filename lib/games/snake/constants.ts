// Logical field (the canvas backing store is scaled by devicePixelRatio).
export const CELL = 40; // px
export const COLS = 20;
export const ROWS = 15;
export const W = COLS * CELL; // 800
export const H = ROWS * CELL; // 600
export const START_LENGTH = 3; // centered, facing right

export const BASE_SPEED = 8; // steps per second at level 1
export const SPEED_PER_LEVEL = 1; // +1 step/s per level
export const MAX_SPEED = 20; // steps per second
export const FRUITS_PER_LEVEL = 5;
// level = 1 + floor(fruitsEaten / FRUITS_PER_LEVEL)
// speed = min(MAX_SPEED, BASE_SPEED + SPEED_PER_LEVEL * (level - 1))

export const FRUIT_POINTS = 10; // × level when eaten
export const BONUS_POINTS = 50; // × level when eaten
export const BONUS_CHANCE = 0.15; // rolled once per normal fruit eaten
export const BONUS_LIFETIME = 5; // s
export const BONUS_BLINK = 1.5; // s, the bonus blinks during its last 1.5 s

export const TURN_QUEUE = 2; // max queued turns
export const MAX_DT = 0.05; // s
export const MAX_SCORE = 9_999_999; // database check on `scores.score`
