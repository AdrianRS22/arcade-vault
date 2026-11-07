// Logical play field. The canvas backing store is scaled by devicePixelRatio.
export const W = 800;
export const H = 600;

// Asteroid tables, indexed by size 1, 2, 3 (index 0 unused).
export const RADII = [0, 16, 30, 50] as const;
export const SPEEDS = [0, 85, 55, 32] as const; // base px/s
export const POINTS = [0, 100, 50, 20] as const;

// Ship
export const SHIP_ROT = 3.5; // rad/s
export const SHIP_THRUST = 260; // px/s²
export const SHIP_DRAG = 0.987; // per frame, as in the reference game
export const SHIP_RADIUS = 12;
export const SHIP_INVINCIBLE = 3; // s after (re)spawn
export const SHOOT_COOLDOWN = 0.2; // s
export const SHIP_NOSE = 21;

// Bullets
export const BULLET_SPEED = 520;
export const BULLET_TTL = 1.1;
export const BULLET_RADIUS = 2;

// Respawn / spawning
export const DEAD_TIME = 2; // s between losing a life and respawn
export const SAFE_DIST = 130; // px around the center with no asteroid spawns
export const START_LIVES = 3;
export const START_ASTEROIDS = 4;

// Power-ups
export const POWERUP_MAX_FRACTION = 0.7; // triple shot appears before this % of kills
export const TRIPLE_DURATION = 5; // s
export const TRIPLE_SPREAD = 0.2; // rad between fan bullets
export const NOVA_CHANCE = 0.35; // chance Nova appears in a level
export const NOVA_FLASH = 0.35; // s of screen flash on detonation
export const POWERUP_RADIUS = 10;
export const POWERUP_TTL = 8; // s

// Neon palette. Hex mirrors the tokens in app/globals.css
// (canvas cannot read CSS variables directly).
export const PALETTE = {
  cyan: "#00f5ff", // --cyan: ship
  magenta: "#ff006e", // --magenta: bullets, triple shot item
  yellow: "#f5ff00", // --yellow: asteroids
  green: "#00ff88", // --green: Nova item
  ink: "#e6e9ff", // --ink: neutral highlights
  thrust: "rgba(255, 130, 0, 0.85)", // thruster flame (same orange as the reference)
  bg: "#000000",
} as const;
