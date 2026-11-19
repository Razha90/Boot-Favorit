// Pintu suara ringan (B16, B23): menyimpan status aktif global dan memuat `sfx.ts` secara dinamis saat interaksi pertama.
import type { SfxMap, SfxName } from "./sfx";

let sfxActive = false;
let unlocked = false;
let engine: typeof import("./sfx").synthEngine | null = null;
let loading: Promise<typeof import("./sfx").synthEngine | null> | null = null;

async function ensureEngine() {
  if (engine) return engine;
  if (!loading) {
    loading = import("./sfx")
      .then((m) => {
        engine = m.synthEngine;
        return engine;
      })
      .catch(() => null);
  }
  return loading;
}

export function setSfxGlobalEnabled(on: boolean) {
  sfxActive = on;
}

export function isSfxGlobalEnabled(): boolean {
  return sfxActive;
}

export function unlockSfx() {
  if (!sfxActive) return;
  unlocked = true;
  if (engine) {
    engine.unlock();
    return;
  }
  void ensureEngine().then((e) => {
    if (e && sfxActive) e.unlock();
  });
}

export function triggerSfx<K extends SfxName>(name: K, ...args: SfxMap[K]) {
  if (!sfxActive || !unlocked) return;
  if (engine) {
    engine.unlock();
    engine.play(name, ...args);
    return;
  }
  void ensureEngine().then((e) => {
    if (e && sfxActive && unlocked) {
      e.unlock();
      e.play(name, ...args);
    }
  });
}
