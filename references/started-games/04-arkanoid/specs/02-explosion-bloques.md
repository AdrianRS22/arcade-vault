# SPEC 02 — Explosión animada de bloques

> **Estado:** Implementado
> **Depende de:** SPEC 01
> **Fecha:** 2026-11-02
> **Objetivo:** Al romper un bloque se reproduce en su lugar una animación de explosión de 4 frames del color del bloque, y la victoria se muestra cuando termina la última explosión.

## Alcance

**Dentro:**

- Al pasar un bloque a `alive = false` se crea una explosión en su posición con su color.
- Animación con `EXPLOSION_FRAMES[color]` (4 frames) de `assets/spritesheet.js`, 150 ms por frame (`EXPLOSION_DURATION`), 600 ms en total.
- La explosión se dibuja al tamaño del bloque (64×32) con `drawFrame`.
- La explosión es solo visual: el bloque deja de colisionar en el momento del golpe, como en SPEC 01.
- Varias explosiones simultáneas e independientes.
- Al romper el último bloque, pelota y paleta se congelan y "¡Has ganado!" aparece cuando terminan todas las explosiones.
- Con Game Over las explosiones en curso se congelan bajo el overlay.
- El reinicio vacía las explosiones.

**Fuera de alcance (para specs futuras):**

- Sonido `break-sound.mp3` al romper (irá en la spec de sonidos junto a `ball-bounce.mp3`).
- Partículas, screen shake u otros efectos.
- Puntuación.
- Bloques duros con varios golpes o animación de "daño".

## Modelo de datos

```js
// game.js — estado mutable (nuevo campo)
const state = {
  // ...campos de SPEC 01...
  explosions: [ /* { x, y, color, t } */ ],
};
```

Convenciones:

- `x`, `y`: esquina superior izquierda del bloque destruido, en px lógicos.
- `color`: el `color` del bloque (clave de `EXPLOSION_FRAMES`).
- `t`: tiempo transcurrido en ms desde que empezó la explosión.
- Frame actual: `Math.floor(t / EXPLOSION_DURATION)`; la explosión se elimina cuando el índice llega a `EXPLOSION_FRAMES[color].length` (4).
- `dt` del loop está en segundos; se suma `dt * 1000` a `t`.
- No se usa un nuevo valor de `status`: la fase "último bloque roto, esperando explosión" se detecta con "no quedan bloques vivos y `state.explosions.length > 0`".

## Plan de implementación

1. Añadir `explosions: []` a `state` y crear la explosión `{ x: b.x, y: b.y, color: b.color, t: 0 }` donde el bloque pasa a `alive = false`. Añadir `updateExplosions(dt)` (avanza `t`, elimina las terminadas) llamada desde `update()`. Prueba: en consola, `state.explosions` crece al romper un bloque y vuelve a vaciarse ~600 ms después.
2. Dibujar en `render()` cada explosión con `drawFrame(ctx, EXPLOSION_FRAMES[e.color][frame], e.x, e.y, BRICKS.w, BRICKS.h)`, después de los bloques y antes de paleta/pelota. Prueba: al romper un bloque se ve la explosión de su color en su sitio durante ~600 ms.
3. Retrasar la victoria: quitar el chequeo de victoria de `updateBall`; en `update()`, si no quedan bloques vivos, no actualizar paleta ni pelota, solo explosiones, y pasar a `status = 'won'` cuando `state.explosions` esté vacío. Prueba: al romper el último bloque la pelota se congela, se ve la explosión y luego aparece "¡Has ganado!".
4. Reinicio: `restartGame()` vacía `state.explosions`. Prueba: perder con explosiones en curso (quedan congeladas bajo "Game Over") y reiniciar; no queda ninguna explosión en pantalla.

## Criterios de aceptación

- [x] El juego carga sin errores en consola con `file://`.
- [x] Romper un bloque muestra en su posición una animación de 4 frames del mismo color que el bloque.
- [x] La animación dura 600 ms (150 ms por frame) y después desaparece del todo.
- [x] La pelota atraviesa la zona de un bloque que está explotando sin rebotar en él.
- [x] Dos bloques rotos en rápida sucesión muestran dos explosiones simultáneas e independientes.
- [x] Al romper el último bloque, pelota y paleta quedan quietas y "¡Has ganado!" aparece solo cuando termina la explosión.
- [x] Entre el último golpe y "¡Has ganado!" no se puede perder una vida.
- [x] Con "Game Over" las explosiones en curso quedan congeladas bajo el overlay.
- [x] Tras reiniciar (Espacio o clic) `state.explosions` está vacío y no se ve ninguna explosión.
- [x] La duración de la animación es la misma en monitores de 60 Hz y 144 Hz.

## Decisiones

- **Sí:** 150 ms por frame (600 ms total). 150 ms en total (~37 ms/frame) sería casi imperceptible.
- **Sí:** la explosión es solo visual; el bloque deja de colisionar al golpearlo. No altera la física de SPEC 01.
- **No:** bloque sólido hasta acabar la animación. Cambia la jugabilidad y complica la colisión.
- **Sí:** array aparte `state.explosions`. Desacopla lo visual de los bloques y sirve de base para otros efectos.
- **No:** campo `explodeT` en cada bloque. Mezcla estado de juego y de animación.
- **Sí:** victoria al terminar la última explosión, con pelota y paleta congeladas. Se ve la explosión final y no se puede perder después de ganar.
- **No:** nuevo `status` intermedio. Basta con "sin bloques vivos y con explosiones pendientes".
- **Sí:** con Game Over las explosiones se congelan. `update()` ya no corre fuera de `'playing'`; sin casos especiales.
- **No:** sonido de rotura en esta spec. Va en la spec de sonidos.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| `EXPLOSION_FRAMES.gray` reutiliza los frames de `red` | Ninguna fila usa `gray` en el nivel actual; aceptado. |
| Los frames de explosión (32×16) se escalan ×2 a 64×32 y pueden verse borrosos | Mismo escalado que los bloques; si molesta, `ctx.imageSmoothingEnabled = false` en una spec visual futura. |
| Un `t` acumulado tras cambiar de pestaña salta frames | `dt` ya está limitado a 1/30 s por SPEC 01. |

## Lo que **no** está en esta spec

- Sonidos de rotura y rebote.
- Partículas, screen shake u otros efectos.
- Puntuación.
- Bloques duros y animaciones de daño.

Cada uno, si llega, irá en su propia spec.
