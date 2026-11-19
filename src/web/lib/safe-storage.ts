// Penyimpanan di browser yang tidak pernah melempar galat: localStorage → sessionStorage → memori
// (explore.md B20). Mode privat, penyimpanan diblokir, atau kuota penuh membuat localStorage bisa
// melempar; tampilan harus tetap berfungsi tanpa penyimpanan.

const memory = new Map<string, string>();

function tryStore(kind: "localStorage" | "sessionStorage"): Storage | null {
  try {
    const s = window[kind];
    const probe = "__probe__";
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export interface SafeStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export function createSafeStorage(): SafeStorage {
  const stores = [tryStore("localStorage"), tryStore("sessionStorage")].filter(
    (s): s is Storage => s !== null,
  );
  return {
    get(key) {
      for (const s of stores) {
        try {
          const v = s.getItem(key);
          if (v !== null) return v;
        } catch {
          // lanjut ke penyimpanan berikutnya
        }
      }
      return memory.get(key) ?? null;
    },
    set(key, value) {
      memory.set(key, value); // selalu, agar bertahan selama sesi walau penyimpanan gagal
      for (const s of stores) {
        try {
          s.setItem(key, value);
          return;
        } catch {
          // coba berikutnya
        }
      }
    },
    remove(key) {
      memory.delete(key);
      for (const s of stores) {
        try {
          s.removeItem(key);
        } catch {
          // diabaikan
        }
      }
    },
  };
}

export const storage: SafeStorage = createSafeStorage();
