// Tata letak hiasan latar acak tapi stabil (explore.md B27). Fungsi murni: seed yang sama selalu menghasilkan
// tata letak yang sama, di server maupun klien. Posisi tegak memakai sampel berstrata (satu stiker per jalur
// tinggi, dengan jitter), jadi tampak acak tetapi tidak pernah menumpuk atau menyisakan lubang besar.
import { hash32 } from "./fair-order";
import { FOOD_ART } from "./food-art";

export interface DecorItem {
  /** Indeks ke FOOD_ART; unik dalam satu lajur */
  art: number;
  /** Posisi tegak dalam persen tinggi halaman */
  topPct: number;
  /** 0..1: posisi mendatar di dalam lebar lajur yang tersisa */
  leftFrac: number;
  /** Derajat */
  rotate: number;
  /** Pengali ukuran dasar */
  scale: number;
}

/** PRNG kecil (mulberry32) dengan benih dari hash teks. */
export function seededRandom(seed: string): () => number {
  let a = hash32(seed) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

export function decorLayout(seed: string, side: "left" | "right", count: number): DecorItem[] {
  const rnd = seededRandom(`${seed}:${side}`);
  const n = Math.min(count, FOOD_ART.length);
  const arts = shuffle(
    FOOD_ART.map((_, i) => i),
    rnd,
  );
  return Array.from({ length: n }, (_, i) => ({
    art: arts[i] as number,
    // jalur ke-i dari n; jitter 0.1..0.9 menjaga jarak antar stiker bertetangga
    topPct: ((i + 0.1 + rnd() * 0.8) / n) * 100,
    leftFrac: rnd(),
    rotate: Math.round((rnd() - 0.5) * 56),
    scale: 0.7 + rnd() * 0.45,
  }));
}
