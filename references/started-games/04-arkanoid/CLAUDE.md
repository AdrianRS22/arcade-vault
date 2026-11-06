# CLAUDE.md

Este archivo proporciona orientación a Claude Code (claude.ai/code) al trabajar con el código de este repositorio.

## Proyecto

Juego Arkanoid en HTML, CSS y JavaScript puros — **cero dependencias, sin paso de build, sin gestor de paquetes**. No hay suite de tests ni configuración de lint: no inventes comandos de build/test. El juego se abre directamente con `index.html` (`file://`) o con cualquier servidor de archivos estáticos.

El juego **ya está implementado** (specs 01–04, ver más abajo). Repositorio git, rama `master`; los commits siguen el patrón `Paso N spec NN: <resumen>` (un commit por paso del plan). Claude nunca hace commit automáticamente; los commits los decide el usuario.

Idioma: responde siempre al usuario en español.

## Estructura del código

Todo son scripts planos (sin módulos ES) para que funcione con `file://`. Orden de carga en `index.html`: `assets/spritesheet.js` → `levels.js` → `game.js`.

- `index.html` — un `<canvas id="game" width="800" height="600">` y los tres scripts.
- `style.css` — estilos de la página.
- `levels.js` — `BRICK_COLORS` (letra → color) y `LEVELS` (3 niveles como arrays de strings de 10 columnas; `.` = hueco). Para añadir/cambiar niveles se edita solo este archivo.
- `game.js` — lógica y render. Constantes de ajuste arriba (`PADDLE`, `BALL`, `BRICKS`, `START_LIVES`, `SERVE_DELAY`, `MAX_DT`, `LEVEL_INTRO`), `SOUNDS`/`playSound`, el objeto mutable `state` (`status`: `'playing' | 'won' | 'lost'`, `level`, `levelIntro`, `lives`, `serveTimer`, `paddle`, `ball`, `bricks`, `explosions`, `input`) y las funciones `createBricks(levelIndex)`, `updatePaddle`, `updateBall`, `loadLevel`, `restartGame`, `updateExplosions`, `update(dt)`, `render()`, `frame` y `start()`. El game loop arranca desde el callback de `loadSpritesheet`.
- `assets/` — `spritesheet-breakout.png`, `spritesheet.js` y `sounds/` (`ball-bounce.mp3`, `break-sound.mp3`). Las rutas son relativas (`assets/spritesheet-breakout.png` está fija en `spritesheet.js`).

### API de `assets/spritesheet.js`

Define globales: `SPRITES` (paleta, pelota, bloques por color: gray, red, yellow, cyan, magenta, hotpink, green), `EXPLOSION_FRAMES` (4 frames por color, `EXPLOSION_DURATION = 150` ms; `gray` reutiliza los de red), `loadSpritesheet(cb)`, `drawFrame(ctx, frame, x, y, w, h)` y `drawSprite(ctx, name, x, y, w, h)` (los bloques llevan prefijo `block_`, p. ej. `block_red`). Dibujar antes de que cargue la imagen no hace nada (sin error).

`.claude/skills/assets/` conserva la copia original de los assets; el juego usa `assets/`.

## Flujo de trabajo guiado por specs (spec-driven development)

Todo cambio de comportamiento pasa por una spec. Skills en `.claude/skills/` y `.agents/skills/` (instaladas desde `Klerith/fernando-skills`, fijadas en `skills-lock.json`):

1. `/spec <descripción>` — entrevista al usuario y escribe `specs/NN-slug.md`. **No escribe código.** Plantilla en `.claude/skills/spec/template.md`. Config en `specs/.spec-config.yml` (`AutoCreateBranch: true`).
2. El humano revisa la spec y cambia el estado de `Borrador` a `Aprobado` **manualmente** (Claude nunca lo hace).
3. `/spec-impl NN-slug` — solo corre si el estado equivale a "Aprobado". Crea la rama `spec-NN-slug` e implementa **un paso del plan a la vez**, pausando para revisar el diff. Al terminar todos los pasos y verificar los criterios, marca la spec como `Implementado`. Los cambios fuera de alcance van a una spec futura, no se cuelan en la actual.

Ciclo de estados: `Borrador → Aprobado → Implementado` (también `En revisión`, `Obsoleto`). Las skills son agnósticas al idioma; respeta el idioma y los encabezados de las specs existentes (en español).

### Formato de las specs (`specs/NN-slug.md`)

Numeración consecutiva (`01-mvp-jugable`, `02-explosion-bloques`, `03-sonidos-rebote-rotura`, `04-niveles`). Cada una empieza con `# SPEC NN — Título` y un bloque con **Estado**, **Depende de**, **Fecha** y **Objetivo**, seguido de las secciones:

`Alcance` (dentro / fuera) · `Modelo de datos` · `Plan de implementación` (pasos numerados, cada uno con su "Prueba") · `Criterios de aceptación` (checklist `- [x]` / `- [ ]`) · `Decisiones` · `Riesgos` · `Lo que **no** está en esta spec`.

### Al escribir o implementar una spec

- Lee las specs previas de las que depende: describen el modelo de datos y las convenciones vigentes (p. ej. `state`, posiciones de bloques, `levelIntro`).
- Implementa con scripts planos y sin dependencias; no introduzcas build, módulos ni librerías.
- Un paso del plan = un diff revisable = un commit (`Paso N spec NN: ...`) cuando el usuario lo decida.
- Marca los criterios de aceptación como `[x]` solo tras comprobarlos de verdad (el juego carga sin errores en consola con `file://`, etc.).
- La próxima spec debe tomar el siguiente número libre en `specs/`.
