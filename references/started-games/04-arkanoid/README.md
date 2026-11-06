# Juego de Arkanoid

Arkanoid hecho con HTML, CSS y JavaScript puros: **cero dependencias, sin build y sin gestor de paquetes**. Cualquiera puede jugarlo abriendo `index.html` en el navegador (o sirviendo la carpeta con cualquier servidor estático).

## Cómo jugar

- **Mover la paleta:** flechas `←` / `→`, teclas `A` / `D`, o el ratón sobre el canvas.
- **Reiniciar** tras ganar o perder: `Espacio` o clic en el canvas.
- Tienes 3 vidas. Rompe todos los bloques de cada nivel para pasar al siguiente; al completar el tercero ganas.

## Estado del proyecto

Implementado (specs 01–04 en `specs/`):

1. **MVP jugable** — paleta, pelota, muro de bloques, 3 vidas y pantallas de victoria/derrota.
2. **Explosión de bloques** — animación de 4 frames al romper un bloque.
3. **Sonidos** — rebote en la paleta y rotura de bloques.
4. **Niveles** — 3 niveles con layouts distintos, overlay "Nivel N" y HUD con el nivel actual.

## Estructura

```
index.html      canvas y carga de scripts
style.css       estilos
levels.js       definición de los niveles (LEVELS, BRICK_COLORS)
game.js         lógica, game loop y render
assets/         spritesheet y sonidos
specs/          especificaciones del proyecto (NN-slug.md)
```

## Flujo de trabajo (spec-driven development)

El desarrollo se guía por specs (skills en `.claude/skills/` y `.agents/skills/`):

1. `/spec <descripción>`: genera `specs/NN-slug.md` tras aclarar dudas. No escribe código.
2. Revisar la spec y cambiar su estado a `Aprobado` manualmente.
3. `/spec-impl NN-slug`: crea la rama `spec-NN-slug` e implementa la spec paso a paso, con pausas para revisar cada diff. Al terminar marca la spec como `Implementado`.

Estados: `Borrador → Aprobado → Implementado`. Los commits siguen el patrón `Paso N spec NN: <resumen>`.

## Idioma y control de versiones

- Las respuestas de Claude en este proyecto son siempre en español.
- Repositorio git (rama `master`). Claude nunca hace commits automáticamente; los decide el usuario.

Más detalles para Claude Code en `CLAUDE.md`.
