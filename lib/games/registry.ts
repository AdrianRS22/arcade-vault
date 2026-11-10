import type { ArkanoidSnapshot } from "./arkanoid/types";
import type { AsteroidsSnapshot } from "./asteroids/types";
import type { SnakeSnapshot } from "./snake/types";
import type { TetrisSnapshot } from "./tetris/types";
import type {
  BaseSnapshot,
  GameCallbacks,
  GameEngine,
  GameOptions,
} from "./types";

export type HudStat = {
  label: string;
  value: string | number;
  variant?: "cyan" | "magenta" | "yellow" | "green";
};

export type TouchDir = "up" | "down" | "left" | "right";

export type TouchButton = {
  label: string; // pixel-font text on the button, max ~6 chars ("FIRE", "DROP")
  code: string; // KeyboardEvent.code it emits ("Space", "KeyB", "ArrowUp")
  variant?: "cyan" | "magenta" | "yellow" | "green";
};

export type TouchLayout = {
  /** Arrows shown on the D-pad; each emits ArrowUp / ArrowDown / ArrowLeft / ArrowRight. */
  dpad: TouchDir[];
  /** Action buttons on the right, in order. May be empty. */
  buttons: TouchButton[];
  /** Codes that auto-repeat while held (like the OS key repeat). */
  repeat?: string[];
};

export type GameDefinition<S extends BaseSnapshot> = {
  load: () => Promise<{
    create: (
      canvas: HTMLCanvasElement,
      cb: GameCallbacks<S>,
      options: GameOptions,
    ) => GameEngine;
  }>;
  initialSnapshot: S;
  /** Every stat except SCORE, which GamePlayer shows from `BaseSnapshot`. */
  hud: (s: S) => HudStat[];
  /** Game keys only; GamePlayer appends the Pause row. */
  controls: { keys: string[]; action: string }[];
  ariaLabel: string;
  /** The game has sound: GamePlayer shows MUTE/UNMUTE and handles `M`. */
  sound?: boolean;
  /** On-screen controls shown on touch devices; they emit the keys the engine reads. */
  touch: TouchLayout;
};

/** A definition with its snapshot type erased, as stored in the registry. */
export type AnyGameDefinition = GameDefinition<BaseSnapshot>;

/**
 * Registers a game with its own snapshot type. The erasure to `BaseSnapshot`
 * lives only here: the engine always emits the `S` its own `hud` expects.
 */
function defineGame<S extends BaseSnapshot>(
  definition: GameDefinition<S>,
): AnyGameDefinition {
  return definition as unknown as AnyGameDefinition;
}

const asteroids = defineGame<AsteroidsSnapshot>({
  load: async () => {
    const { createAsteroidsGame } = await import("./asteroids/engine");
    return { create: createAsteroidsGame };
  },
  initialSnapshot: {
    score: 0,
    lives: 3,
    level: 1,
    tripleTimer: 0,
    novaBombs: 0,
    state: "playing",
  },
  hud: (s) => {
    const power = [
      s.tripleTimer > 0 ? `TRIPLE ${s.tripleTimer}s` : null,
      s.novaBombs > 0 ? "NOVA [B]" : null,
    ]
      .filter(Boolean)
      .join("  ");
    return [
      {
        label: "Lives",
        value: "♥ ".repeat(s.lives).trim() || "—",
        variant: "magenta",
      },
      {
        label: "Level",
        value: String(s.level).padStart(2, "0"),
        variant: "yellow",
      },
      { label: "Power-up", value: power || "—", variant: "green" },
    ];
  },
  controls: [
    { keys: ["←", "→"], action: "Rotate" },
    { keys: ["↑"], action: "Thrust" },
    { keys: ["Space"], action: "Shoot" },
    { keys: ["B"], action: "Nova bomb" },
  ],
  ariaLabel: "Asteroids game",
  touch: {
    dpad: ["left", "up", "right"],
    buttons: [
      { label: "FIRE", code: "Space", variant: "cyan" },
      { label: "NOVA", code: "KeyB", variant: "magenta" },
    ],
  },
});

const tetris = defineGame<TetrisSnapshot>({
  load: async () => {
    const { createTetrisGame } = await import("./tetris/engine");
    return { create: createTetrisGame };
  },
  initialSnapshot: {
    score: 0,
    lines: 0,
    level: 1,
    freezeSeconds: 0,
    state: "playing",
  },
  hud: (s) => [
    { label: "Lines", value: s.lines, variant: "cyan" },
    {
      label: "Level",
      value: String(s.level).padStart(2, "0"),
      variant: "yellow",
    },
    {
      label: "Power-up",
      value: s.freezeSeconds > 0 ? `FREEZE ${s.freezeSeconds}s` : "—",
      variant: "green",
    },
  ],
  controls: [
    { keys: ["←", "→"], action: "Move" },
    { keys: ["↑", "X"], action: "Rotate" },
    { keys: ["↓"], action: "Soft drop" },
    { keys: ["Space"], action: "Hard drop" },
  ],
  ariaLabel: "Tetris game",
  touch: {
    dpad: ["left", "right", "down"],
    buttons: [
      { label: "ROTATE", code: "ArrowUp", variant: "yellow" },
      { label: "DROP", code: "Space", variant: "magenta" },
    ],
    repeat: ["ArrowLeft", "ArrowRight", "ArrowDown"],
  },
});

const arkanoid = defineGame<ArkanoidSnapshot>({
  load: async () => {
    const { createArkanoidGame } = await import("./arkanoid/engine");
    return { create: createArkanoidGame };
  },
  initialSnapshot: { score: 0, lives: 3, level: 1, state: "playing" },
  hud: (s) => [
    {
      label: "Lives",
      value: "♥ ".repeat(s.lives).trim() || "—",
      variant: "magenta",
    },
    {
      label: "Level",
      value: String(s.level).padStart(2, "0"),
      variant: "yellow",
    },
  ],
  controls: [
    { keys: ["←", "→"], action: "Move paddle" },
    { keys: ["A", "D"], action: "Move paddle" },
    { keys: ["Mouse"], action: "Move paddle" },
  ],
  ariaLabel: "Arkanoid game",
  sound: true,
  touch: { dpad: ["left", "right"], buttons: [] },
});

const snake = defineGame<SnakeSnapshot>({
  load: async () => {
    const { createSnakeGame } = await import("./snake/engine");
    return { create: createSnakeGame };
  },
  initialSnapshot: {
    score: 0,
    length: 3,
    level: 1,
    bonusSeconds: 0,
    state: "waiting",
  },
  hud: (s) => [
    { label: "Length", value: s.length, variant: "green" },
    {
      label: "Level",
      value: String(s.level).padStart(2, "0"),
      variant: "yellow",
    },
    {
      label: "Bonus",
      value: s.bonusSeconds > 0 ? `${s.bonusSeconds}s` : "—",
      variant: "magenta",
    },
  ],
  controls: [
    { keys: ["←", "↑", "↓", "→"], action: "Move" },
    { keys: ["W", "A", "S", "D"], action: "Move" },
  ],
  ariaLabel: "Snake game",
  touch: { dpad: ["up", "down", "left", "right"], buttons: [] },
});

/** Playable games by `games.id`. A catalog row with no entry is "not playable yet". */
export const registry: Record<string, AnyGameDefinition> = {
  asteroids,
  tetris,
  arkanoid,
  snake,
};
