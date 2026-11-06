// Constantes
const WIDTH = 800, HEIGHT = 600;
const PADDLE = { w: 120, h: 16, y: 560, speed: 600 };   // px, px/s
const BALL = { size: 16, speed: 360 };                   // px, px/s
const BRICKS = { cols: 10, w: 64, h: 32, gap: 4, top: 80 };
const START_LIVES = 3;
const SERVE_DELAY = 1; // s
const MAX_DT = 1 / 30; // s
const LEVEL_INTRO = 1.5; // s

// Sonidos
const SOUNDS = {
  bounce: new Audio('assets/sounds/ball-bounce.mp3'),
  break: new Audio('assets/sounds/break-sound.mp3'),
};

function playSound(name) {
  const s = SOUNDS[name].cloneNode();
  s.play().catch(() => {}); // autoplay bloqueado u otro fallo: se ignora
}

// Estado mutable
const state = {
  status: 'playing',          // 'playing' | 'won' | 'lost'
  level: 0,                   // índice en LEVELS (0-based); el HUD muestra level + 1
  levelIntro: 0,              // s restantes del overlay "Nivel N"; > 0 => todo congelado
  lives: START_LIVES,
  serveTimer: SERVE_DELAY,    // s restantes; > 0 => pelota pegada a la paleta
  paddle: { x: (WIDTH - PADDLE.w) / 2 },
  ball: { x: 0, y: 0, vx: 0, vy: 0 },
  bricks: [],
  explosions: [],             // { x, y, color, t } con t en ms
  input: { left: false, right: false, mouseX: null },
};

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function createBricks(levelIndex) {
  const totalW = BRICKS.cols * BRICKS.w + (BRICKS.cols - 1) * BRICKS.gap;
  const left = (WIDTH - totalW) / 2; // 62
  const bricks = [];
  const rows = LEVELS[levelIndex];
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < BRICKS.cols; c++) {
      const color = BRICK_COLORS[rows[r][c]];
      if (!color) continue; // '.' o carácter desconocido: hueco
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

state.bricks = createBricks(state.level);

// Input
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') state.input.left = true;
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') state.input.right = true;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.preventDefault();
});

window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') state.input.left = false;
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') state.input.right = false;
});

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  state.input.mouseX = (e.clientX - rect.left) * (WIDTH / rect.width);
});

function updatePaddle(dt) {
  const { input, paddle } = state;
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir !== 0) {
    paddle.x += dir * PADDLE.speed * dt;
    input.mouseX = null; // el teclado tiene prioridad hasta que se mueva el ratón
  } else if (input.mouseX !== null) {
    paddle.x = input.mouseX - PADDLE.w / 2;
  }
  paddle.x = Math.max(0, Math.min(WIDTH - PADDLE.w, paddle.x));
}

function resetBallOnPaddle() {
  const { ball, paddle } = state;
  ball.x = paddle.x + (PADDLE.w - BALL.size) / 2;
  ball.y = PADDLE.y - BALL.size;
  ball.vx = 0;
  ball.vy = 0;
}

function startServe() {
  state.serveTimer = SERVE_DELAY;
  resetBallOnPaddle();
}

function launchBall() {
  const v = BALL.speed * Math.SQRT1_2; // 45° arriba-derecha
  state.ball.vx = v;
  state.ball.vy = -v;
}

function updateBall(dt) {
  const { ball, paddle } = state;

  // Saque: la pelota reposa sobre la paleta hasta que acaba el temporizador
  if (state.serveTimer > 0) {
    resetBallOnPaddle();
    state.serveTimer -= dt;
    if (state.serveTimer <= 0) {
      state.serveTimer = 0;
      launchBall();
    }
    return;
  }

  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  // Paredes laterales
  if (ball.x < 0) {
    ball.x = 0;
    ball.vx = Math.abs(ball.vx);
  } else if (ball.x + BALL.size > WIDTH) {
    ball.x = WIDTH - BALL.size;
    ball.vx = -Math.abs(ball.vx);
  }

  // Techo
  if (ball.y < 0) {
    ball.y = 0;
    ball.vy = Math.abs(ball.vy);
  }

  // Paleta (reflexión simple), solo si la pelota baja
  if (
    ball.vy > 0 &&
    ball.x + BALL.size > paddle.x &&
    ball.x < paddle.x + PADDLE.w &&
    ball.y + BALL.size > PADDLE.y &&
    ball.y < PADDLE.y + PADDLE.h
  ) {
    ball.y = PADDLE.y - BALL.size;
    ball.vy = -Math.abs(ball.vy);
    playSound('bounce');
  }

  // Bloques (AABB): como máximo uno por frame
  for (const b of state.bricks) {
    if (!b.alive) continue;
    const overlapX = Math.min(ball.x + BALL.size - b.x, b.x + BRICKS.w - ball.x);
    const overlapY = Math.min(ball.y + BALL.size - b.y, b.y + BRICKS.h - ball.y);
    if (overlapX <= 0 || overlapY <= 0) continue;

    b.alive = false;
    state.explosions.push({ x: b.x, y: b.y, color: b.color, t: 0 });
    playSound('break');
    const ballCx = ball.x + BALL.size / 2, ballCy = ball.y + BALL.size / 2;
    const brickCx = b.x + BRICKS.w / 2, brickCy = b.y + BRICKS.h / 2;
    if (overlapX < overlapY) {
      // Penetración menor en X: rebote horizontal
      const dir = ballCx < brickCx ? -1 : 1;
      ball.x += dir * overlapX;
      ball.vx = dir * Math.abs(ball.vx);
    } else {
      // Penetración menor en Y: rebote vertical
      const dir = ballCy < brickCy ? -1 : 1;
      ball.y += dir * overlapY;
      ball.vy = dir * Math.abs(ball.vy);
    }
    break;
  }

  // Cae por abajo: resta una vida y vuelve al saque (o derrota)
  if (ball.y > HEIGHT) {
    state.lives = Math.max(0, state.lives - 1);
    if (state.lives === 0) {
      state.status = 'lost';
    } else {
      startServe();
    }
  }
}

function loadLevel(levelIndex) {
  state.level = levelIndex;
  state.bricks = createBricks(levelIndex);
  state.explosions = [];
  state.paddle.x = (WIDTH - PADDLE.w) / 2;
  state.levelIntro = LEVEL_INTRO;
  startServe();
}

function restartGame() {
  state.status = 'playing';
  state.lives = START_LIVES;
  loadLevel(0);
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    if (state.status !== 'playing') restartGame();
  }
});

canvas.addEventListener('click', () => {
  if (state.status !== 'playing') restartGame();
});

function updateExplosions(dt) {
  for (const e of state.explosions) e.t += dt * 1000;
  state.explosions = state.explosions.filter(
    (e) => Math.floor(e.t / EXPLOSION_DURATION) < EXPLOSION_FRAMES[e.color].length
  );
}

function update(dt) {
  if (state.status !== 'playing') return;

  // Overlay "Nivel N": todo congelado
  if (state.levelIntro > 0) {
    state.levelIntro = Math.max(0, state.levelIntro - dt);
    return;
  }

  // Sin bloques vivos: pelota y paleta congeladas; al acabar las explosiones, siguiente nivel o victoria
  if (state.bricks.every((b) => !b.alive)) {
    updateExplosions(dt);
    if (state.explosions.length === 0) {
      if (state.level < LEVELS.length - 1) loadLevel(state.level + 1);
      else state.status = 'won';
    }
    return;
  }

  updatePaddle(dt);
  updateBall(dt);
  updateExplosions(dt);
}

function render() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  for (const b of state.bricks) {
    if (b.alive) drawSprite(ctx, 'block_' + b.color, b.x, b.y, BRICKS.w, BRICKS.h);
  }

  for (const e of state.explosions) {
    const frame = EXPLOSION_FRAMES[e.color][Math.floor(e.t / EXPLOSION_DURATION)];
    if (frame) drawFrame(ctx, frame, e.x, e.y, BRICKS.w, BRICKS.h);
  }

  drawSprite(ctx, 'paddle', state.paddle.x, PADDLE.y, PADDLE.w, PADDLE.h);
  drawSprite(ctx, 'ball', state.ball.x, state.ball.y, BALL.size, BALL.size);

  // HUD
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '20px sans-serif';
  ctx.fillText('Nivel ' + (state.level + 1), 16, 26);

  const LIFE_SIZE = 20, LIFE_GAP = 6;
  for (let i = 0; i < state.lives; i++) {
    const x = WIDTH - 16 - (i + 1) * LIFE_SIZE - i * LIFE_GAP;
    drawSprite(ctx, 'ball', x, 16, LIFE_SIZE, LIFE_SIZE);
  }

  // Overlay de inicio de nivel
  if (state.status === 'playing' && state.levelIntro > 0) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText('Nivel ' + (state.level + 1), WIDTH / 2, HEIGHT / 2);
  }

  // Overlay de fin de partida
  if (state.status !== 'playing') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText(state.status === 'won' ? '¡Has ganado!' : 'Game Over', WIDTH / 2, HEIGHT / 2 - 20);
    ctx.font = '24px sans-serif';
    ctx.fillText('Pulsa Espacio o haz clic para reiniciar', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

let lastTime = 0;
function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, MAX_DT);
  lastTime = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

function start() {
  lastTime = performance.now();
  requestAnimationFrame(frame);
}

loadLevel(0);
loadSpritesheet(start);
