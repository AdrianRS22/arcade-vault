import { createInput } from "../shared/input";
import { DEFAULT_SKIN, SKIN_IDS, type SkinId } from "../shared/skins";
import type { GameEngine, GameOptions } from "../types";
import {
  BASE_SPEED,
  BONUS_BLINK,
  BONUS_CHANCE,
  BONUS_LIFETIME,
  BONUS_POINTS,
  CELL,
  COLS,
  FRUIT_POINTS,
  FRUITS_PER_LEVEL,
  H,
  MAX_DT,
  MAX_SCORE,
  MAX_SPEED,
  ROWS,
  SPEED_PER_LEVEL,
  START_LENGTH,
  TURN_QUEUE,
  W,
} from "./constants";
import { SKINS } from "./skins";
import { buildSheet, drawFruit, FRUIT_SPRITES, loadImage } from "./sprites";
import type {
  Bonus,
  Cell,
  Dir,
  Fruit,
  SnakeCallbacks,
  SnakeSnapshot,
  SnakeState,
} from "./types";

export type World = {
  snake: Cell[]; // head first
  dir: Dir; // direction of the last step
  queue: Dir[]; // pending turns, at most TURN_QUEUE
  fruit: Fruit;
  bonus: Bonus | null;
  fruitsEaten: number; // normal fruits only, drives the level
  score: number;
  state: SnakeState;
  accumulator: number; // seconds not yet spent on a step
  rng: () => number;
};

const DELTA: Record<Dir, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Dir, Dir> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

export function levelOf(fruitsEaten: number): number {
  return 1 + Math.floor(fruitsEaten / FRUITS_PER_LEVEL);
}

/** Steps per second. */
export function speedOf(level: number): number {
  return Math.min(MAX_SPEED, BASE_SPEED + SPEED_PER_LEVEL * (level - 1));
}

export function snapshotOf(world: World): SnakeSnapshot {
  return {
    score: world.score,
    length: world.snake.length,
    level: levelOf(world.fruitsEaten),
    bonusSeconds: world.bonus ? Math.ceil(world.bonus.remaining) : 0,
    state: world.state,
  };
}

function addScore(world: World, points: number): void {
  world.score = Math.min(MAX_SCORE, world.score + points);
}

function sameCell(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y;
}

/** Random cell not covered by the snake, the fruit or the bonus; null if none. */
function pickFreeCell(world: World): Cell | null {
  const taken = new Set<number>();
  const key = (c: Cell) => c.y * COLS + c.x;
  for (const c of world.snake) taken.add(key(c));
  taken.add(key(world.fruit.cell));
  if (world.bonus) taken.add(key(world.bonus.cell));

  const free: Cell[] = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (!taken.has(y * COLS + x)) free.push({ x, y });
    }
  }
  if (free.length === 0) return null;
  return free[Math.floor(world.rng() * free.length)];
}

/** Random sprite index, different from `avoid` when given. */
function pickSprite(rng: () => number, avoid?: number): number {
  const count = FRUIT_SPRITES.length;
  if (avoid === undefined) return Math.floor(rng() * count);
  const index = Math.floor(rng() * (count - 1));
  return index >= avoid ? index + 1 : index;
}

/** Places a new normal fruit; false when the board is full. */
function spawnFruit(world: World): boolean {
  const cell = pickFreeCell(world);
  if (!cell) return false;
  world.fruit = { cell, sprite: pickSprite(world.rng, world.fruit.sprite) };
  return true;
}

function spawnBonus(world: World): void {
  const cell = pickFreeCell(world);
  if (!cell) return;
  world.bonus = {
    cell,
    sprite: pickSprite(world.rng, world.fruit.sprite),
    remaining: BONUS_LIFETIME,
  };
}

function startingSnake(): Cell[] {
  const hx = Math.floor(COLS / 2);
  const hy = Math.floor(ROWS / 2);
  return Array.from({ length: START_LENGTH }, (_, i) => ({ x: hx - i, y: hy }));
}

export function createWorld(rng: () => number = Math.random): World {
  const world: World = {
    snake: startingSnake(),
    dir: "right",
    queue: [],
    // Placeholder, replaced right below once the snake exists.
    fruit: { cell: { x: 0, y: 0 }, sprite: 0 },
    bonus: null,
    fruitsEaten: 0,
    score: 0,
    state: "waiting",
    accumulator: 0,
    rng,
  };
  const cell = pickFreeCell(world);
  world.fruit = { cell: cell ?? { x: 0, y: 0 }, sprite: pickSprite(rng) };
  return world;
}

export function resetWorld(world: World): void {
  Object.assign(world, createWorld(world.rng));
}

/**
 * Registers a direction key press.
 * - `waiting`: the first valid press starts the run (the opposite of the
 *   starting direction is ignored and does not start it).
 * - `playing`: queues the turn; presses equal or opposite to the direction they
 *   follow, or beyond TURN_QUEUE pending turns, are dropped.
 */
export function queueTurn(world: World, dir: Dir): void {
  if (world.state === "waiting") {
    if (dir === OPPOSITE[world.dir]) return;
    world.state = "playing";
    if (dir !== world.dir) world.queue.push(dir);
    return;
  }
  if (world.state !== "playing") return;
  if (world.queue.length >= TURN_QUEUE) return;
  const last = world.queue[world.queue.length - 1] ?? world.dir;
  if (dir === last || dir === OPPOSITE[last]) return;
  world.queue.push(dir);
}

/** Moves the snake one cell: turn, collisions, eating, growth, spawns. */
export function stepSnake(world: World): void {
  const turn = world.queue.shift();
  if (turn) world.dir = turn;

  const delta = DELTA[world.dir];
  const head = world.snake[0];
  const next: Cell = { x: head.x + delta.x, y: head.y + delta.y };

  const eatsFruit = sameCell(next, world.fruit.cell);
  const eatsBonus = world.bonus !== null && sameCell(next, world.bonus.cell);
  const grows = eatsFruit || eatsBonus;

  const outside = next.x < 0 || next.x >= COLS || next.y < 0 || next.y >= ROWS;
  // The tail moves away in this same step unless the snake grows.
  const body = grows ? world.snake : world.snake.slice(0, -1);
  if (outside || body.some((c) => sameCell(c, next))) {
    world.state = "gameover";
    return;
  }

  world.snake.unshift(next);
  if (!grows) world.snake.pop();

  const level = levelOf(world.fruitsEaten);
  if (eatsBonus) {
    addScore(world, BONUS_POINTS * level);
    world.bonus = null;
    return;
  }
  if (eatsFruit) {
    addScore(world, FRUIT_POINTS * level);
    world.fruitsEaten += 1;
    if (!spawnFruit(world)) {
      world.state = "gameover"; // board full
      return;
    }
    if (world.bonus === null && world.rng() < BONUS_CHANCE) spawnBonus(world);
  }
}

/** Counts the bonus down; it disappears when it runs out. */
export function updateBonus(world: World, dt: number): void {
  if (!world.bonus) return;
  world.bonus.remaining -= dt;
  if (world.bonus.remaining <= 0) world.bonus = null;
}

/** Advances the world by `dt` seconds (capped at MAX_DT), one grid step at a time. */
export function update(world: World, dt: number): void {
  if (world.state !== "playing") return;
  const clamped = Math.min(dt, MAX_DT);
  updateBonus(world, clamped);

  world.accumulator += clamped;
  while (world.state === "playing") {
    const interval = 1 / speedOf(levelOf(world.fruitsEaten));
    if (world.accumulator < interval) break;
    world.accumulator -= interval;
    stepSnake(world);
  }
}

// ── Engine ────────────────────────────────────────────────────────────────────
const FRUITS_URL = "/games/snake/fruits.png";
const GAME_KEYS = [
  "Space",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
] as const;
const BANNER_FONT = 'bold 32px "Press Start 2P", ui-monospace, monospace';

/** Key codes per direction, in the order they are polled each frame. */
const TURN_KEYS: readonly { dir: Dir; codes: readonly string[] }[] = [
  { dir: "up", codes: ["ArrowUp", "KeyW"] },
  { dir: "down", codes: ["ArrowDown", "KeyS"] },
  { dir: "left", codes: ["ArrowLeft", "KeyA"] },
  { dir: "right", codes: ["ArrowRight", "KeyD"] },
];

export function createSnakeGame(
  canvas: HTMLCanvasElement,
  callbacks: SnakeCallbacks,
  options?: GameOptions,
): GameEngine {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context is not available");

  // Logical field is W×H; the backing store follows devicePixelRatio.
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;

  const input = createInput({ preventDefault: GAME_KEYS });
  const world = createWorld();

  let skin = SKINS[options?.skin ?? DEFAULT_SKIN];
  let fruitImg: HTMLImageElement | null = null;
  let fruits: CanvasImageSource | null = null; // sheet tinted for the active skin
  let gameOverSent = false;
  let running = false;
  let paused = false;
  let destroyed = false;
  let rafId = 0;
  let lastTime: number | null = null;

  // ── Snapshot (React-facing) ─────────────────────────────────────────────────
  let lastSnap: SnakeSnapshot | null = null;

  function emit() {
    const snap = snapshotOf(world);
    if (
      lastSnap &&
      lastSnap.score === snap.score &&
      lastSnap.length === snap.length &&
      lastSnap.level === snap.level &&
      lastSnap.bonusSeconds === snap.bonusSeconds &&
      lastSnap.state === snap.state
    )
      return;
    lastSnap = snap;
    callbacks.onChange(snap);
  }

  // ── Draw ────────────────────────────────────────────────────────────────────
  function draw() {
    if (!ctx || !fruits) return;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = skin.bg;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = skin.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 1; x < COLS; x++) {
      ctx.moveTo(x * CELL + 0.5, 0);
      ctx.lineTo(x * CELL + 0.5, H);
    }
    for (let y = 1; y < ROWS; y++) {
      ctx.moveTo(0, y * CELL + 0.5);
      ctx.lineTo(W, y * CELL + 0.5);
    }
    ctx.stroke();

    const fg = skin.fruitGlow;
    drawFruit(ctx, fruits, world.fruit.sprite, world.fruit.cell, fg);
    if (world.bonus) {
      const blinking = world.bonus.remaining <= BONUS_BLINK;
      if (!blinking || Math.floor(world.bonus.remaining * 8) % 2 === 0) {
        drawFruit(ctx, fruits, world.bonus.sprite, world.bonus.cell, fg);
      }
    }

    // Body first, then the head with the glow (glow only on the head).
    const inset = 3;
    const bodySize = CELL - inset * 2;
    for (let i = world.snake.length - 1; i >= 1; i--) {
      const c = world.snake[i];
      const bx = c.x * CELL + inset;
      const by = c.y * CELL + inset;
      if (skin.style === "neon") {
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = skin.body;
        ctx.fillRect(bx, by, bodySize, bodySize);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = skin.body;
        ctx.lineWidth = 2;
        ctx.strokeRect(bx + 1, by + 1, bodySize - 2, bodySize - 2);
      } else {
        ctx.fillStyle = skin.body;
        ctx.fillRect(bx, by, bodySize, bodySize);
        if (skin.style === "retro") {
          ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
          ctx.fillRect(bx, by, bodySize, 4);
        }
      }
    }
    const head = world.snake[0];
    const hx = head.x * CELL + 1;
    const hy = head.y * CELL + 1;
    const headSize = CELL - 2;
    if (skin.style === "retro") {
      ctx.fillStyle = skin.head;
      ctx.fillRect(hx, hy, headSize, headSize);
      ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
      ctx.fillRect(hx, hy, headSize, 5);
    } else {
      ctx.shadowColor = skin.glow;
      ctx.shadowBlur = 12;
      if (skin.style === "neon") {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = skin.head;
        ctx.fillRect(hx, hy, headSize, headSize);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = skin.head;
        ctx.lineWidth = 2;
        ctx.strokeRect(hx + 1, hy + 1, headSize - 2, headSize - 2);
      } else {
        ctx.fillStyle = skin.head;
        ctx.fillRect(hx, hy, headSize, headSize);
      }
      ctx.shadowBlur = 0;
    }

    if (skin.scanlines) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
      for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 2);
    }

    if (world.state === "waiting") {
      ctx.font = BANNER_FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = skin.banner;
      if (skin.style !== "retro") {
        ctx.shadowColor = skin.banner;
        ctx.shadowBlur = 16;
      }
      ctx.fillText("PRESS AN ARROW", W / 2, H * 0.72);
      ctx.shadowBlur = 0;
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
  function readTurns() {
    for (const { dir, codes } of TURN_KEYS) {
      // Poll every code so each one-shot press is consumed.
      let pressed = false;
      for (const code of codes) if (input.pressed(code)) pressed = true;
      if (pressed) queueTurn(world, dir);
    }
  }

  function loop(ts: number) {
    if (!running) return;
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, MAX_DT);
    lastTime = ts;
    readTurns();
    update(world, dt);
    if (world.state === "gameover") {
      settle();
      return;
    }
    draw();
    emit();
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (running || destroyed || paused || !fruits) return;
    running = true;
    lastTime = null; // no dt jump after a pause or restart
    rafId = requestAnimationFrame(loop);
  }

  // The loop starts only after the image loads; on failure nothing is drawn
  // and `onGameOver` is never called.
  loadImage(FRUITS_URL).then(
    (img) => {
      if (destroyed) return;
      fruitImg = img;
      fruits = buildSheet(img, skin.fruitTint);
      input.reset(); // ignore keys pressed while the image was loading
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
      if (fruitImg) fruits = buildSheet(fruitImg, skin.fruitTint);
      draw(); // redraw now, also while paused
    },
    pause() {
      if (destroyed || paused || world.state === "gameover") return;
      paused = true;
      stop();
    },
    resume() {
      if (destroyed || !paused) return;
      paused = false;
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
      input.detach();
    },
  };
}
