"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { TouchDir, TouchLayout } from "@/lib/games/registry";
import { createVirtualKeys } from "@/lib/games/shared/virtual-keys";

type TouchControlsProps = {
  layout: TouchLayout;
  /** `paused || over`: releases every held key and ignores new touches. */
  disabled: boolean;
};

const DIR_CODE: Record<TouchDir, string> = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
};

const DIR_LABEL: Record<TouchDir, string> = {
  up: "Up",
  down: "Down",
  left: "Left",
  right: "Right",
};

// Triangle pointing up; the other arrows rotate it.
const DIR_ROTATION: Record<TouchDir, number> = {
  up: 0,
  right: 90,
  down: 180,
  left: 270,
};

// Inside this fraction of the D-pad radius no direction is picked.
const DEAD_ZONE = 0.2;

/** Dominant-axis direction of a pointer relative to the D-pad center. */
function pickDir(
  rect: DOMRect,
  x: number,
  y: number,
  allowed: readonly TouchDir[],
): TouchDir | null {
  const dx = x - (rect.left + rect.width / 2);
  const dy = y - (rect.top + rect.height / 2);
  const radius = Math.min(rect.width, rect.height) / 2;
  if (Math.hypot(dx, dy) < radius * DEAD_ZONE) return null;
  const dir: TouchDir =
    Math.abs(dx) > Math.abs(dy)
      ? dx > 0
        ? "right"
        : "left"
      : dy > 0
        ? "down"
        : "up";
  return allowed.includes(dir) ? dir : null;
}

const DPAD_CELLS: { dir: TouchDir; area: string }[] = [
  { dir: "up", area: "up" },
  { dir: "left", area: "left" },
  { dir: "right", area: "right" },
  { dir: "down", area: "down" },
];

/**
 * On-screen D-pad and action buttons. They dispatch synthetic key events on
 * `window` (see `virtual-keys.ts`), so engines need no touch code. CSS shows
 * them only on coarse-pointer devices.
 */
export function TouchControls({ layout, disabled }: TouchControlsProps) {
  const keys = useMemo(() => createVirtualKeys(layout.repeat), [layout.repeat]);
  const dpadRef = useRef<HTMLDivElement>(null);
  const disabledRef = useRef(disabled);
  // Direction held by each finger on the D-pad, and key held by each button finger.
  const dpadPointers = useRef(new Map<number, TouchDir | null>());
  const buttonPointers = useRef(
    new Map<number, { code: string; id: string }>(),
  );
  const [litDirs, setLitDirs] = useState<ReadonlySet<TouchDir>>(new Set());
  const [litButtons, setLitButtons] = useState<ReadonlySet<string>>(new Set());

  const syncDirs = () =>
    setLitDirs(
      new Set(
        [...dpadPointers.current.values()].filter(
          (d): d is TouchDir => d !== null,
        ),
      ),
    );
  const syncButtons = () =>
    setLitButtons(
      new Set([...buttonPointers.current.values()].map((b) => b.id)),
    );

  // Release everything when controls get disabled, the tab hides or we unmount.
  useEffect(() => {
    disabledRef.current = disabled;
    if (!disabled) return;
    keys.releaseAll();
    dpadPointers.current.clear();
    buttonPointers.current.clear();
    syncDirs();
    syncButtons();
  }, [disabled, keys]);

  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden) return;
      keys.releaseAll();
      dpadPointers.current.clear();
      buttonPointers.current.clear();
      syncDirs();
      syncButtons();
    };
    document.addEventListener("visibilitychange", onVisibility);
    const dpadPointerMap = dpadPointers.current;
    const buttonPointerMap = buttonPointers.current;
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      keys.releaseAll();
      dpadPointerMap.clear();
      buttonPointerMap.clear();
    };
  }, [keys]);

  // ----- D-pad: one element, one direction per finger -----
  const moveFinger = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = dpadRef.current?.getBoundingClientRect();
    const map = dpadPointers.current;
    if (!rect || !map.has(e.pointerId)) return;
    const next = pickDir(rect, e.clientX, e.clientY, layout.dpad);
    const prev = map.get(e.pointerId) ?? null;
    if (next === prev) return;
    if (prev) keys.up(DIR_CODE[prev]);
    map.set(e.pointerId, next);
    if (next) keys.down(DIR_CODE[next]);
    syncDirs();
  };

  const onDpadDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault(); // the controls never take focus from the page
    if (disabledRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dpadPointers.current.set(e.pointerId, null);
    moveFinger(e);
  };

  const releaseFinger = (e: ReactPointerEvent<HTMLDivElement>) => {
    const map = dpadPointers.current;
    if (!map.has(e.pointerId)) return;
    const prev = map.get(e.pointerId) ?? null;
    map.delete(e.pointerId);
    if (prev) keys.up(DIR_CODE[prev]);
    syncDirs();
  };

  // ----- Action buttons: one finger each -----
  const onButtonDown = (
    e: ReactPointerEvent<HTMLButtonElement>,
    id: string,
    code: string,
  ) => {
    e.preventDefault();
    if (disabledRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    buttonPointers.current.set(e.pointerId, { code, id });
    keys.down(code);
    syncButtons();
  };

  const onButtonRelease = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const held = buttonPointers.current.get(e.pointerId);
    if (!held) return;
    buttonPointers.current.delete(e.pointerId);
    keys.up(held.code);
    syncButtons();
  };

  return (
    <div
      className="touch-controls"
      role="group"
      aria-label="Touch controls"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        ref={dpadRef}
        className="touch-dpad"
        onPointerDown={onDpadDown}
        onPointerMove={moveFinger}
        onPointerUp={releaseFinger}
        onPointerCancel={releaseFinger}
        onLostPointerCapture={releaseFinger}
      >
        {DPAD_CELLS.map(({ dir, area }) => {
          const enabled = layout.dpad.includes(dir);
          return (
            <button
              key={dir}
              type="button"
              tabIndex={-1}
              aria-label={DIR_LABEL[dir]}
              aria-disabled={!enabled}
              data-lit={litDirs.has(dir)}
              className="touch-arrow"
              style={{ gridArea: area }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 6 L20 18 H4 Z"
                  transform={`rotate(${DIR_ROTATION[dir]} 12 12)`}
                />
              </svg>
            </button>
          );
        })}
        <span className="touch-hub" aria-hidden="true" />
      </div>

      {layout.buttons.length > 0 && (
        <div className="touch-actions">
          {layout.buttons.map((b) => (
            <button
              key={b.label}
              type="button"
              tabIndex={-1}
              aria-label={b.label[0] + b.label.slice(1).toLowerCase()}
              data-lit={litButtons.has(b.label)}
              className={`touch-action ${b.variant ?? "cyan"}`}
              onPointerDown={(e) => onButtonDown(e, b.label, b.code)}
              onPointerUp={onButtonRelease}
              onPointerCancel={onButtonRelease}
              onLostPointerCapture={onButtonRelease}
            >
              {b.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
