import type { SkinId } from "../shared/skins";

export type SnakeSkin = {
  bg: string;
  grid: string;
  body: string;
  head: string;
  banner: string;
  glow: string;
  /** flat: solid squares. neon: translucent fill plus outline. retro: flat with a light top strip. */
  style: "flat" | "neon" | "retro";
  /** Glow color around fruits (null = none). */
  fruitGlow: string | null;
  /** Overlay blended onto the fruit sheet once per skin change (null = untouched). */
  fruitTint: string | null;
  /** Subtle horizontal scanlines over the field. */
  scanlines: boolean;
};

export const SKINS: Record<SkinId, SnakeSkin> = {
  classic: {
    bg: "#0a0a0f",
    grid: "rgba(255, 255, 255, 0.06)",
    body: "#00b862",
    head: "#00ff88",
    banner: "#00ff88",
    glow: "#00ff88",
    style: "flat",
    fruitGlow: null,
    fruitTint: null,
    scanlines: false,
  },
  neon: {
    bg: "#000000",
    grid: "rgba(0, 255, 255, 0.08)",
    body: "#00ff88",
    head: "#00ffd5",
    banner: "#ff2bd6",
    glow: "#00ffd5",
    style: "neon",
    fruitGlow: "#ff2bd6",
    fruitTint: null,
    scanlines: false,
  },
  retro: {
    bg: "#1a1510",
    grid: "rgba(232, 200, 140, 0.06)",
    body: "#6f8f4a",
    head: "#a9c36a",
    banner: "#e0b252",
    glow: "#a9c36a",
    style: "retro",
    fruitGlow: null,
    fruitTint: "rgba(190, 130, 60, 0.28)",
    scanlines: true,
  },
};
