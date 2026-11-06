# SPEC 03 — Sonidos de rebote y rotura

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 02
> **Fecha:** 2026-11-02
> **Objetivo:** Reproducir `ball-bounce.mp3` cada vez que la pelota rebota en la paleta y `break-sound.mp3` cada vez que un bloque se rompe y se crea su explosión.

## Alcance

**Dentro:**

- `ball-bounce.mp3` suena cuando la pelota rebota en la paleta (la rama de colisión con paleta de `updateBall`).
- `break-sound.mp3` suena en el mismo punto en que se hace `state.explosions.push(...)` (un bloque pasa a `alive = false`).
- Los sonidos se superponen: cada reproducción usa un clon del `Audio` base, así dos roturas seguidas se oyen ambas.
- Volumen por defecto del navegador.
- Si el navegador rechaza `play()` (política de autoplay, archivo ausente), se ignora sin error en consola ni interrupción del juego.
- Archivos cargados desde `assets/sounds/` con ruta relativa (funciona con `file://`).

**Fuera de alcance (para specs futuras):**

- Sonido en paredes laterales, techo, pérdida de vida, victoria o Game Over.
- Control de mute o volumen.
- Música de fondo.
- Pantalla "Pulsa para empezar" para desbloquear el audio.
- Web Audio API / precarga con `AudioContext`.

## Modelo de datos

```js
// game.js — constantes nuevas
const SOUNDS = {
  bounce: new Audio('assets/sounds/ball-bounce.mp3'),
  break: new Audio('assets/sounds/break-sound.mp3'),
};

function playSound(name) {
  const s = SOUNDS[name].cloneNode();
  s.play().catch(() => {}); // autoplay bloqueado u otro fallo: se ignora
}
```

Convenciones:

- `SOUNDS` es inmutable tras crearse; no se añade nada a `state`.
- Claves: `bounce`, `break`. Se llama `playSound('bounce')` / `playSound('break')`.
- Sin persistencia.

## Plan de implementación

1. Añadir `SOUNDS` y `playSound(name)` en `game.js` junto a las constantes. Prueba: el juego carga sin errores; en consola `playSound('break')` (tras hacer clic en la página) suena.
2. Llamar a `playSound('bounce')` dentro del `if` de colisión con la paleta en `updateBall`. Prueba: tras pulsar una tecla o hacer clic, cada rebote en la paleta suena; los rebotes en paredes y techo no.
3. Llamar a `playSound('break')` justo después de `state.explosions.push(...)`. Prueba: cada bloque roto suena; dos roturas seguidas se oyen las dos superpuestas.

## Criterios de aceptación

- [x] El juego carga sin errores en consola con `file://`.
- [x] Cada rebote de la pelota en la paleta reproduce `ball-bounce.mp3` exactamente una vez.
- [x] Los rebotes en paredes laterales y techo no reproducen sonido.
- [x] Cada bloque roto reproduce `break-sound.mp3` exactamente una vez, al aparecer su explosión.
- [x] Dos bloques rotos en rápida sucesión se oyen ambos (el segundo no corta al primero).
- [x] El saque (pelota pegada a la paleta) no reproduce `ball-bounce.mp3`.
- [x] Antes de la primera interacción del usuario no aparece ningún error en consola por `play()` rechazado.
- [x] Renombrar temporalmente un mp3 no rompe el juego (solo falta ese sonido).

## Decisiones

- **Sí:** rebote solo con la paleta. Es lo pedido; paredes y techo serían ruido constante.
- **No:** sonido en paredes/techo.
- **Sí:** `cloneNode()` por reproducción para permitir superposición. Simple y suficiente para dos sonidos cortos.
- **No:** un único `Audio` con `currentTime = 0`. Corta el sonido anterior en roturas seguidas.
- **No:** Web Audio API. Más precisa pero añade complejidad innecesaria para dos efectos.
- **Sí:** ignorar el rechazo de `play()` con `.catch(() => {})`. Los sonidos empiezan tras la primera tecla o clic.
- **No:** pantalla "Pulsa para empezar". Cambiaría el flujo de saque de SPEC 01.
- **No:** mute/volumen en esta spec.
- **Sí:** reproducir el sonido de rotura en el mismo punto que crea la explosión, para que audio y animación arranquen juntos.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Política de autoplay: sin interacción previa los primeros rebotes no suenan (mover el ratón no cuenta como interacción) | Aceptado; se ignora el rechazo. Basta una tecla o clic. |
| `cloneNode()` puede tener una pequeña latencia la primera vez | Los `Audio` base se crean al cargar el script, lo que precarga los archivos. |
| Muchas roturas seguidas crean muchos elementos `Audio` | Como máximo uno por frame (un bloque por frame); el GC los recoge al terminar. |

## Lo que **no** está en esta spec

- Sonidos de paredes, vidas, victoria o derrota.
- Mute y volumen.
- Música de fondo.

Cada uno, si llega, irá en su propia spec.
