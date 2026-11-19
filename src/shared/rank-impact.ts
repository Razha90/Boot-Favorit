// Pratinjau dampak peringkat dari suntingan review yang belum disimpan (explore.md A3 langkah 8, B18). Fungsi murni
// memakai `scoring.ts` yang SAMA dengan server; dijalankan di browser agar admin melihat "Booth X turun #2 → #3"
// sebelum menekan Simpan. Hanya review yang berstatus `visible` dihitung (sama dengan `booth_stats`).

import { CONFIG } from "./config";
import { type BoothStats, rankBooths, statsDelta } from "./scoring";

export interface ImpactBooth {
  boothId: string;
  name: string;
  reviewCount: number;
  starSum: number;
  /** Pemutus seri; boleh null (pratinjau tidak selalu punya) */
  lastReviewAt?: number | null;
}

export interface ReviewState {
  stars: number;
  status: "visible" | "held" | "hidden";
}

export interface ReviewEdit {
  boothId: string;
  before: ReviewState;
  after: ReviewState;
}

export interface RankChange {
  boothId: string;
  name: string;
  /** null = belum diperingkat (di bawah ambang ulasan) */
  before: number | null;
  after: number | null;
  averageBefore: number | null;
  averageAfter: number | null;
}

const counted = (s: ReviewState): 1 | 2 | 3 | 4 | 5 | null =>
  s.status === "visible" ? (s.stars as 1 | 2 | 3 | 4 | 5) : null;

const toStats = (b: ImpactBooth): BoothStats => ({
  boothId: b.boothId,
  reviewCount: b.reviewCount,
  starSum: b.starSum,
  lastReviewAt: b.lastReviewAt ?? null,
});

/** Booth yang peringkat atau rata-ratanya berubah akibat `edits`, urut menurut peringkat baru. */
export function rankImpact(
  booths: readonly ImpactBooth[],
  edits: readonly ReviewEdit[],
): RankChange[] {
  const opts = {
    priorWeight: CONFIG.ranking.bayesPriorWeight,
    minReviewsToRank: CONFIG.ranking.minReviewsToRank,
  };
  const next = new Map(booths.map((b) => [b.boothId, { ...b }]));
  for (const e of edits) {
    const b = next.get(e.boothId);
    if (!b) continue;
    const d = statsDelta(counted(e.before), counted(e.after));
    b.reviewCount += d.count;
    b.starSum += d.sum;
  }
  const before = new Map(rankBooths(booths.map(toStats), opts).map((r) => [r.boothId, r]));
  const after = new Map(
    rankBooths([...next.values()].map(toStats), opts).map((r) => [r.boothId, r]),
  );

  const avg = (count: number, sum: number) => (count > 0 ? sum / count : null);
  const out: RankChange[] = [];
  for (const b of booths) {
    const n = next.get(b.boothId) as ImpactBooth;
    const r0 = before.get(b.boothId)?.rank ?? null;
    const r1 = after.get(b.boothId)?.rank ?? null;
    const a0 = avg(b.reviewCount, b.starSum);
    const a1 = avg(n.reviewCount, n.starSum);
    if (r0 !== r1 || a0 !== a1) {
      out.push({
        boothId: b.boothId,
        name: b.name,
        before: r0,
        after: r1,
        averageBefore: a0,
        averageAfter: a1,
      });
    }
  }
  return out.sort(
    (x, y) => (x.after ?? Number.POSITIVE_INFINITY) - (y.after ?? Number.POSITIVE_INFINITY),
  );
}
