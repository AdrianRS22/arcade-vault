const PREVENT_DEFAULT = new Set([
  "Space",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

export type Input = {
  /** Held state of each `KeyboardEvent.code`. Use for continuous actions. */
  keys: Record<string, boolean>;
  /** One-shot per press: returns true once, then false until pressed again. */
  pressed(code: string): boolean;
  /** Clears held and one-shot state (e.g. when pausing, to avoid stuck keys). */
  reset(): void;
  /** Removes the window listeners. */
  detach(): void;
};

function isTextTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  );
}

export function createInput(): Input {
  const keys: Record<string, boolean> = {};
  const justPressed: Record<string, boolean> = {};

  const onKeyDown = (e: KeyboardEvent) => {
    // Typing in the platform's inputs (e.g. initials) must not drive the game.
    if (isTextTarget(e.target)) return;
    justPressed[e.code] = !keys[e.code];
    keys[e.code] = true;
    if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
  };

  const onKeyUp = (e: KeyboardEvent) => {
    keys[e.code] = false;
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  return {
    keys,
    pressed(code) {
      const value = justPressed[code] === true;
      justPressed[code] = false;
      return value;
    },
    reset() {
      for (const code of Object.keys(keys)) keys[code] = false;
      for (const code of Object.keys(justPressed)) justPressed[code] = false;
    },
    detach() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
  };
}
