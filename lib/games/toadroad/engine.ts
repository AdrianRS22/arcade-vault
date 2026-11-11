import { createInput } from "../shared/input";
import type { GameEngine } from "../types";
import {
  ATTEMPT_TIME,
  CELL,
  CLEAR_DURATION,
  CLEAR_POINTS,
  DEATH_DURATION,
  FROG_SIZE,
  GOAL_ROW,
  H,
  HOP_ANIM,
  LIVES,
  MAX_DT,
  MAX_SCORE,
  OBJECT_INSET,
  PALETTE,
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
import type {
  DeathCause,
  ToadRoadCallbacks,
  ToadRoadSnapshot,
  ToadRoadState,
} from "./types";

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

// ---------------------------------------------------------------------------
// Engine (loop, input, drawing)
// ---------------------------------------------------------------------------

const GAME_KEYS = ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

// Priority order when several keys are pressed in the same frame.
const HOP_KEYS: { dir: HopDir; codes: string[] }[] = [
  { dir: "up", codes: ["ArrowUp", "KeyW"] },
  { dir: "down", codes: ["ArrowDown", "KeyS"] },
  { dir: "left", codes: ["ArrowLeft", "KeyA"] },
  { dir: "right", codes: ["ArrowRight", "KeyD"] },
];

const FACING_ANGLE: Record<HopDir, number> = {
  up: 0,
  right: Math.PI / 2,
  down: Math.PI,
  left: -Math.PI / 2,
};

const CAR_COLORS: Record<number, string> = {
  7: PALETTE.carA,
  9: PALETTE.carB,
  10: PALETTE.carC,
};

function drawFrog(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: HopDir,
  scaleX: number,
  scaleY: number,
  glow: boolean,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(FACING_ANGLE[facing]);
  ctx.scale(scaleX, scaleY);
  if (glow) {
    ctx.shadowColor = PALETTE.frog;
    ctx.shadowBlur = 12;
  }
  ctx.fillStyle = PALETTE.frog;
  // Legs, then body.
  for (const [lx, ly] of [
    [-12, -8],
    [12, -8],
    [-12, 9],
    [12, 9],
  ]) {
    ctx.beginPath();
    ctx.ellipse(lx, ly, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.ellipse(0, 0, 11, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Eyes.
  ctx.fillStyle = PALETTE.frogEye;
  for (const ex of [-6, 6]) {
    ctx.beginPath();
    ctx.arc(ex, -9, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = PALETTE.bg;
  for (const ex of [-6, 6]) {
    ctx.beginPath();
    ctx.arc(ex, -10, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function createToadRoadGame(
  canvas: HTMLCanvasElement,
  callbacks: ToadRoadCallbacks,
): GameEngine {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context is not available");

  // Logical field is W×H; the backing store follows devicePixelRatio.
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const input = createInput({ preventDefault: GAME_KEYS });
  let world = createWorld();

  let facing: HopDir = "up";
  let hopAnim: { fromX: number; fromY: number; t: number } | null = null;
  let waveClock = 0; // visual only, drives the river waves
  let gameOverSent = false;
  let running = false;
  let paused = false;
  let destroyed = false;
  let rafId = 0;
  let lastTime: number | null = null;

  // ── Snapshot (React-facing) ─────────────────────────────────────────────────
  let lastSnap: ToadRoadSnapshot | null = null;

  function emit() {
    const snap = snapshot(world);
    if (
      lastSnap &&
      lastSnap.score === snap.score &&
      lastSnap.lives === snap.lives &&
      lastSnap.home === snap.home &&
      lastSnap.time === snap.time &&
      lastSnap.state === snap.state
    )
      return;
    lastSnap = snap;
    callbacks.onChange(snap);
  }

  // ── Draw ────────────────────────────────────────────────────────────────────
  function drawBands() {
    if (!ctx) return;
    for (const lane of LANES) {
      ctx.fillStyle =
        lane.kind === "river"
          ? PALETTE.water
          : lane.kind === "road"
            ? PALETTE.road
            : lane.kind === "safe"
              ? PALETTE.grass
              : PALETTE.bush;
      ctx.fillRect(0, lane.row * CELL, W, CELL);
    }

    // Goal slots cut into the bushes.
    for (const c of SLOT_CENTERS) {
      ctx.fillStyle = PALETTE.water;
      ctx.fillRect(c - SLOT_HALF_WIDTH, 0, SLOT_HALF_WIDTH * 2, CELL);
      ctx.strokeStyle = PALETTE.slot;
      ctx.lineWidth = 2;
      ctx.strokeRect(
        c - SLOT_HALF_WIDTH + 1,
        1,
        SLOT_HALF_WIDTH * 2 - 2,
        CELL - 2,
      );
    }

    // Dashed separators between consecutive road lanes.
    ctx.strokeStyle = PALETTE.laneDash;
    ctx.lineWidth = 2;
    ctx.setLineDash([20, 20]);
    ctx.beginPath();
    for (const lane of LANES) {
      if (lane.kind === "road" && LANES[lane.row - 1].kind === "road") {
        ctx.moveTo(0, lane.row * CELL);
        ctx.lineTo(W, lane.row * CELL);
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // River waves drifting with the current.
    ctx.strokeStyle = PALETTE.wave;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const lane of LANES) {
      if (lane.kind !== "river") continue;
      const shift = wrap(waveClock * lane.dir * lane.speed * 0.4, 100);
      for (const dy of [14, 36]) {
        const y = lane.row * CELL + dy;
        for (let x = shift - 100; x < W; x += 100) {
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + 12, y - 6, x + 25, y);
          ctx.quadraticCurveTo(x + 37, y + 6, x + 50, y);
        }
      }
    }
    ctx.stroke();
  }

  function drawObjects() {
    if (!ctx) return;
    for (let li = 0; li < LANES.length; li++) {
      const lane = LANES[li];
      if (lane.object === null) continue;
      const y = lane.row * CELL + OBJECT_INSET;
      const h = CELL - OBJECT_INSET * 2;
      for (let i = 0; i < lane.count; i++) {
        const left = objectLeft(lane, world.offsets[li], i);
        if (left + lane.width < 0 || left > W) continue;
        const front = lane.dir === 1 ? left + lane.width : left;

        if (lane.object === "car") {
          ctx.fillStyle = CAR_COLORS[lane.row] ?? PALETTE.carA;
          ctx.beginPath();
          ctx.roundRect(left + 2, y, lane.width - 4, h, 8);
          ctx.fill();
          ctx.fillStyle = PALETTE.bg;
          ctx.fillRect(front - lane.dir * 18 - 5, y + 6, 10, h - 12);
        } else if (lane.object === "truck") {
          ctx.fillStyle = PALETTE.truck;
          ctx.beginPath();
          ctx.roundRect(left + 2, y, lane.width - 4, h, 6);
          ctx.fill();
          ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
          const cabX = lane.dir === 1 ? left + lane.width - 32 : left + 2;
          ctx.fillRect(cabX, y, 30, h);
          ctx.fillStyle = PALETTE.bg;
          ctx.fillRect(front - lane.dir * 12 - 4, y + 6, 8, h - 12);
        } else if (lane.object === "log") {
          ctx.fillStyle = PALETTE.logDark;
          ctx.beginPath();
          ctx.roundRect(left, y, lane.width, h, 12);
          ctx.fill();
          ctx.strokeStyle = PALETTE.log;
          ctx.globalAlpha = 0.6;
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (const dy of [12, 20, 28]) {
            ctx.moveTo(left + 14, y + dy);
            ctx.lineTo(left + lane.width - 14, y + dy);
          }
          ctx.stroke();
          ctx.globalAlpha = 1;
        } else {
          const n = Math.round(lane.width / CELL);
          for (let k = 0; k < n; k++) {
            const cx = left + CELL / 2 + k * CELL;
            const cy = lane.row * CELL + CELL / 2;
            ctx.fillStyle = PALETTE.turtleBody;
            ctx.strokeStyle = PALETTE.turtle;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(cx, cy, 19, 16, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(cx - 8, cy);
            ctx.lineTo(cx + 8, cy);
            ctx.moveTo(cx, cy - 8);
            ctx.lineTo(cx, cy + 8);
            ctx.stroke();
            ctx.fillStyle = PALETTE.turtle;
            ctx.beginPath();
            ctx.arc(cx + lane.dir * 21, cy, 5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
  }

  function drawDeath(x: number, y: number) {
    if (!ctx || world.cause === null) return;
    const p = 1 - world.phaseTimer / DEATH_DURATION;
    ctx.globalAlpha = 1 - 0.6 * p;
    if (world.cause === "run-over") {
      ctx.fillStyle = PALETTE.splat;
      ctx.strokeStyle = PALETTE.splat;
      ctx.lineWidth = 4;
      const r = 8 + 10 * Math.min(1, p * 3);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        ctx.lineTo(x + Math.cos(a) * (r + 8), y + Math.sin(a) * (r + 8));
      }
      ctx.stroke();
    } else {
      ctx.strokeStyle = PALETTE.splash;
      ctx.lineWidth = 3;
      for (let k = 0; k < 3; k++) {
        const r = 6 + p * 24 + k * 8;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawFrogs() {
    if (!ctx) return;
    // Frogs already home (no glow).
    for (let i = 0; i < SLOT_COUNT; i++) {
      if (world.slots[i]) {
        drawFrog(ctx, SLOT_CENTERS[i], CELL / 2, "down", 0.9, 0.9, false);
      }
    }

    const y = world.frogRow * CELL + CELL / 2;
    const x = Math.min(W, Math.max(0, world.frogX)); // swept frogs stay in view
    if (world.phase === "dying") {
      drawDeath(x, y);
      return;
    }
    if (world.phase === "clearing") return; // the five home frogs are the show

    let fx = x;
    let fy = y;
    let sx = 1;
    let sy = 1;
    if (hopAnim) {
      const p = 1 - hopAnim.t / HOP_ANIM;
      fx = hopAnim.fromX + (x - hopAnim.fromX) * p;
      fy = hopAnim.fromY + (y - hopAnim.fromY) * p;
      const squash = 0.18 * Math.sin(Math.PI * p);
      sx = 1 - squash;
      sy = 1 + squash;
    }
    drawFrog(ctx, fx, fy, facing, sx, sy, true);
  }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    drawBands();
    drawObjects();
    drawFrogs();
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
  /** One hop per frame, by priority. Every code is polled so presses are consumed. */
  function readHop(): HopDir | null {
    let chosen: HopDir | null = null;
    for (const { dir, codes } of HOP_KEYS) {
      let pressed = false;
      for (const code of codes) if (input.pressed(code)) pressed = true;
      if (pressed && chosen === null) chosen = dir;
    }
    return chosen;
  }

  function loop(ts: number) {
    if (!running) return;
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, MAX_DT);
    lastTime = ts;

    const wanted = readHop();
    const hopDir = world.phase === "alive" ? wanted : null; // ignored otherwise
    const beforeX = world.frogX;
    const beforeRow = world.frogRow;

    step(world, dt, hopDir);
    waveClock += dt;

    if (hopAnim) {
      hopAnim.t -= dt;
      if (hopAnim.t <= 0) hopAnim = null;
    }
    if (hopDir !== null) {
      const dRow = Math.abs(world.frogRow - beforeRow);
      const dX = Math.abs(world.frogX - beforeX);
      // A real hop moves one cell; a new attempt (respawn) jumps far.
      if ((dRow === 1 && dX <= 60) || (dRow === 0 && dX >= 40 && dX <= 60)) {
        facing = hopDir;
        hopAnim = {
          fromX: beforeX,
          fromY: beforeRow * CELL + CELL / 2,
          t: HOP_ANIM,
        };
      }
    }

    if (world.state === "gameover") {
      settle();
      return;
    }
    draw();
    emit();
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (running || destroyed || paused) return;
    running = true;
    lastTime = null; // no dt jump after a pause or restart
    rafId = requestAnimationFrame(loop);
  }

  // No assets to preload: draw and start at once.
  emit();
  draw();
  start();

  // ── Public API ──────────────────────────────────────────────────────────────
  return {
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
      forceGameOver(world);
      settle();
    },
    restart() {
      if (destroyed) return;
      stop();
      paused = false;
      gameOverSent = false;
      world = createWorld();
      facing = "up";
      hopAnim = null;
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
