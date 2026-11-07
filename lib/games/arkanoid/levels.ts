import type { BrickColor } from "./types";

// Each string is a row of 10 columns. '.' = gap.
// R red, Y yellow, C cyan, M magenta, P hotpink, G green.
export const BRICK_COLORS: Record<string, BrickColor> = {
  R: "red",
  Y: "yellow",
  C: "cyan",
  M: "magenta",
  P: "hotpink",
  G: "green",
};

export const LEVELS: readonly (readonly string[])[] = [
  [
    // Layout 1: full rows
    "RRRRRRRRRR",
    "YYYYYYYYYY",
    "CCCCCCCCCC",
    "MMMMMMMMMM",
    "PPPPPPPPPP",
    "GGGGGGGGGG",
  ],
  [
    // Layout 2: checkerboard
    "R.R.R.R.R.",
    ".Y.Y.Y.Y.Y",
    "C.C.C.C.C.",
    ".M.M.M.M.M",
    "P.P.P.P.P.",
    ".G.G.G.G.G",
  ],
  [
    // Layout 3: frame with a center block
    "RRRRRRRRRR",
    "Y........Y",
    "C..CCCC..C",
    "M..MMMM..M",
    "P........P",
    "GGGGGGGGGG",
  ],
];
