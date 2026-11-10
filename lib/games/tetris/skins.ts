import type { SkinId } from "../shared/skins";

/** How a single block is painted. */
export type CellStyle = "classic" | "neon" | "retro";

export type TetrisSkin = {
  /** Colours indexed by board value (0 is empty). */
  colors: readonly (string | null)[];
  bg: string;
  grid: string;
  border: string;
  label: string;
  freezeTint: string;
  cell: CellStyle;
  /** Blur of the falling piece glow, 0 for none. */
  glow: number;
  scanlines: boolean;
};

export const SKINS: Record<SkinId, TetrisSkin> = {
  classic: {
    colors: [
      null,
      "#00f5ff", // 1 I
      "#f5ff00", // 2 O
      "#aa00ff", // 3 T
      "#00ff88", // 4 S
      "#ff006e", // 5 Z
      "#2979ff", // 6 J
      "#ff7700", // 7 L
      null, // 8 unused
      "#ffffff", // 9 wild
      "#ff6d00", // 10 bomb
      "#ffea00", // 11 lightning
      "#ff4081", // 12 tint
      "#bcaaa4", // 13 gravity
      "#40c4ff", // 14 freeze
    ],
    bg: "#000000",
    grid: "rgba(0, 245, 255, 0.08)",
    border: "rgba(0, 245, 255, 0.35)",
    label: "#b4b9e0",
    freezeTint: "rgba(64, 196, 255, 0.12)",
    cell: "classic",
    glow: 12,
    scanlines: false,
  },
  neon: {
    colors: [
      null,
      "#00f0ff",
      "#fff200",
      "#d500f9",
      "#39ff14",
      "#ff1744",
      "#2979ff",
      "#ff9100",
      null,
      "#ffffff",
      "#ff6d00",
      "#ffea00",
      "#ff4081",
      "#bcaaa4",
      "#40c4ff",
    ],
    bg: "#000000",
    grid: "#16162a",
    border: "rgba(0, 240, 255, 0.6)",
    label: "#b4b9e0",
    freezeTint: "rgba(64, 196, 255, 0.12)",
    cell: "neon",
    glow: 14,
    scanlines: false,
  },
  retro: {
    colors: [
      null,
      "#4dd0e1",
      "#ffd54f",
      "#ba68c8",
      "#81c784",
      "#e57373",
      "#90caf9",
      "#ffb74d",
      null,
      "#ffffff",
      "#ff7043",
      "#ffee58",
      "#f06292",
      "#a1887f",
      "#4fc3f7",
    ],
    bg: "#14110f",
    grid: "rgba(255, 224, 178, 0.07)",
    border: "rgba(255, 213, 79, 0.4)",
    label: "#d7ccc8",
    freezeTint: "rgba(79, 195, 247, 0.12)",
    cell: "retro",
    glow: 0,
    scanlines: true,
  },
};
