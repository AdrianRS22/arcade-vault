import {
  DEAD_TIME,
  H,
  NOVA_CHANCE,
  NOVA_FLASH,
  PALETTE,
  POINTS,
  POWERUP_MAX_FRACTION,
  SAFE_DIST,
  START_ASTEROIDS,
  START_LIVES,
  TRIPLE_DURATION,
  W,
} from "./constants";
import {
  Asteroid,
  Bullet,
  Particle,
  PowerUp,
  Ship,
  dist,
  rand,
  randInt,
} from "./entities";
import { createInput } from "./input";
import type {
  AsteroidsCallbacks,
  AsteroidsGame,
  AsteroidsSnapshot,
  AsteroidsState,
} from "./types";

export type { AsteroidsCallbacks, AsteroidsGame, AsteroidsSnapshot };

export function createAsteroidsGame(
  canvas: HTMLCanvasElement,
  callbacks: AsteroidsCallbacks,
): AsteroidsGame {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context is not available");

  // Logical field is W×H; the backing store follows devicePixelRatio.
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const input = createInput();

  // ── Game state ──────────────────────────────────────────────────────────────
  let ship = new Ship();
  let bullets: Bullet[] = [];
  let asteroids: Asteroid[] = [];
  let particles: Particle[] = [];
  let score = 0;
  let lives = START_LIVES;
  let level = 1;
  let powerup: PowerUp | null = null;
  let novaItem: PowerUp | null = null;
  let tripleTimer = 0;
  let novaBombs = 0;
  let novaFlash = 0;
  let levelKills = 0;
  let powerupKillTarget = -1;
  let novaKillTarget = -1;
  let state: AsteroidsState = "playing";
  let deadTimer = 0;

  // ── Loop control ────────────────────────────────────────────────────────────
  let running = false;
  let paused = false;
  let destroyed = false;
  let rafId = 0;
  let lastTime: number | null = null;

  // ── Snapshot (React-facing) ─────────────────────────────────────────────────
  let lastSnap: AsteroidsSnapshot | null = null;

  function emit() {
    const snap: AsteroidsSnapshot = {
      score,
      lives,
      level,
      tripleTimer: Math.ceil(tripleTimer),
      novaBombs,
      state,
    };
    if (
      lastSnap &&
      lastSnap.score === snap.score &&
      lastSnap.lives === snap.lives &&
      lastSnap.level === snap.level &&
      lastSnap.tripleTimer === snap.tripleTimer &&
      lastSnap.novaBombs === snap.novaBombs &&
      lastSnap.state === snap.state
    )
      return;
    lastSnap = snap;
    callbacks.onChange(snap);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function spawnAsteroids(count: number) {
    for (let i = 0; i < count; i++) {
      let x: number;
      let y: number;
      do {
        x = rand(0, W);
        y = rand(0, H);
      } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
      asteroids.push(new Asteroid(x, y, 3));
    }
  }

  // Every large asteroid yields 7 destructions (1 + 2 + 4)
  function resetPowerupsForLevel(count: number) {
    levelKills = 0;
    const maxKills = Math.max(1, Math.floor(count * 7 * POWERUP_MAX_FRACTION));
    powerupKillTarget = randInt(1, maxKills);

    // Nova bomb: scarce, never on the same kill as the triple shot
    novaKillTarget = -1;
    if (Math.random() < NOVA_CHANCE) {
      novaKillTarget = randInt(1, maxKills);
      if (novaKillTarget === powerupKillTarget) novaKillTarget++;
    }
  }

  function explode(x: number, y: number, count = 8) {
    for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
  }

  function initGame() {
    ship = new Ship();
    bullets = [];
    asteroids = [];
    particles = [];
    score = 0;
    lives = START_LIVES;
    level = 1;
    powerup = null;
    novaItem = null;
    tripleTimer = 0;
    novaBombs = 0;
    novaFlash = 0;
    state = "playing";
    deadTimer = 0;
    spawnAsteroids(START_ASTEROIDS);
    resetPowerupsForLevel(START_ASTEROIDS);
    input.reset();
    emit();
  }

  function nextLevel() {
    level++;
    novaItem = null;
    bullets = [];
    particles = [];
    ship.reset();
    spawnAsteroids(3 + level);
    resetPowerupsForLevel(3 + level);
  }

  // Nova bomb: destroys every asteroid without splitting them
  function detonateNova() {
    for (const a of asteroids) {
      score += POINTS[a.size];
      explode(a.x, a.y, a.size * 5);
    }
    asteroids = [];
    novaBombs--;
    novaFlash = NOVA_FLASH;
  }

  function gameOver() {
    state = "gameover";
    tripleTimer = 0;
    emit();
    callbacks.onGameOver(score);
  }

  function killShip() {
    explode(ship.x, ship.y, 14);
    ship.dead = true;
    tripleTimer = 0;
    lives--;
    if (lives <= 0) {
      gameOver();
    } else {
      state = "dead";
      deadTimer = DEAD_TIME;
    }
  }

  function updateItems(dt: number) {
    if (powerup) {
      powerup.update(dt);
      if (powerup.dead) powerup = null;
    }
    if (novaItem) {
      novaItem.update(dt);
      if (novaItem.dead) novaItem = null;
    }
    if (novaFlash > 0) novaFlash = Math.max(0, novaFlash - dt);
  }

  // ── Update ──────────────────────────────────────────────────────────────────
  function update(dt: number) {
    if (state === "gameover") {
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      return;
    }

    if (state === "dead") {
      // Drain one-shot presses so they don't fire the moment the ship respawns
      input.pressed("Space");
      input.pressed("KeyB");
      deadTimer -= dt;
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      asteroids.forEach((a) => a.update(dt));
      updateItems(dt);
      if (deadTimer <= 0) {
        state = "playing";
        ship.reset();
      }
      return;
    }

    // Shoot
    if (input.pressed("Space")) bullets.push(...ship.tryShoot(tripleTimer > 0));
    if (input.pressed("KeyB") && novaBombs > 0) detonateNova();

    ship.update(dt, input.keys);
    bullets.forEach((b) => b.update(dt));
    asteroids.forEach((a) => a.update(dt));
    particles.forEach((p) => p.update(dt));
    if (tripleTimer > 0) tripleTimer = Math.max(0, tripleTimer - dt);
    updateItems(dt);

    bullets = bullets.filter((b) => !b.dead);
    particles = particles.filter((p) => !p.dead);

    // Bullet vs asteroid
    const newAsteroids: Asteroid[] = [];
    for (const b of bullets) {
      for (const a of asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          score += POINTS[a.size];
          explode(a.x, a.y, a.size * 5);
          newAsteroids.push(...a.split());
          const kills = ++levelKills;
          if (kills === powerupKillTarget) powerup = new PowerUp(a.x, a.y);
          if (kills === novaKillTarget)
            novaItem = new PowerUp(a.x, a.y, "nova");
        }
      }
    }
    asteroids = asteroids.filter((a) => !a.dead).concat(newAsteroids);
    bullets = bullets.filter((b) => !b.dead);

    // Ship vs asteroid
    if (ship.invincible <= 0) {
      for (const a of asteroids) {
        if (dist(ship, a) < ship.radius + a.radius * 0.82) {
          killShip();
          break;
        }
      }
    }

    // Ship vs power-ups
    if (
      powerup &&
      !ship.dead &&
      dist(ship, powerup) < ship.radius + powerup.radius
    ) {
      tripleTimer = TRIPLE_DURATION;
      explode(powerup.x, powerup.y, 6);
      powerup = null;
    }
    if (
      novaItem &&
      !ship.dead &&
      dist(ship, novaItem) < ship.radius + novaItem.radius
    ) {
      novaBombs = 1;
      explode(novaItem.x, novaItem.y, 6);
      novaItem = null;
    }

    // Level cleared (not while the ship has just died)
    if (state === "playing" && asteroids.length === 0) nextLevel();
  }

  // ── Draw ────────────────────────────────────────────────────────────────────
  function draw() {
    if (!ctx) return;
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, W, H);

    particles.forEach((p) => p.draw(ctx));
    asteroids.forEach((a) => a.draw(ctx));
    bullets.forEach((b) => b.draw(ctx));
    powerup?.draw(ctx);
    novaItem?.draw(ctx);
    ship.draw(ctx);

    if (novaFlash > 0) {
      ctx.save();
      ctx.globalAlpha = (novaFlash / NOVA_FLASH) * 0.6;
      ctx.fillStyle = PALETTE.ink;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  // ── Main loop ───────────────────────────────────────────────────────────────
  function loop(ts: number) {
    if (!running) return;
    // dt capped at 0.05 s to avoid big jumps after tab switches
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    update(dt);
    draw();
    emit();
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (running || destroyed) return;
    running = true;
    lastTime = null; // no dt jump after a pause or restart
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
  }

  // ── Public API ──────────────────────────────────────────────────────────────
  initGame();
  start();

  return {
    pause() {
      if (destroyed || paused || state === "gameover") return;
      paused = true;
      stop();
      input.reset(); // avoid stuck keys if released while paused
    },
    resume() {
      if (destroyed || !paused) return;
      paused = false;
      start();
    },
    end() {
      if (destroyed || state === "gameover") return;
      if (!ship.dead) {
        explode(ship.x, ship.y, 14);
        ship.dead = true;
      }
      lives = 0;
      paused = false;
      gameOver();
      start(); // keep the loop alive so the explosion finishes animating
    },
    restart() {
      if (destroyed) return;
      stop();
      paused = false;
      initGame();
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
