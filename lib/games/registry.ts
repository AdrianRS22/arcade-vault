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
});

/** Playable games by `games.id`. A catalog row with no entry is "not playable yet". */
export const registry: Record<string, AnyGameDefinition> = {
  asteroids,
  tetris,
  arkanoid,
  snake,
};
