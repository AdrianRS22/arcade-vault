/**
 * Shared skin module: the skin ids every game must support and the per-game
 * persisted choice (`av:skin:<gameId>`). Games own their palettes in
 * `lib/games/<id>/skins.ts`; this file only names the skins and stores the pick.
 */

export const SKIN_IDS = ["classic", "neon", "retro"] as const;

export type SkinId = (typeof SKIN_IDS)[number];

/** The look the game shipped with. Always the fallback. */
export const DEFAULT_SKIN: SkinId = "classic";

export const SKIN_LABELS: Record<SkinId, string> = {
  classic: "CLASSIC",
  neon: "NEON",
  retro: "RETRO",
};

const STORAGE_PREFIX = "av:skin:";

const listeners = new Set<() => void>();

export function isSkinId(value: unknown): value is SkinId {
  return (
    typeof value === "string" && (SKIN_IDS as readonly string[]).includes(value)
  );
}

/** The saved skin for a game. Safe on the server and without storage. */
export function getSkin(gameId: string): SkinId {
  try {
    const value = window.localStorage.getItem(STORAGE_PREFIX + gameId);
    return isSkinId(value) ? value : DEFAULT_SKIN;
  } catch {
    return DEFAULT_SKIN;
  }
}

export function setSkin(gameId: string, skin: SkinId): void {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + gameId, skin);
  } catch {
    // Storage blocked: the choice only lasts until reload, but still notify.
  }
  listeners.forEach((listener) => listener());
}

/** For `useSyncExternalStore(subscribeSkin, () => getSkin(id), () => DEFAULT_SKIN)`. */
export function subscribeSkin(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
