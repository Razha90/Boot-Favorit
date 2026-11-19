// Urutan acak yang adil dan stabil (explore.md A8, B20).
// Dilakukan di client dengan seed per pengunjung, sehingga server mengirim daftar yang SAMA untuk
// semua orang dan tetap bisa di-cache di edge.

/**
 * Hash 32-bit: FNV-1a + pengacak akhir (finalizer murmur3).
 * FNV-1a saja bias untuk id yang hanya berbeda di karakter terakhir (mis. "booth-1".."booth-8"):
 * selisih kecil di akhir string nyaris tidak menggeser bit atas, sehingga urutan hampir tak acak.
 * Diketahui dari uji keadilan 10.000 seed.
 */
export function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * Urutan berdasarkan hash(seed + id), bukan pengacakan ulang:
 * - stabil selama seed sama (tidak melompat saat data berubah);
 * - booth baru tidak menggeser urutan relatif booth lama;
 * - berbeda antar pengunjung (seed berbeda).
 */
export function fairOrder<T extends { id: string }>(items: readonly T[], seed: string): T[] {
  return items
    .map((item) => ({ item, key: hash32(`${seed}:${item.id}`) }))
    .sort((a, b) => a.key - b.key || (a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0))
    .map((x) => x.item);
}

/** Seed baru untuk pengunjung baru (disimpan di browser oleh pemanggil). */
export const createSeed = (randomUint32: number): string => randomUint32.toString(36);

export interface SpotlightPosition {
  /** Putaran ke-n: dalam satu putaran tiap booth tampil tepat satu kali. */
  round: number;
  /** Indeks pada urutan putaran itu. */
  index: number;
}

/** Giliran sorotan dihitung dari waktu SERVER, jadi tanpa beban server dan tanpa koordinasi. */
export function spotlightPosition(
  serverNow: number,
  intervalMs: number,
  boothCount: number,
): SpotlightPosition {
  if (boothCount <= 0 || intervalMs <= 0) return { round: 0, index: 0 };
  const tick = Math.floor(serverNow / intervalMs);
  return { round: Math.floor(tick / boothCount), index: tick % boothCount };
}

/** Urutan sorotan untuk satu putaran: hash(seed + putaran + id). */
export function spotlightOrder<T extends { id: string }>(
  items: readonly T[],
  seed: string,
  round: number,
): T[] {
  return fairOrder(items, `${seed}:r${round}`);
}
