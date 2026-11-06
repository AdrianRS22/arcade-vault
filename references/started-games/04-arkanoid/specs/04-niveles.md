# SPEC 04 — Niveles

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 02
> **Fecha:** 2026-11-02
> **Objetivo:** Al romper todos los bloques se pasa al siguiente de 3 niveles con un layout distinto, mostrando "Nivel N" durante 1,5 s, y "¡Has ganado!" solo aparece al completar el tercero.

## Alcance

**Dentro:**

- 3 niveles definidos como grids de strings en un nuevo `levels.js` (script plano, global `LEVELS`), cargado en `index.html` antes de `game.js`.
- Cada carácter es un bloque: `R` red, `Y` yellow, `C` cyan, `M` magenta, `P` hotpink, `G` green; `.` es hueco. 10 columnas, hasta 6 filas, misma geometría que SPEC 01 (`BRICKS.w/h/gap/top`).
- Nivel 1 = layout actual (6 filas completas); Nivel 2 = ajedrez; Nivel 3 = marco con bloque central.
- Al romper el último bloque de un nivel (tras su última explosión, como en SPEC 02): si quedan niveles, se carga el siguiente; si era el 3, `status = 'won'`.
- Al cargar un nivel: bloques nuevos, explosiones vacías, paleta centrada, overlay "Nivel N" 1,5 s con paleta y pelota congeladas, y después el saque normal de SPEC 01.
- El overlay también aparece al empezar la partida (Nivel 1) y tras reiniciar.
- Las vidas se conservan entre niveles.
- Reiniciar tras Game Over o victoria vuelve al Nivel 1 con `START_LIVES`.
- HUD: texto "Nivel N" arriba a la izquierda durante la partida.

**Fuera de alcance (para specs futuras):**

- Aumento de velocidad u otra dificultad por nivel.
- Persistencia (nivel máximo, continuar partida).
- Selector de nivel o menú.
- Color `gray`, bloques duros o indestructibles.
- Puntuación.
- Sonido de cambio de nivel.

## Modelo de datos

```js
// levels.js — script plano, globales
const BRICK_COLORS = { R: 'red', Y: 'yellow', C: 'cyan', M: 'magenta', P: 'hotpink', G: 'green' };

const LEVELS = [
  [ // Nivel 1: filas completas (igual que SPEC 01)
    'RRRRRRRRRR',
    'YYYYYYYYYY',
    'CCCCCCCCCC',
    'MMMMMMMMMM',
    'PPPPPPPPPP',
    'GGGGGGGGGG',
  ],
  [ // Nivel 2: ajedrez
    'R.R.R.R.R.',
    '.Y.Y.Y.Y.Y',
    'C.C.C.C.C.',
    '.M.M.M.M.M',
    'P.P.P.P.P.',
    '.G.G.G.G.G',
  ],
  [ // Nivel 3: marco con bloque central
    'RRRRRRRRRR',
    'Y........Y',
    'C..CCCC..C',
    'M..MMMM..M',
    'P........P',
    'GGGGGGGGGG',
  ],
];
```

```js
// game.js — cambios
const BRICKS = { cols: 10, w: 64, h: 32, gap: 4, top: 80 }; // se elimina rows
// se elimina ROW_COLORS (lo sustituye LEVELS)
const LEVEL_INTRO = 1.5; // s

const state = {
  // ...campos de SPEC 01/02...
  level: 0,        // índice en LEVELS (0-based); el HUD muestra level + 1
  levelIntro: 0,   // s restantes del overlay "Nivel N"; > 0 => todo congelado
};

function createBricks(levelIndex) { /* recorre LEVELS[levelIndex]; fila r, columna c; ignora '.' */ }
function loadLevel(levelIndex) { /* level, bricks, explosions = [], paddle centrada, levelIntro = LEVEL_INTRO, startServe() */ }
```

Convenciones:

- `state.level` es 0-based; el texto mostrado es `level + 1`.
- Un carácter que no está en `BRICK_COLORS` (incluido `.`) es hueco.
- Posición de cada bloque: igual que SPEC 01 (`left + c * (w + gap)`, `top + r * (h + gap)`), con `left` calculado sobre `BRICKS.cols`.
- No hay nuevo valor de `status`: la transición se detecta con `levelIntro > 0`.
- Sin persistencia.

## Plan de implementación

1. Crear `levels.js` con `BRICK_COLORS` y `LEVELS`; cargarlo en `index.html` antes de `game.js`. Cambiar `createBricks()` a `createBricks(levelIndex)` leyendo `LEVELS`, añadir `state.level = 0` y eliminar `ROW_COLORS` y `BRICKS.rows`. Prueba: el juego carga sin errores y se ve igual que antes (Nivel 1 = layout actual).
2. Añadir `loadLevel(levelIndex)`. En la rama "sin bloques vivos" de `update()`, cuando `state.explosions` queda vacío: si `state.level < LEVELS.length - 1`, `loadLevel(state.level + 1)`; si no, `status = 'won'`. `restartGame()` restablece vidas y llama a `loadLevel(0)`. Prueba: al limpiar el Nivel 1 aparece el layout del Nivel 2 con las mismas vidas; al limpiar el 3 aparece "¡Has ganado!".
3. Overlay de nivel: `LEVEL_INTRO`, `state.levelIntro` fijado en `loadLevel`; en `update()`, si `levelIntro > 0`, restarle `dt` y salir sin actualizar nada más. En `render()`, si `status === 'playing'` y `levelIntro > 0`, dibujar el overlay semitransparente con "Nivel N". La partida inicial arranca con `loadLevel(0)`. Prueba: al empezar y al pasar de nivel se ve "Nivel N" 1,5 s con todo quieto, y después empieza el saque de 1 s.
4. HUD: dibujar "Nivel N" arriba a la izquierda. Prueba: el texto coincide con el nivel actual durante la partida.

## Criterios de aceptación

- [x] El juego carga sin errores en consola con `file://`.
- [x] El Nivel 1 tiene el mismo layout que antes de esta spec (6 filas completas de 10).
- [x] Al romper el último bloque del Nivel 1, tras su explosión, se carga el layout del Nivel 2 (ajedrez).
- [x] Al romper el último bloque del Nivel 2 se carga el Nivel 3 (marco).
- [x] "¡Has ganado!" solo aparece al completar el Nivel 3.
- [x] Al empezar la partida y en cada cambio de nivel se ve "Nivel N" durante 1,5 s, con paleta y pelota quietas.
- [x] Tras el overlay, la pelota espera 1 s sobre la paleta centrada y se lanza (saque de SPEC 01).
- [x] Las vidas restantes al completar un nivel son las mismas al empezar el siguiente.
- [x] Al pasar de nivel no queda ninguna explosión del nivel anterior en pantalla.
- [x] Reiniciar tras Game Over o victoria vuelve al Nivel 1 con 3 vidas.
- [x] El HUD muestra "Nivel N" arriba a la izquierda, con el número correcto.
- [x] La velocidad de la pelota es la misma en los 3 niveles.

## Decisiones

- **Sí:** 3 niveles. Suficiente para validar la progresión; añadir más es solo editar `levels.js`.
- **Sí:** grid de strings con una letra por color. Legible y editable a mano.
- **No:** lista de colores por fila o lista de objetos `{col, row, color}`. Menos variedad o menos legible.
- **Sí:** `levels.js` aparte, script plano con globales, como `assets/spritesheet.js`. Separa datos de lógica sin módulos.
- **No:** `LEVELS` dentro de `game.js`.
- **Sí:** solo cambia el layout; misma velocidad. Dificultad progresiva en una spec futura.
- **Sí:** overlay "Nivel N" 1,5 s con todo congelado, seguido del saque normal. Sin input extra.
- **No:** pantalla "pulsa para continuar" ni cambio inmediato sin aviso.
- **Sí:** el overlay también se muestra en el Nivel 1 (inicio y reinicio), porque todo pasa por `loadLevel`. Un solo camino de carga.
- **Sí:** las vidas se conservan entre niveles.
- **Sí:** reinicio desde el Nivel 1.
- **No:** persistencia entre sesiones.
- **No:** color `gray`. Su explosión reutiliza los frames rojos.
- **No:** nuevo `status`; basta `levelIntro > 0`.
- **Sí:** paleta centrada al cargar un nivel, igual que en `restartGame()`.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Una fila con más de 10 caracteres saldría del canvas | Se documenta el límite de 10 columnas en `levels.js`; revisar al editar layouts. |
| Un nivel sin bloques válidos pasaría al siguiente al instante | Los 3 layouts tienen bloques; un nivel vacío no está soportado. |
| `levels.js` no cargado antes de `game.js` → `LEVELS is not defined` | Orden de `<script>` fijado en el paso 1. |
| Eliminar `ROW_COLORS`/`BRICKS.rows` rompe referencias | Solo los usa `createBricks`; se revisa con búsqueda en el paso 1. |

## Lo que **no** está en esta spec

- Dificultad progresiva.
- Persistencia y selector de nivel.
- Bloques grises, duros o indestructibles.
- Puntuación y sonido de cambio de nivel.

Cada uno, si llega, irá en su propia spec.
