import type { BrickColor } from "./types";

export type Rect = { sx: number; sy: number; sw: number; sh: number };

const frames = (sy: number): Rect[] =>
  [256, 288, 320, 352].map((sx) => ({ sx, sy, sw: 32, sh: 16 }));

export const EXPLOSION_FRAMES: Record<BrickColor, Rect[]> = {
  red: frames(176),
  cyan: frames(192),
  green: frames(208),
  magenta: frames(224),
  yellow: frames(240),
  hotpink: frames(256),
};

export const SPRITES = {
  paddle: { sx: 32, sy: 112, sw: 162, sh: 14 },
  ball: { sx: 32, sy: 32, sw: 16, sh: 16 },
  blocks: {
    red: { sx: 32, sy: 176, sw: 32, sh: 16 },
    yellow: { sx: 32, sy: 240, sw: 32, sh: 16 },
    cyan: { sx: 32, sy: 192, sw: 32, sh: 16 },
    magenta: { sx: 32, sy: 224, sw: 32, sh: 16 },
    hotpink: { sx: 32, sy: 256, sw: 32, sh: 16 },
    green: { sx: 32, sy: 208, sw: 32, sh: 16 },
  } satisfies Record<BrickColor, Rect>,
} as const;

export type SpriteName = "paddle" | "ball" | `block_${BrickColor}`;

/** Resolves once the image has loaded; rejects if it fails. */
export function loadSpritesheet(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load spritesheet: ${url}`));
    img.src = url;
  });
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  frame: Rect,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.drawImage(img, frame.sx, frame.sy, frame.sw, frame.sh, x, y, w, h);
}

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  name: SpriteName,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const sp =
    name === "paddle"
      ? SPRITES.paddle
      : name === "ball"
        ? SPRITES.ball
        : SPRITES.blocks[name.slice(6) as BrickColor];
  drawFrame(ctx, img, sp, x, y, w, h);
}
