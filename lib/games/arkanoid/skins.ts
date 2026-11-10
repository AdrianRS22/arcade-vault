import type { SkinId } from "../shared/skins";
import type { BrickColor } from "./types";

export type ArkanoidSkin = {
  /** "sprite" draws the original spritesheet; the others draw procedurally. */
  style: "sprite" | "neon" | "retro";
  bg: string;
  /** "LEVEL N" banner colour and glow. */
  banner: string;
  /** Glow of the ball and paddle. */
  glow: string;
  /** Dim overlay behind the banner. */
  overlay: string;
  /** Brick colours (procedural styles only). */
  bricks: Record<BrickColor, string>;
  paddle: string;
  ball: string;
  /** Subtle horizontal scanlines over the field. */
  scanlines: boolean;
};

const CLASSIC_BRICKS: Record<BrickColor, string> = {
  red: "#ff3b3b",
  yellow: "#ffe600",
  cyan: "#00f5ff",
  magenta: "#ff006e",
  hotpink: "#ff69b4",
  green: "#39ff14",
};

export const SKINS: Record<SkinId, ArkanoidSkin> = {
  classic: {
    style: "sprite",
    bg: "#0a0a0f",
    banner: "#ff006e",
    glow: "#00f5ff",
    overlay: "rgba(10, 10, 15, 0.55)",
    bricks: CLASSIC_BRICKS,
    paddle: "#00f5ff",
    ball: "#ffffff",
    scanlines: false,
  },
  neon: {
    style: "neon",
    bg: "#000000",
    banner: "#ff2bd6",
    glow: "#00f5ff",
    overlay: "rgba(0, 0, 0, 0.6)",
    bricks: {
      red: "#ff2b4a",
      yellow: "#fff700",
      cyan: "#00f5ff",
      magenta: "#ff2bd6",
      hotpink: "#ff7ad9",
      green: "#39ff14",
    },
    paddle: "#00f5ff",
    ball: "#ffffff",
    scanlines: false,
  },
  retro: {
    style: "retro",
    bg: "#1a1410",
    banner: "#e8b04a",
    glow: "#e8b04a",
    overlay: "rgba(26, 20, 16, 0.6)",
    bricks: {
      red: "#c0503a",
      yellow: "#d9a441",
      cyan: "#5a9a9a",
      magenta: "#a0527a",
      hotpink: "#c98a8a",
      green: "#7a9a4a",
    },
    paddle: "#d8c8a0",
    ball: "#f2e6c4",
    scanlines: true,
  },
};
