// Skor dan peringkat (explore.md A7). Fungsi murni, dipakai UI dan server.
//
// Rata-rata mentah tidak adil: 1 review ★5 akan mengalahkan 80 review rata-rata 4,8.
// Maka peringkat memakai rata-rata Bayesian:
//   skor = v/(v+m) × R + m/(v+m) × C
//   R = rata-rata booth, v = jumlah review booth, C = rata-rata semua review, m = bobot awal.

export type Stars = 1 | 2 | 3 | 4 | 5;

export interface BoothStats {
  boothId: string;
  reviewCount: number;
  starSum: number;
  /** Waktu review terakhir (epoch ms); dipakai sebagai pemutus seri. */
  lastReviewAt: number | null;
}

export interface RankedBooth {
  boothId: string;
  rank: number;
  score: number;
  average: number;
  reviewCount: number;
}

export interface RankingOptions {
  /** m */
  priorWeight: number;
  /** Booth dengan review lebih sedikit dari ini tidak masuk peringkat. */
  minReviewsToRank: number;
}

export const averageOf = (s: Pick<BoothStats, "reviewCount" | "starSum">): number | null =>
  s.reviewCount === 0 ? null : s.starSum / s.reviewCount;

/** C: rata-rata bintang seluruh review di semua booth (0 bila belum ada review). */
export function globalMean(stats: readonly Pick<BoothStats, "reviewCount" | "starSum">[]): number {
  let count = 0;
  let sum = 0;
  for (const s of stats) {
    count += s.reviewCount;
    sum += s.starSum;
  }
  return count === 0 ? 0 : sum / count;
}

export function bayesianScore(
  average: number,
  reviewCount: number,
  globalAverage: number,
  priorWeight: number,
): number {
  const v = reviewCount;
  const m = priorWeight;
  if (v + m === 0) return globalAverage;
  return (v / (v + m)) * average + (m / (v + m)) * globalAverage;
}

const EPSILON = 1e-9;
const differs = (a: number, b: number) => Math.abs(a - b) > EPSILON;

/**
 * Urutan peringkat. Pemutus seri: skor → jumlah review → rata-rata mentah → waktu review
 * terakhir (yang lebih dulu menang) → id (agar hasil selalu deterministik).
 * Booth di bawah `minReviewsToRank` tidak diperingkat.
 */
export function rankBooths(
  stats: readonly BoothStats[],
  { priorWeight, minReviewsToRank }: RankingOptions,
): RankedBooth[] {
  const c = globalMean(stats);
  const eligible = stats
    .filter((s) => s.reviewCount > 0 && s.reviewCount >= minReviewsToRank)
    .map((s) => {
      const average = s.starSum / s.reviewCount;
      return {
        boothId: s.boothId,
        average,
        reviewCount: s.reviewCount,
        score: bayesianScore(average, s.reviewCount, c, priorWeight),
        lastReviewAt: s.lastReviewAt ?? Number.POSITIVE_INFINITY,
      };
    });

  eligible.sort((a, b) => {
    if (differs(a.score, b.score)) return b.score - a.score;
    if (a.reviewCount !== b.reviewCount) return b.reviewCount - a.reviewCount;
    if (differs(a.average, b.average)) return b.average - a.average;
    if (a.lastReviewAt !== b.lastReviewAt) return a.lastReviewAt - b.lastReviewAt;
    return a.boothId < b.boothId ? -1 : a.boothId > b.boothId ? 1 : 0;
  });

  return eligible.map(({ lastReviewAt: _ignored, ...rest }, i) => ({ ...rest, rank: i + 1 }));
}

// ---------- Selisih statistik saat review dibuat/diubah/disembunyikan ----------

export interface StatsDelta {
  count: number;
  sum: number;
  /** Selisih per bintang: indeks 0 = bintang 1 … indeks 4 = bintang 5 */
  stars: [number, number, number, number, number];
}

/**
 * Selisih `booth_stats` dari satu perubahan review. `before`/`after` = bintang yang DIHITUNG
 * (null bila review belum ada atau tidak dihitung: held/hidden/dihapus).
 * Permintaan kembar (before === after) menghasilkan selisih nol, sehingga aman diulang (B21).
 */
export function statsDelta(before: Stars | null, after: Stars | null): StatsDelta {
  const stars: StatsDelta["stars"] = [0, 0, 0, 0, 0];
  if (before !== null) stars[before - 1] = (stars[before - 1] ?? 0) - 1;
  if (after !== null) stars[after - 1] = (stars[after - 1] ?? 0) + 1;
  return {
    count: (after === null ? 0 : 1) - (before === null ? 0 : 1),
    sum: (after ?? 0) - (before ?? 0),
    stars,
  };
}
