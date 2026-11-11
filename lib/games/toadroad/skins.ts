import type { SkinId } from "../shared/skins";

/** How vehicles, logs and shells are painted. */
export type BodyStyle = "solid" | "neon" | "retro";

export type ToadRoadSkin = {
  bg: string; // safe rows, windows and background
  road: string;
  laneDash: string;
  water: string;
  wave: string;
  grass: string;
  bush: string;
  slot: string;
  frog: string;
  frogEye: string;
  carA: string;
  carB: string;
  carC: string;
  truck: string;
  log: string;
  logDark: string;
  turtle: string;
  turtleBody: string;
  splat: string;
  splash: string;
  bodyStyle: BodyStyle;
  frogGlow: boolean; // glow only on the live frog
  scanlines: boolean;
};

// A canvas cannot read CSS variables, so classic mirrors the app/globals.css tokens.
export const SKINS: Record<SkinId, ToadRoadSkin> = {
  classic: {
    bg: "#0a0a0f",
    road: "#15151f",
    laneDash: "#4a4f70",
    water: "#04243a",
    wave: "rgba(0, 245, 255, 0.18)",
    grass: "#0b2a1c",
    bush: "#007a44",
    slot: "#00f5ff",
    frog: "#00ff88",
    frogEye: "#e6e9ff",
    carA: "#ff006e",
    carB: "#f5ff00",
    carC: "#00f5ff",
    truck: "#d97a3a",
    log: "#d97a3a",
    logDark: "#7a4320",
    turtle: "#00ff88",
    turtleBody: "#0b5a3a",
    splat: "#ff006e",
    splash: "#00f5ff",
    bodyStyle: "solid",
    frogGlow: true,
    scanlines: false,
  },
  neon: {
    bg: "#000000",
    road: "#07070d",
    laneDash: "#ff00ff",
    water: "#00101c",
    wave: "rgba(0, 245, 255, 0.3)",
    grass: "#001a0d",
    bush: "#00331c",
    slot: "#00ffff",
    frog: "#39ff88",
    frogEye: "#ffffff",
    carA: "#ff2d95",
    carB: "#fff200",
    carC: "#00f0ff",
    truck: "#ff8a1f",
    log: "#ffa640",
    logDark: "#ff8a1f",
    turtle: "#39ff88",
    turtleBody: "#39ff88",
    splat: "#ff2d95",
    splash: "#00f0ff",
    bodyStyle: "neon",
    frogGlow: true,
    scanlines: false,
  },
  retro: {
    bg: "#1a1410",
    road: "#2b2520",
    laneDash: "#8a7a5c",
    water: "#1d3a4a",
    wave: "rgba(190, 220, 210, 0.2)",
    grass: "#34502c",
    bush: "#4a6b2a",
    slot: "#d8c27a",
    frog: "#8fbf4a",
    frogEye: "#f0e6c8",
    carA: "#c8553d",
    carB: "#e0b84a",
    carC: "#5b8fa8",
    truck: "#b8743a",
    log: "#a8743c",
    logDark: "#6b4528",
    turtle: "#7fa860",
    turtleBody: "#4a6b3a",
    splat: "#c8553d",
    splash: "#a9c9d4",
    bodyStyle: "retro",
    frogGlow: false,
    scanlines: true,
  },
};
