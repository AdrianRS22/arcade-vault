import {
  BASE_SPEED,
  BONUS_CHANCE,
  BONUS_LIFETIME,
  BONUS_POINTS,
  COLS,
  FRUIT_POINTS,
  FRUITS_PER_LEVEL,
  MAX_DT,
  MAX_SCORE,
  MAX_SPEED,
  ROWS,
  SPEED_PER_LEVEL,
  START_LENGTH,
  TURN_QUEUE,
} from "./constants";
import { FRUIT_SPRITES } from "./sprites";
import type {
  Bonus,
  Cell,
  Dir,
  Fruit,
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
