export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type GameColor = "cyan" | "magenta" | "yellow" | "green";

export type Game = {
  id: string; // kebab-case slug, used in the URL
  title: string; // e.g. "BLOCK BUSTER"
  short: string; // card description
  long: string; // detail description
  category: GameCategory;
  cover: string; // CSS class from globals.css, e.g. "cover-bricks"
  color: GameColor;
  best: number;
  plays: string; // display string, e.g. "12.4K"
};

export const CATEGORIES = [
  "ALL",
  "ARCADE",
  "PUZZLE",
  "SHOOTER",
  "VERSUS",
] as const;

const GAMES: Game[] = [
  {
    id: "block-buster",
    title: "BLOCK BUSTER",
    short: "Bounce the ball and smash neon walls.",
    long: "Pilot a paddle-ship and bounce a plasma core to pulverize walls of chromatic blocks. Every level rearranges the grid into impossible patterns. How far will your streak go?",
    category: "ARCADE",
    cover: "cover-bricks",
    color: "cyan",
    best: 28450,
    plays: "12.4K",
  },
  {
    id: "drop",
    title: "DROP",
    short: "Fit the pieces before the ceiling crushes you.",
    long: "Geometric pieces descend from the dark. Rotate them, lock them in and clear lines to survive. The speed ramps up mercilessly every 10 lines.",
    category: "PUZZLE",
    cover: "cover-tetro",
    color: "magenta",
    best: 184220,
    plays: "31.8K",
  },
  {
    id: "serpentine",
    title: "SERPENTINE",
    short: "Grow without biting your own tail.",
    long: "A serpent of light slithers across the grid hunting magenta cores. Every bite makes it longer and faster. One wrong move and it devours itself.",
    category: "ARCADE",
    cover: "cover-snake",
    color: "green",
    best: 7820,
    plays: "9.1K",
  },
  {
    id: "glutton",
    title: "GLUTTON",
    short: "Devour dots and escape the ghosts.",
    long: "A hungry circle patrols a maze collecting glowing dots. Four specters chase it, but every so often a power pill appears and turns the tables.",
    category: "ARCADE",
    cover: "cover-glot",
    color: "yellow",
    best: 96400,
    plays: "27.2K",
  },
  {
    id: "invaders",
    title: "INVADERS",
    short: "Defend the planet from rows of aliens.",
    long: "Waves of hostile pixels descend formation after formation. Slide your cannon sideways and fire with precision before they touch the surface.",
    category: "SHOOTER",
    cover: "cover-invaders",
    color: "green",
    best: 54190,
    plays: "18.0K",
  },
  {
    id: "rocks",
    title: "ROCKS",
    short: "Pulverize asteroids in zero gravity.",
    long: "Your triangular ship floats in absolute vacuum. Shoot and rotate to split rocks into ever smaller fragments. Watch out for UFOs on the horizon.",
    category: "SHOOTER",
    cover: "cover-rocas",
    color: "yellow",
    best: 41200,
    plays: "15.6K",
  },
  {
    id: "froggy",
    title: "FROGGY",
    short: "Cross the pixel highway.",
    long: "Hop between lanes of speeding cars and logs drifting down the river. Reach the lily pads before time runs out.",
    category: "ARCADE",
    cover: "cover-rana",
    color: "green",
    best: 18900,
    plays: "6.4K",
  },
  {
    id: "pixel-duel",
    title: "PIXEL DUEL",
    short: "Two paddles. One ball. Maximum reflexes.",
    long: "The purest duel: two vertical paddles fight over a glowing ball. Play solo against the CPU or local two-player.",
    category: "VERSUS",
    cover: "cover-duelo",
    color: "cyan",
    best: 24,
    plays: "4.2K",
  },
];

export async function getGames(): Promise<Game[]> {
  return GAMES;
}

export async function getGameById(id: string): Promise<Game | undefined> {
  return GAMES.find((game) => game.id === id);
}
