import { createSoundBank } from "../shared/audio";
import { createInput } from "../shared/input";
import { DEFAULT_SKIN, SKIN_IDS, type SkinId } from "../shared/skins";
import type { GameEngine, GameOptions } from "../types";
import { SKINS, type ArkanoidSkin } from "./skins";
import {
  BALL,
  BRICK_POINTS,
  BRICKS,
  EXPLOSION_FRAME,
  H,
  LEVEL_CLEAR_BONUS,
  LEVEL_INTRO,
  MAX_DT,
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
import {
  drawFrame,
  drawSprite,
  EXPLOSION_FRAMES,
  loadSpritesheet,
} from "./sprites";
import type {
  ArkanoidCallbacks,
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

// ── Engine ────────────────────────────────────────────────────────────────────
const stepWorld = update;
const SPRITESHEET_URL = "/games/arkanoid/spritesheet-breakout.png";
const GAME_KEYS = ["Space", "ArrowLeft", "ArrowRight"] as const;
const BANNER_FONT = 'bold 48px "Press Start 2P", ui-monospace, monospace';

export function createArkanoidGame(
  canvas: HTMLCanvasElement,
  callbacks: ArkanoidCallbacks,
  options?: GameOptions,
): GameEngine {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context is not available");

  let skin: ArkanoidSkin = SKINS[options?.skin ?? DEFAULT_SKIN];

  // Logical field is W×H; the backing store follows devicePixelRatio.
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;

  const input = createInput({ preventDefault: GAME_KEYS });
  const world = createWorld();
  const sounds = createSoundBank({
    bounce: "/games/arkanoid/sounds/ball-bounce.mp3",
    break: "/games/arkanoid/sounds/break-sound.mp3",
  });
  const hooks: StepHooks = {
    onBounce: () => sounds.play("bounce"),
    onBreak: () => sounds.play("break"),
  };

  let sheet: HTMLImageElement | null = null;
  let gameOverSent = false;
  let running = false;
  let paused = false;
  let destroyed = false;
  let rafId = 0;
  let lastTime: number | null = null;

  // Mouse: CSS px mapped to logical px through the canvas rect.
  const onMouseMove = (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    world.input.mouseX = (e.clientX - rect.left) * (W / rect.width);
  };
  canvas.addEventListener("mousemove", onMouseMove);

  // ── Snapshot (React-facing) ─────────────────────────────────────────────────
  let lastSnap: ArkanoidSnapshot | null = null;

  function emit() {
    const snap = snapshotOf(world);
    if (
      lastSnap &&
      lastSnap.score === snap.score &&
      lastSnap.lives === snap.lives &&
      lastSnap.level === snap.level &&
      lastSnap.state === snap.state
    )
      return;
    lastSnap = snap;
    callbacks.onChange(snap);
  }

  // ── Draw ────────────────────────────────────────────────────────────────────
  function draw() {
    if (!ctx || !sheet) return;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = skin.bg;
    ctx.fillRect(0, 0, W, H);

    const sprite = skin.style === "sprite";

    for (const b of world.bricks) {
      if (!b.alive) continue;
      if (sprite)
        drawSprite(
          ctx,
          sheet,
          `block_${b.color}`,
          b.x,
          b.y,
          BRICKS.w,
          BRICKS.h,
        );
      else drawBrick(b.x, b.y, skin.bricks[b.color]);
    }

    for (const e of world.explosions) {
      const idx = Math.floor(e.t / EXPLOSION_FRAME);
      if (sprite) {
        const frame = EXPLOSION_FRAMES[e.color][idx];
        if (frame) drawFrame(ctx, sheet, frame, e.x, e.y, BRICKS.w, BRICKS.h);
      } else if (idx < EXPLOSION_FRAMES[e.color].length) {
        // Procedural burst: grows and fades over the 4 frames
        const k = e.t / (EXPLOSION_FRAME * EXPLOSION_FRAMES[e.color].length);
        const grow = 2 + 8 * k;
        ctx.globalAlpha = Math.max(0, 1 - k);
        ctx.strokeStyle = skin.bricks[e.color];
        ctx.lineWidth = 2;
        ctx.strokeRect(
          e.x - grow,
          e.y - grow,
          BRICKS.w + grow * 2,
          BRICKS.h + grow * 2,
        );
        ctx.globalAlpha = 1;
      }
    }

    // Glow only on the paddle and the ball
    ctx.shadowColor = skin.glow;
    ctx.shadowBlur = skin.style === "retro" ? 0 : 12;
    if (sprite) {
      drawSprite(
        ctx,
        sheet,
        "paddle",
        world.paddleX,
        PADDLE.y,
        PADDLE.w,
        PADDLE.h,
      );
      drawSprite(
        ctx,
        sheet,
        "ball",
        world.ball.x,
        world.ball.y,
        BALL.size,
        BALL.size,
      );
    } else {
      drawPaddleAndBall();
    }
    ctx.shadowBlur = 0;

    if (skin.scanlines) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
      for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
    }

    if (world.state === "playing" && world.levelIntro > 0) {
      ctx.fillStyle = skin.overlay;
      ctx.fillRect(0, 0, W, H);
      ctx.font = BANNER_FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = skin.banner;
      ctx.shadowColor = skin.banner;
      ctx.shadowBlur = skin.style === "retro" ? 0 : 16;
      ctx.fillText(`LEVEL ${world.level}`, W / 2, H / 2);
      ctx.shadowBlur = 0;
    }
  }

  function drawBrick(x: number, y: number, color: string) {
    if (!ctx) return;
    if (skin.style === "neon") {
      // Translucent fill plus a solid outline; no glow on the many bricks
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, BRICKS.w, BRICKS.h);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, BRICKS.w - 2, BRICKS.h - 2);
    } else {
      // Retro: flat fill with a light strip on top
      ctx.fillStyle = color;
      ctx.fillRect(x, y, BRICKS.w, BRICKS.h);
      ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
      ctx.fillRect(x, y, BRICKS.w, 4);
      ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
      ctx.fillRect(x, y + BRICKS.h - 3, BRICKS.w, 3);
    }
  }

  function drawPaddleAndBall() {
    if (!ctx) return;
    const { paddleX, ball } = world;
    if (skin.style === "neon") {
      ctx.fillStyle = "rgba(0, 245, 255, 0.3)";
      ctx.fillRect(paddleX, PADDLE.y, PADDLE.w, PADDLE.h);
      ctx.strokeStyle = skin.paddle;
      ctx.lineWidth = 2;
      ctx.strokeRect(paddleX + 1, PADDLE.y + 1, PADDLE.w - 2, PADDLE.h - 2);
      ctx.fillStyle = skin.ball;
      ctx.beginPath();
      ctx.arc(
        ball.x + BALL.size / 2,
        ball.y + BALL.size / 2,
        BALL.size / 2,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    } else {
      ctx.fillStyle = skin.paddle;
      ctx.fillRect(paddleX, PADDLE.y, PADDLE.w, PADDLE.h);
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.fillRect(paddleX, PADDLE.y, PADDLE.w, 4);
      ctx.fillStyle = skin.ball;
      ctx.fillRect(ball.x, ball.y, BALL.size, BALL.size);
    }
  }

  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
  }

  function settle() {
    if (world.state !== "gameover" || gameOverSent) return;
    gameOverSent = true;
    emit();
    draw();
    stop();
    callbacks.onGameOver(world.score);
  }

  // ── Main loop ───────────────────────────────────────────────────────────────
  function loop(ts: number) {
    if (!running) return;
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, MAX_DT);
    lastTime = ts;
    world.input.left = !!(input.keys.ArrowLeft || input.keys.KeyA);
    world.input.right = !!(input.keys.ArrowRight || input.keys.KeyD);
    stepWorld(world, dt, hooks);
    if (world.state === "gameover") {
      settle();
      return;
    }
    draw();
    emit();
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (running || destroyed || paused || !sheet) return;
    running = true;
    lastTime = null; // no dt jump after a pause or restart
    rafId = requestAnimationFrame(loop);
  }

  // The loop starts only after the spritesheet loads; on failure nothing is
  // drawn and `onGameOver` is never called.
  loadSpritesheet(SPRITESHEET_URL).then(
    (img) => {
      if (destroyed) return;
      sheet = img;
      emit();
      draw();
      start();
    },
    (err: unknown) => {
      if (!destroyed) console.error(err);
    },
  );

  // ── Public API ──────────────────────────────────────────────────────────────
  return {
    skins: SKIN_IDS,
    setSkin(id: SkinId) {
      if (destroyed) return;
      skin = SKINS[id] ?? SKINS[DEFAULT_SKIN];
      draw();
    },
    pause() {
      if (destroyed || paused || world.state === "gameover") return;
      paused = true;
      sounds.suspend();
      stop();
    },
    resume() {
      if (destroyed || !paused) return;
      paused = false;
      sounds.resume();
      input.reset();
      start();
    },
    end() {
      if (destroyed || world.state === "gameover") return;
      paused = false;
      world.state = "gameover";
      settle();
    },
    restart() {
      if (destroyed) return;
      stop();
      paused = false;
      gameOverSent = false;
      resetWorld(world);
      input.reset();
      emit();
      draw();
      start();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stop();
      sounds.destroy();
      input.detach();
      canvas.removeEventListener("mousemove", onMouseMove);
    },
  };
}
