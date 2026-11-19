import { createSeed } from "@shared/fair-order";
import { storage as defaultStorage, type SafeStorage } from "./safe-storage";

const KEY = "visitor-seed";

/**
 * Seed acak per pengunjung untuk urutan booth yang adil (explore.md A8, B20): dibuat SEKALI lalu disimpan,
 * sehingga urutan stabil selama sesi (tidak melompat saat data berubah) dan berbeda antar pengunjung.
 */
export function getVisitorSeed(
  store: SafeStorage = defaultStorage,
  random: () => number = () => crypto.getRandomValues(new Uint32Array(1))[0] ?? 0,
): string {
  const existing = store.get(KEY);
  if (existing) return existing;
  const seed = createSeed(random());
  store.set(KEY, seed);
  return seed;
}
