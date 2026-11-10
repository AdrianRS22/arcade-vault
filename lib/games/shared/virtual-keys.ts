/** Delay before the first auto-repeat of a held virtual key (ms). */
export const REPEAT_DELAY = 170;
/** Time between auto-repeats once they start (ms). */
export const REPEAT_INTERVAL = 50;

export type VirtualKeys = {
  /** `keydown` on window; starts auto-repeat if `code` is in `repeat`. */
  down(code: string): void;
  /** `keyup` on window once the last holder releases; stops its repeat. */
  up(code: string): void;
  /** `keyup` for every held code. */
  releaseAll(): void;
};

// `KeyboardEvent.key` for the codes games use; anything else falls back to the code.
const KEY_BY_CODE: Record<string, string> = {
  Space: " ",
  KeyB: "b",
};

type RepeatTimers = {
  delay: ReturnType<typeof setTimeout>;
  interval?: ReturnType<typeof setInterval>;
};

function dispatch(type: "keydown" | "keyup", code: string, repeat = false) {
  window.dispatchEvent(
    new KeyboardEvent(type, {
      code,
      key: KEY_BY_CODE[code] ?? code,
      repeat,
      bubbles: true,
      cancelable: true,
    }),
  );
}

/**
 * Synthetic keyboard for on-screen controls. Engines read `window` key events
 * through `createInput`, so dispatching them drives any game unchanged.
 * Each code is reference-counted: two fingers on the same code release it
 * only when the last one lifts.
 */
export function createVirtualKeys(repeat: readonly string[] = []): VirtualKeys {
  const repeating = new Set(repeat);
  const held = new Map<string, number>();
  const timers = new Map<string, RepeatTimers>();

  const stopRepeat = (code: string) => {
    const t = timers.get(code);
    if (!t) return;
    clearTimeout(t.delay);
    if (t.interval !== undefined) clearInterval(t.interval);
    timers.delete(code);
  };

  const startRepeat = (code: string) => {
    const t: RepeatTimers = {
      delay: setTimeout(() => {
        t.interval = setInterval(
          () => dispatch("keydown", code, true),
          REPEAT_INTERVAL,
        );
      }, REPEAT_DELAY),
    };
    timers.set(code, t);
  };

  return {
    down(code) {
      const count = held.get(code) ?? 0;
      held.set(code, count + 1);
      if (count > 0) return;
      dispatch("keydown", code);
      if (repeating.has(code)) startRepeat(code);
    },
    up(code) {
      const count = held.get(code) ?? 0;
      if (count === 0) return;
      if (count > 1) {
        held.set(code, count - 1);
        return;
      }
      held.delete(code);
      stopRepeat(code);
      dispatch("keyup", code);
    },
    releaseAll() {
      const codes = [...held.keys()];
      held.clear();
      for (const code of codes) {
        stopRepeat(code);
        dispatch("keyup", code);
      }
    },
  };
}
