import {
  BALL,
  BRICK_POINTS,
  BRICKS,
  EXPLOSION_FRAME,
  H,
  LEVEL_CLEAR_BONUS,
  LEVEL_INTRO,
  MAX_SCORE,
  MAX_SPEED_FACTOR,
  MAX_STEP,
  PADDLE,
  SERVE_DELAY,
  SPEED_STEP,
  START_LIVES,
  W,
} from "./constants";
import { BRICK_COLORS, LEVELS } from "./levels";
import { EXPLOSION_FRAMES } from "./sprites";
import type {
  ArkanoidSnapshot,
  ArkanoidState,
  Brick,
  Explosion,
} from "./types";

export type Ball = { x: number; y: number; vx: number; vy: number };

export type ArkanoidInput = {
  left: boolean;
  right: boolean;
  /** Logical x of the pointer, or null while the keyboard has priority. */
  mouseX: number | null;
};

export type World = {
  state: ArkanoidState;
  score: number;
  lives: number;
  level: number; // 1-based; layout = (level - 1) % LEVELS.length
  levelIntro: number; // s left of the "LEVEL N" freeze
  serveTimer: number; // s left with the ball resting on the paddle
  paddleX: number;
  ball: Ball;
  bricks: Brick[];
  explosions: Explosion[];
  input: ArkanoidInput;
};

/** Side effects of a step that the loop turns into sounds. */
export type StepHooks = {
  onBounce: () => void;
  onBreak: () => void;
};

export function speedFactor(level: number): number {
  return Math.min(
    MAX_SPEED_FACTOR,
    1 + SPEED_STEP * Math.floor((level - 1) / LEVELS.length),
  );
}

export function ballSpeed(level: number): number {
  return BALL.speed * speedFactor(level);
}

export function createBricks(layout: number): Brick[] {
  const totalW = BRICKS.cols * BRICKS.w + (BRICKS.cols - 1) * BRICKS.gap;
  const left = (W - totalW) / 2; // 62
  const rows = LEVELS[layout];
  const bricks: Brick[] = [];
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < BRICKS.cols; c++) {
      const color = BRICK_COLORS[rows[r][c]];
      if (!color) continue; // '.' or unknown character: gap
      bricks.push({
        x: left + c * (BRICKS.w + BRICKS.gap),
        y: BRICKS.top + r * (BRICKS.h + BRICKS.gap),
        color,
        alive: true,
      });
    }
  }
  return bricks;
}

export function snapshotOf(world: World): ArkanoidSnapshot {
  return {
    score: world.score,
    lives: world.lives,
    level: world.level,
    state: world.state,
  };
}

function resetBallOnPaddle(world: World): void {
  const { ball } = world;
  ball.x = world.paddleX + (PADDLE.w - BALL.size) / 2;
  ball.y = PADDLE.y - BALL.size;
  ball.vx = 0;
  ball.vy = 0;
}

function startServe(world: World): void {
  world.serveTimer = SERVE_DELAY;
  resetBallOnPaddle(world);
}

function launchBall(world: World): void {
  const v = ballSpeed(world.level) * Math.SQRT1_2; // 45° up-right
  world.ball.vx = v;
  world.ball.vy = -v;
}

function addScore(world: World, points: number): void {
  world.score = Math.min(MAX_SCORE, world.score + points);
}

/** Loads the layout for `level`: bricks, centered paddle, intro freeze, serve. */
export function loadLevel(world: World, level: number): void {
  world.level = level;
  world.bricks = createBricks((level - 1) % LEVELS.length);
  world.explosions = [];
  world.paddleX = (W - PADDLE.w) / 2;
  world.levelIntro = LEVEL_INTRO;
  startServe(world);
}

export function createWorld(): World {
  const world: World = {
    state: "playing",
    score: 0,
    lives: START_LIVES,
    level: 1,
    levelIntro: 0,
    serveTimer: 0,
    paddleX: (W - PADDLE.w) / 2,
    ball: { x: 0, y: 0, vx: 0, vy: 0 },
    bricks: [],
    explosions: [],
    input: { left: false, right: false, mouseX: null },
  };
  loadLevel(world, 1);
  return world;
}

/** Fresh run, keeping the same input object so listeners stay valid. */
export function resetWorld(world: World): void {
  world.state = "playing";
  world.score = 0;
  world.lives = START_LIVES;
  world.input.left = false;
  world.input.right = false;
  world.input.mouseX = null;
  loadLevel(world, 1);
}

export function updatePaddle(world: World, dt: number): void {
  const { input } = world;
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir !== 0) {
    world.paddleX += dir * PADDLE.speed * dt;
    input.mouseX = null; // the keyboard wins until the mouse moves again
  } else if (input.mouseX !== null) {
    world.paddleX = input.mouseX - PADDLE.w / 2;
  }
  world.paddleX = Math.max(0, Math.min(W - PADDLE.w, world.paddleX));
}

/** Moves the ball one sub-step. Returns false when the ball was lost. */
function stepBall(world: World, dt: number, hooks: StepHooks): boolean {
  const { ball } = world;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  // Side walls
  if (ball.x < 0) {
    ball.x = 0;
    ball.vx = Math.abs(ball.vx);
  } else if (ball.x + BALL.size > W) {
    ball.x = W - BALL.size;
    ball.vx = -Math.abs(ball.vx);
  }

  // Ceiling
  if (ball.y < 0) {
    ball.y = 0;
    ball.vy = Math.abs(ball.vy);
  }

  // Paddle (flat reflection), only for a falling ball
  if (
    ball.vy > 0 &&
    ball.x + BALL.size > world.paddleX &&
    ball.x < world.paddleX + PADDLE.w &&
    ball.y + BALL.size > PADDLE.y &&
    ball.y < PADDLE.y + PADDLE.h
  ) {
    ball.y = PADDLE.y - BALL.size;
    ball.vy = -Math.abs(ball.vy);
    hooks.onBounce();
  }

  // Bricks (AABB): at most one per sub-step
  for (const b of world.bricks) {
    if (!b.alive) continue;
    const overlapX = Math.min(
      ball.x + BALL.size - b.x,
      b.x + BRICKS.w - ball.x,
    );
    const overlapY = Math.min(
      ball.y + BALL.size - b.y,
      b.y + BRICKS.h - ball.y,
    );
    if (overlapX <= 0 || overlapY <= 0) continue;

    b.alive = false;
    world.explosions.push({ x: b.x, y: b.y, color: b.color, t: 0 });
    addScore(world, BRICK_POINTS[b.color]);
    hooks.onBreak();

    const ballCx = ball.x + BALL.size / 2;
    const ballCy = ball.y + BALL.size / 2;
    const brickCx = b.x + BRICKS.w / 2;
    const brickCy = b.y + BRICKS.h / 2;
    if (overlapX < overlapY) {
      const dir = ballCx < brickCx ? -1 : 1;
      ball.x += dir * overlapX;
      ball.vx = dir * Math.abs(ball.vx);
    } else {
      const dir = ballCy < brickCy ? -1 : 1;
      ball.y += dir * overlapY;
      ball.vy = dir * Math.abs(ball.vy);
    }
    break;
  }

  // Fell below the field: lose a life, back to the serve (or game over)
  if (ball.y > H) {
    world.lives = Math.max(0, world.lives - 1);
    if (world.lives === 0) world.state = "gameover";
    else startServe(world);
    return false;
  }
  return true;
}

export function updateBall(world: World, dt: number, hooks: StepHooks): void {
  const { ball } = world;

  // Serve: the ball rests on the paddle until the timer ends
  if (world.serveTimer > 0) {
    resetBallOnPaddle(world);
    world.serveTimer -= dt;
    if (world.serveTimer <= 0) {
      world.serveTimer = 0;
      launchBall(world);
    }
    return;
  }

  // Sub-steps of at most MAX_STEP px so a fast ball cannot tunnel
  const speed = Math.hypot(ball.vx, ball.vy);
  const steps = Math.max(1, Math.ceil((speed * dt) / MAX_STEP));
  const subDt = dt / steps;
  for (let i = 0; i < steps; i++) {
    if (!stepBall(world, subDt, hooks)) return;
  }
}

export function updateExplosions(world: World, dt: number): void {
  for (const e of world.explosions) e.t += dt;
  world.explosions = world.explosions.filter(
    (e) => Math.floor(e.t / EXPLOSION_FRAME) < EXPLOSION_FRAMES[e.color].length,
  );
}

export function update(world: World, dt: number, hooks: StepHooks): void {
  if (world.state !== "playing") return;

  // "LEVEL N" banner: everything frozen
  if (world.levelIntro > 0) {
    world.levelIntro = Math.max(0, world.levelIntro - dt);
    return;
  }

  // Layout cleared: ball and paddle frozen until the explosions finish
  if (world.bricks.every((b) => !b.alive)) {
    updateExplosions(world, dt);
    if (world.explosions.length === 0) {
      addScore(world, LEVEL_CLEAR_BONUS * world.level);
      loadLevel(world, world.level + 1);
    }
    return;
  }

  updatePaddle(world, dt);
  updateBall(world, dt, hooks);
  updateExplosions(world, dt);
}
