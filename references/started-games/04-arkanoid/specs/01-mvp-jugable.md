# SPEC 01 — MVP jugable de Arkanoid

> **Estado:** Implementado
> **Depende de:** —
> **Fecha:** 2026-11-02
> **Objetivo:** Un nivel de Arkanoid jugable en el navegador con paleta, pelota, muro de bloques, 3 vidas y pantallas de victoria/derrota con reinicio.

## Alcance

**Dentro:**

- `index.html`, `style.css` y `game.js` en la raíz, como scripts planos (sin módulos ES) para que funcione abriendo `index.html` con `file://`.
- Copia de los assets de `.claude/skills/assets/` a `assets/` (`spritesheet-breakout.png`, `spritesheet.js`, `sounds/`), sin los `.DS_Store` y sin tocar el original.
- Canvas lógico fijo 800×600, centrado y escalado por CSS manteniendo proporción.
- Game loop con `requestAnimationFrame` y delta time (velocidades en px/s), arrancado desde el callback de `loadSpritesheet`.
- Paleta controlada con flechas ←/→, A/D y con el ratón sobre el canvas.
- Pelota con rebote en paredes laterales, techo, paleta (reflexión simple) y bloques.
- Un nivel fijo: 6 filas × 10 columnas, un color por fila, 1 golpe por bloque.
- 3 vidas mostradas en un HUD dentro del canvas.
- Saque automático: la pelota reposa sobre la paleta y se lanza sola tras 1 s (al empezar y tras perder vida).
- Al romper todos los bloques: mensaje de victoria. Con 0 vidas: mensaje de derrota. Espacio o clic reinicia la partida.

**Fuera de alcance (para specs futuras):**

- Puntuación y high-scores.
- Sonidos (`ball-bounce.mp3`, `break-sound.mp3`).
- Animación de explosión (`EXPLOSION_FRAMES`).
- Pantalla de inicio y pausa.
- Ángulo de rebote según el punto de impacto en la paleta.
- Varios niveles, bloques duros, power-ups.
- Soporte táctil/móvil.

## Modelo de datos

```js
// game.js — constantes
const WIDTH = 800, HEIGHT = 600;
const PADDLE = { w: 120, h: 16, y: 560, speed: 600 };   // px, px/s
const BALL = { size: 16, speed: 360 };                   // px, px/s
const BRICKS = { rows: 6, cols: 10, w: 64, h: 32, gap: 4, top: 80 };
const ROW_COLORS = ['red', 'yellow', 'cyan', 'magenta', 'hotpink', 'green'];
const START_LIVES = 3;
const SERVE_DELAY = 1; // s

// Estado mutable
const state = {
  status: 'playing',          // 'playing' | 'won' | 'lost'
  lives: 3,
  serveTimer: 1,              // s restantes; > 0 => pelota pegada a la paleta
  paddle: { x: 340 },         // borde izquierdo
  ball: { x: 0, y: 0, vx: 0, vy: 0 },   // esquina superior izquierda, px/s
  bricks: [ /* { x, y, color, alive } */ ],
  input: { left: false, right: false, mouseX: null },
};
```

Convenciones:

- Origen arriba-izquierda; posiciones en px lógicos del canvas 800×600.
- Velocidades en px/s; `dt` en segundos, limitado a 1/30 s para evitar túneles tras cambiar de pestaña.
- Bloques centrados horizontalmente: margen izquierdo = (800 − (10·64 + 9·4)) / 2 = 62.
- Saque: dirección fija 45° hacia arriba-derecha (`vx = +speed·cos45`, `vy = −speed·sin45`).
- Ratón: `mouseX` se convierte de px de pantalla a px lógicos con `getBoundingClientRect()`; la paleta centra su x en él.
- Sprites con `drawSprite(ctx, 'paddle' | 'ball' | 'block_<color>', x, y, w, h)` de `assets/spritesheet.js`.

## Plan de implementación

1. Copiar `spritesheet-breakout.png`, `spritesheet.js` y `sounds/*.mp3` a `assets/`. Crear `index.html` (canvas `#game` 800×600, carga `assets/spritesheet.js` y luego `game.js`), `style.css` (fondo negro, canvas centrado, escalado con `max-width/max-height` y `aspect-ratio`) y `game.js` con `loadSpritesheet(start)` y un loop que limpia el canvas. Prueba: abrir `index.html`, ver canvas negro centrado, consola sin errores.
2. Generar `state.bricks` (6×10, un color por fila) y dibujarlos. Prueba: se ve el muro de 60 bloques.
3. Paleta: dibujo, input de teclado (keydown/keyup) y ratón (mousemove), limitada a los bordes. Prueba: se mueve con ←/→, A/D y ratón sin salirse.
4. Pelota: saque automático tras 1 s, movimiento con `dt`, rebote en paredes, techo y paleta (`vy = −|vy|`). Si cae por abajo, vuelve a saque (sin vidas aún). Prueba: rebota y vuelve a la paleta al caer.
5. Colisión pelota–bloque (AABB; invierte `vx` o `vy` según el eje de menor penetración; máximo un bloque por frame); el bloque pasa a `alive = false`. Prueba: los bloques desaparecen al golpearlos.
6. Vidas: restar al caer la pelota, HUD "Vidas: N" arriba-izquierda. Prueba: tras 3 caídas el contador llega a 0.
7. Estados `won`/`lost`: overlay con "¡Has ganado!" / "Game Over" y "Pulsa Espacio o haz clic para reiniciar"; el reinicio restaura bloques, vidas y saque. Prueba: ganar, perder y reiniciar.

## Criterios de aceptación

- [x] Abrir `index.html` con doble clic (`file://`) carga el juego sin errores en consola.
- [x] Existen `assets/spritesheet-breakout.png`, `assets/spritesheet.js`, `assets/sounds/ball-bounce.mp3` y `assets/sounds/break-sound.mp3`; `.claude/skills/assets/` sigue intacto.
- [x] El canvas mide 800×600 lógicos y se escala sin deformarse al redimensionar la ventana.
- [x] Se ven 60 bloques en 6 filas, cada fila de un color distinto.
- [x] La paleta se mueve con ←/→, con A/D y siguiendo el ratón, y nunca sale del canvas.
- [x] La pelota se lanza sola 1 s después de empezar y tras perder una vida.
- [x] La pelota rebota en paredes laterales, techo y paleta, y nunca sale por arriba ni por los lados.
- [x] Un golpe a un bloque lo elimina y la pelota rebota.
- [x] Perder la pelota por abajo resta exactamente 1 vida y el HUD lo refleja.
- [x] Con 0 vidas aparece "Game Over"; al romper los 60 bloques aparece "¡Has ganado!".
- [x] En ambas pantallas finales, Espacio o clic reinicia con 3 vidas y los 60 bloques.
- [x] La velocidad de la pelota es la misma en monitores de 60 Hz y 144 Hz.

## Decisiones

- **Sí:** scripts planos en 3 archivos. Funciona con `file://` y es coherente con `spritesheet.js` (globales).
- **No:** módulos ES. Exigen servidor estático.
- **Sí:** copiar assets, no moverlos. No rompe nada que dependa de la ubicación original.
- **Sí:** 800×600 fijo con escalado CSS. Disposición de bloques simple y predecible.
- **Sí:** delta time en px/s. Misma velocidad en cualquier tasa de refresco.
- **Sí:** reflexión simple en la paleta (elección del usuario). Más fácil de implementar.
- **No:** ángulo según punto de impacto. Se deja para una spec futura.
- **Sí:** flujo mínimo: arranca directamente, saque automático, solo pantallas finales.
- **No:** pantalla de inicio ni pausa.
- **No:** puntuación, sonidos y explosiones en el MVP. Cada uno irá en su propia spec.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Con reflexión simple y saque fijo a 45° la trayectoria es repetitiva y la pelota puede quedar en bucle sin tocar bloques | Aceptado en el MVP; la spec de ángulo de rebote lo resuelve. |
| Túnel de la pelota a través de bloques con `dt` grande | `dt` limitado a 1/30 s; a 360 px/s el avance máximo (12 px) es menor que el alto del bloque (32 px). |
| Navegadores que bloquean `file://` para imágenes en canvas | `drawImage` sobre canvas funciona con `file://` (no se lee píxel a píxel); si fallase, usar cualquier servidor estático. |

## Lo que **no** está en esta spec

- Puntuación y high-scores.
- Sonidos y animación de explosión.
- Pantalla de inicio y pausa.
- Ángulo de rebote variable.
- Varios niveles, bloques duros y power-ups.
- Controles táctiles.

Cada uno, si llega, irá en su propia spec.
