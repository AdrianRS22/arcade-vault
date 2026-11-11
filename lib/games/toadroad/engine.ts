import {
  ATTEMPT_TIME,
  CELL,
  CLEAR_DURATION,
  CLEAR_POINTS,
  DEATH_DURATION,
  FROG_SIZE,
  GOAL_ROW,
  LIVES,
  MAX_SCORE,
  ROW_POINTS,
  SLOT_CENTERS,
  SLOT_COUNT,
  SLOT_HALF_WIDTH,
  SLOT_POINTS,
  START_ROW,
  START_X,
  TIME_POINTS,
  W,
  X_MAX,
  X_MIN,
} from "./constants";
import {
  LANES,
  loopLength,
  objectLeft,
  platformAt,
  snapToCell,
  wrap,
} from "./lanes";
import type { DeathCause, ToadRoadSnapshot, ToadRoadState } from "./types";

export type HopDir = "up" | "down" | "left" | "right";

/** alive: playing; dying: splat/splash animation; clearing: round-clear flash. */
export type Phase = "alive" | "dying" | "clearing";

export type World = {
  offsets: number[]; // one per lane, same order as LANES
  frogX: number; // px, center, continuous
  frogRow: number;
  bestRow: number; // smallest row reached in this attempt
  time: number; // seconds left in this attempt
  phase: Phase;
  phaseTimer: number; // seconds left of the dying / clearing phase
  cause: DeathCause | null; // set while dying
  slots: boolean[]; // goal slots filled
  score: number;
  lives: number;
  state: ToadRoadState;
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export function createWorld(): World {
  return {
    offsets: LANES.map(() => 0),
    frogX: START_X,
    frogRow: START_ROW,
    bestRow: START_ROW,
    time: ATTEMPT_TIME,
    phase: "alive",
    phaseTimer: 0,
    cause: null,
    slots: Array.from({ length: SLOT_COUNT }, () => false),
    score: 0,
    lives: LIVES,
    state: "playing",
  };
}

/** Frog back at the start, timer full. Lanes and slots are left untouched. */
export function newAttempt(w: World): void {
  w.frogX = START_X;
  w.frogRow = START_ROW;
  w.bestRow = START_ROW;
  w.time = ATTEMPT_TIME;
  w.phase = "alive";
  w.phaseTimer = 0;
  w.cause = null;
}

export function homeCount(w: World): number {
  return w.slots.filter(Boolean).length;
}

export function snapshot(w: World): ToadRoadSnapshot {
  return {
    score: w.score,
    lives: w.lives,
    home: homeCount(w),
    time: Math.max(0, Math.ceil(w.time)),
    state: w.state,
  };
}

export function addScore(w: World, points: number): void {
  w.score = Math.min(MAX_SCORE, w.score + points);
}

/** Forces game over with the current score (END button). */
export function forceGameOver(w: World): void {
  w.state = "gameover";
}

// ---------------------------------------------------------------------------
// Lanes
// ---------------------------------------------------------------------------

/** Moves every lane. Offsets are reduced modulo the loop length (no drift). */
export function advanceLanes(w: World, dt: number): void {
  for (let i = 0; i < LANES.length; i++) {
    const lane = LANES[i];
    if (lane.object === null) continue;
    w.offsets[i] = wrap(
      w.offsets[i] + lane.dir * lane.speed * dt,
      loopLength(lane),
    );
  }
}

// ---------------------------------------------------------------------------
// Hazards
// ---------------------------------------------------------------------------

/** True if the frog hitbox overlaps a car or truck of its (road) row. */
export function hitsVehicle(w: World): boolean {
  const lane = LANES[w.frogRow];
  if (lane.kind !== "road") return false;
  const half = FROG_SIZE / 2;
  for (let i = 0; i < lane.count; i++) {
    const left = objectLeft(lane, w.offsets[w.frogRow], i);
    if (w.frogX + half > left && w.frogX - half < left + lane.width) {
      return true;
    }
  }
  return false;
}

/** True if the frog center is over a log or turtles of its (river) row. */
export function isSupported(w: World): boolean {
  const lane = LANES[w.frogRow];
  return platformAt(lane, w.offsets[w.frogRow], w.frogX) >= 0;
}

/** Static hazard at the frog's position (no movement): run-over or drowned. */
function hazardAt(w: World): DeathCause | null {
  const kind = LANES[w.frogRow].kind;
  if (kind === "road" && hitsVehicle(w)) return "run-over";
  if (kind === "river" && !isSupported(w)) return "drowned";
  return null;
}

// ---------------------------------------------------------------------------
// Death, goal and round clear
// ---------------------------------------------------------------------------

/** Loses a life at once (HUD updates) and starts the death animation. */
export function kill(w: World, cause: DeathCause): void {
  if (w.phase !== "alive") return;
  w.lives -= 1;
  w.phase = "dying";
  w.phaseTimer = DEATH_DURATION;
  w.cause = cause;
}

/** Slot index the frog is aiming at, or -1 if it is between slots. */
export function slotAt(x: number): number {
  for (let i = 0; i < SLOT_CENTERS.length; i++) {
    if (Math.abs(x - SLOT_CENTERS[i]) <= SLOT_HALF_WIDTH) return i;
  }
  return -1;
}

/** Resolves the frog reaching GOAL_ROW: fill an empty slot or die (bushed). */
function resolveGoal(w: World): void {
  const slot = slotAt(w.frogX);
  if (slot < 0 || w.slots[slot]) {
    kill(w, "bushed");
    return;
  }
  w.slots[slot] = true;
  addScore(w, SLOT_POINTS + TIME_POINTS * Math.ceil(w.time));
  if (homeCount(w) === SLOT_COUNT) {
    addScore(w, CLEAR_POINTS);
    w.phase = "clearing";
    w.phaseTimer = CLEAR_DURATION;
    return;
  }
  newAttempt(w);
}

// ---------------------------------------------------------------------------
// Hop
// ---------------------------------------------------------------------------

/**
 * Applies one hop of one cell. Blocked hops do nothing. The logic is instant;
 * the landing is checked at once (run-over, drowned, goal) and, on a safe row,
 * x snaps to a cell center. A new best row (not the goal row) scores ROW_POINTS
 * if the frog survives the landing.
 */
export function hop(w: World, dir: HopDir): void {
  if (w.phase !== "alive") return;

  let row = w.frogRow;
  let x = w.frogX;
  if (dir === "up") row -= 1;
  else if (dir === "down") row += 1;
  else if (dir === "left") x -= CELL;
  else x += CELL;

  if (row < GOAL_ROW || row > START_ROW) return;
  if (x < X_MIN || x > X_MAX) return;

  w.frogRow = row;
  w.frogX = LANES[row].kind === "safe" ? snapToCell(x) : x;

  if (row === GOAL_ROW) {
    resolveGoal(w);
    return;
  }

  const hazard = hazardAt(w);
  if (hazard !== null) {
    kill(w, hazard);
    return;
  }

  if (row < w.bestRow) {
    w.bestRow = row;
    addScore(w, ROW_POINTS);
  }
}

// ---------------------------------------------------------------------------
// Frame step
// ---------------------------------------------------------------------------

/**
 * Advances the world by `dt` seconds (already capped by the loop). `hopDir` is
 * the single hop chosen for this frame, or null. Input is ignored unless the
 * frog is alive.
 */
export function step(w: World, dt: number, hopDir: HopDir | null): void {
  if (w.state === "gameover") return;

  advanceLanes(w, dt);

  if (w.phase === "dying") {
    w.phaseTimer -= dt;
    if (w.phaseTimer <= 0) {
      if (w.lives > 0) newAttempt(w);
      else w.state = "gameover";
    }
    return;
  }

  if (w.phase === "clearing") {
    w.phaseTimer -= dt;
    if (w.phaseTimer <= 0) {
      w.slots.fill(false);
      newAttempt(w);
    }
    return;
  }

  if (hopDir !== null) hop(w, hopDir);
  if (w.phase !== "alive") return;

  const hazard = hazardAt(w);
  if (hazard !== null) {
    kill(w, hazard);
    return;
  }

  // Ride the platform under the frog.
  const lane = LANES[w.frogRow];
  if (lane.kind === "river") {
    w.frogX += lane.dir * lane.speed * dt;
    if (w.frogX < 0 || w.frogX > W) {
      kill(w, "swept");
      return;
    }
  }

  w.time -= dt;
  if (w.time <= 0) {
    w.time = 0;
    kill(w, "time");
  }
}
