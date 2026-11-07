/**
 * Shared sound module: a global mute flag (persisted, muted by default) and
 * `createSoundBank`, a Web Audio player an engine owns for its lifetime.
 */

const STORAGE_KEY = "av:muted"; // "0" = sound on, "1" = muted

const listeners = new Set<() => void>();

/** Muted unless the user explicitly unmuted. Safe on the server and without storage. */
export function isMuted(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setMuted(muted: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, muted ? "1" : "0");
  } catch {
    // Storage blocked: the choice only lasts until reload, but still notify.
  }
  listeners.forEach((listener) => listener());
}

/** For `useSyncExternalStore(subscribe, isMuted, () => true)`. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export type SoundBank<K extends string> = {
  play(name: K): void; // no-op while muted, before unlock, or after destroy
  suspend(): void; // on engine pause
  resume(): void; // on engine resume
  destroy(): void; // stops sounds, removes gesture listeners, releases buffers
};

export function createSoundBank<K extends string>(
  urls: Record<K, string>,
): SoundBank<K> {
  let ctx: AudioContext | null = null;
  let destroyed = false;
  let suspended = false;
  const buffers = new Map<K, AudioBuffer>();
  const active = new Set<AudioBufferSourceNode>();

  async function load(context: AudioContext, name: K, url: string) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.arrayBuffer();
      const buffer = await context.decodeAudioData(data);
      if (!destroyed) buffers.set(name, buffer);
    } catch (err) {
      // Logged once; this sound stays silent.
      if (!destroyed) console.error(`Sound "${name}" failed to load`, err);
    }
  }

  // The AudioContext is created on the first user gesture (autoplay policy).
  function unlock() {
    if (destroyed || ctx) return;
    removeGestureListeners();
    const Ctor = window.AudioContext;
    if (!Ctor) return;
    const context = new Ctor();
    ctx = context;
    if (suspended) void context.suspend();
    for (const name of Object.keys(urls) as K[]) {
      void load(context, name, urls[name]);
    }
  }

  function removeGestureListeners() {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  }

  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);

  return {
    play(name) {
      if (destroyed || suspended || !ctx || isMuted()) return;
      const buffer = buffers.get(name);
      if (!buffer) return;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => {
        active.delete(source);
        source.disconnect();
      };
      active.add(source);
      source.start();
    },
    suspend() {
      if (destroyed || suspended) return;
      suspended = true;
      if (ctx) void ctx.suspend();
    },
    resume() {
      if (destroyed || !suspended) return;
      suspended = false;
      if (ctx) void ctx.resume();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      removeGestureListeners();
      for (const source of active) {
        source.onended = null;
        try {
          source.stop();
        } catch {
          // Already stopped.
        }
        source.disconnect();
      }
      active.clear();
      buffers.clear();
      if (ctx) void ctx.close();
      ctx = null;
    },
  };
}
