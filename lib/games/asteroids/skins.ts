import type { SkinId } from "../shared/skins";

export type AsteroidsSkin = {
  bg: string;
  ship: string;
  bullet: string;
  asteroid: string;
  triple: string; // triple-shot item
  nova: string; // nova item
  thrust: string; // thruster flame
  ink: string; // particles and nova flash
  /** Multiplier for shadowBlur on key entities. 0 disables glow. */
  glow: number;
  /** Alpha of the translucent fill under outlines. 0 = outline only. */
  fillAlpha: number;
  /** Multiplier for outline widths. */
  line: number;
  scanlines: boolean;
};

export const SKINS: Record<SkinId, AsteroidsSkin> = {
  // Today's look, exactly (mirrors the tokens in app/globals.css).
  classic: {
    bg: "#000000",
    ship: "#00f5ff",
    bullet: "#ff006e",
    asteroid: "#f5ff00",
    triple: "#ff006e",
    nova: "#00ff88",
    thrust: "rgba(255, 130, 0, 0.85)",
    ink: "#e6e9ff",
    glow: 1,
    fillAlpha: 0,
    line: 1,
    scanlines: false,
  },
  neon: {
    bg: "#000000",
    ship: "#00f5ff",
    bullet: "#ff2d95",
    asteroid: "#fff200",
    triple: "#ff2d95",
    nova: "#00ff88",
    thrust: "rgba(255, 140, 0, 0.95)",
    ink: "#ffffff",
    glow: 2,
    fillAlpha: 0.18,
    line: 1.4,
    scanlines: false,
  },
  retro: {
    bg: "#14110f",
    ship: "#7fc4a8",
    bullet: "#e8a34a",
    asteroid: "#d9b86a",
    triple: "#d9695a",
    nova: "#8fbf6a",
    thrust: "rgba(217, 120, 60, 0.85)",
    ink: "#e8dcc0",
    glow: 0,
    fillAlpha: 0.3,
    line: 1.6,
    scanlines: true,
  },
};
