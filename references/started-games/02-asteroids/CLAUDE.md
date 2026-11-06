# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

No build, bundler, package manager, test suite, or linter is configured. Nothing needs to be installed.

- Run: open `index.html` directly in a browser, or serve the folder with `npx serve .` and visit `http://localhost:3000`.
- There are no tests or lint commands to run. Verify changes by playing the game in the browser.

## Architecture

The whole game is a single script, `game.js`, loaded by `index.html` (which also holds the canvas element and page styles). The game runs in a single 800×600 `<canvas>`. Everything is plain ES6 with no modules, so it is all global scope inside a `'use strict'` file.

`game.js` is organized into sections, in order: Input, Utils, Bullet, Asteroid, Ship, Particle, Game state, Update, Draw, and the main loop.

- **Game loop:** `loop(ts)` computes `dt` in seconds (capped at 0.05 s to avoid large jumps after tab switches), then calls `update(dt)` and `draw()` once per `requestAnimationFrame`. Every entity uses `dt`-scaled motion, so speeds are in px/s (and px/s² for thrust).
- **Game state machine:** a global `state` is one of `'playing'`, `'dead'`, or `'gameover'`. `update()` branches on it first. `'dead'` is entered by `killShip()` when lives remain. It keeps asteroids moving for a 2 s `deadTimer`, then calls `ship.reset()` and returns to `'playing'`. `'gameover'` waits for Space to call `initGame()`.
- **Input:** `keys` holds the held state of each `e.code`. `justPressed` is set on keydown and read through `pressed(code)`, which clears it on read, so it is one-shot per press. Use `pressed()` for discrete actions and `keys[...]` for continuous ones. Arrow keys and Space have their default browser behavior suppressed.
- **Entities** are plain classes with `update(dt)`, `draw()`, and a `dead` flag. The arrays (`bullets`, `asteroids`, `particles`) are re-filtered after each update by removing `dead` items. Collisions are circle-based: bullet vs asteroid uses `dist < a.radius`, and ship vs asteroid uses `ship.radius + a.radius * 0.82`.
- **Asteroid splitting:** `Asteroid.split()` returns two smaller asteroids (size 3 → 2 → 1) at the parent's position. These new asteroids are concatenated into the array after the bullet-collision pass, not during it. Size index drives `RADII`, `SPEEDS`, and `POINTS` (the lookup tables at the top of the Asteroid section).
- **Wrapping:** the play field is a torus. Ships, bullets, and asteroids use `wrap()` on both axes. Particles do not wrap.
- **Level and respawn:** when `asteroids.length === 0`, `nextLevel()` increments `level`, resets the ship, and spawns `3 + level` large asteroids. Spawns keep a 130 px safe radius around the center. After a death the ship is invincible for 3 s (it blinks), which is set in `Ship.reset()`.
- **Drawing** uses `ctx.save()/restore()` around each entity's transform. All colors are white or the thruster orange. Text uses the `monospace` font.

## Notes

- `README.md` is in Spanish and describes the game. Its "Descripción del juego" section still mentions power-ups and a shooting star. Those were removed in commit `13e713f`, so that text is stale. The controls, scoring table, and features it lists match the code.
- UI text in the game (HUD, game-over overlay) is in Spanish, and code comments are mostly Spanish. Keep new text consistent with the surrounding language.
