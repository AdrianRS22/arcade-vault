import { CELL } from "./constants";
import type { Cell } from "./types";

export type FruitSprite = {
  name: string;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
};

const fruit = (name: string, sx: number, sw: number): FruitSprite => ({
  name,
  sx,
  sy: 136,
  sw,
  sh: 160,
});

/**
 * Pixel-art row of `fruits.png`. Rectangles come from the reference
 * `sprites.js`; its labels were shifted against the image, so the names here
 * are the ones the image actually shows.
 */
export const FRUIT_SPRITES: readonly FruitSprite[] = [
  fruit("apple", 34, 110),
  fruit("banana", 186, 150),
  fruit("pineapple", 378, 110),
  fruit("grape", 540, 130),
  fruit("pumpkin", 712, 130),
  fruit("turnip", 894, 110),
  fruit("eggplant", 1066, 110),
  fruit("strawberry", 1228, 130),
  fruit("cherry", 1400, 130),
  fruit("carrot", 1582, 110),
  fruit("mushroom", 1734, 150),
  fruit("broccoli", 1906, 150),
  fruit("watermelon", 2068, 170),
  fruit("pepper", 2250, 140),
  fruit("kiwi", 2432, 130),
  fruit("lemon", 2604, 130),
  fruit("orange", 2786, 110),
  fruit("peach", 2948, 130),
  fruit("peanut", 3110, 150),
  fruit("raspberry", 3302, 110),
  fruit("tomato", 3454, 150),
  fruit("salad", 3637, 130),
];

/** Resolves once the image has loaded; rejects if it fails. */
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

/** Draws a fruit scaled to fit inside the grid cell, keeping its aspect ratio. */
export function drawFruit(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  sprite: number,
  cell: Cell,
): void {
  const sp = FRUIT_SPRITES[sprite];
  if (!sp) return;
  const scale = Math.min(CELL / sp.sw, CELL / sp.sh);
  const dw = sp.sw * scale;
  const dh = sp.sh * scale;
  const dx = cell.x * CELL + (CELL - dw) / 2;
  const dy = cell.y * CELL + (CELL - dh) / 2;
  ctx.drawImage(img, sp.sx, sp.sy, sp.sw, sp.sh, dx, dy, dw, dh);
}
