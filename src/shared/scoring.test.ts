import { describe, expect, it } from "vitest";
import {
  averageOf,
  type BoothStats,
  bayesianScore,
  globalMean,
  rankBooths,
  type Stars,
  statsDelta,
} from "./scoring";

const opts = { priorWeight: 5, minReviewsToRank: 3 };
const stat = (
  boothId: string,
  reviewCount: number,
  starSum: number,
  lastReviewAt: number | null = 1000,
): BoothStats => ({ boothId, reviewCount, starSum, lastReviewAt });

describe("averageOf / globalMean", () => {
  it("rata-rata null bila belum ada review", () => {
    expect(averageOf({ reviewCount: 0, starSum: 0 })).toBeNull();
    expect(averageOf({ reviewCount: 4, starSum: 18 })).toBe(4.5);
  });

  it("globalMean tertimbang jumlah review, bukan rata-rata per booth", () => {
    // 1 review ★5 dan 9 review ★1: rata-rata semua review = 1,4 (bukan 3)
    expect(globalMean([stat("a", 1, 5), stat("b", 9, 9)])).toBeCloseTo(1.4);
  });

  it("globalMean 0 bila tidak ada review sama sekali", () => {
    expect(globalMean([])).toBe(0);
    expect(globalMean([stat("a", 0, 0)])).toBe(0);
  });
});

describe("bayesianScore", () => {
  it("tanpa review, skor = rata-rata global", () => {
    expect(bayesianScore(0, 0, 3.7, 5)).toBeCloseTo(3.7);
  });

  it("makin banyak review, makin dekat ke rata-rata booth", () => {
    const few = bayesianScore(5, 2, 3, 5);
    const many = bayesianScore(5, 200, 3, 5);
    expect(few).toBeLessThan(many);
    expect(many).toBeGreaterThan(4.9);
    expect(many).toBeLessThanOrEqual(5);
  });

  it("tidak pernah melewati rentang antara rata-rata booth dan rata-rata global", () => {
    const score = bayesianScore(4.8, 10, 3.2, 5);
    expect(score).toBeGreaterThanOrEqual(3.2);
    expect(score).toBeLessThanOrEqual(4.8);
  });
});

describe("rankBooths", () => {
  it("menolak booth di bawah minReviewsToRank dan tanpa review", () => {
    const ranked = rankBooths([stat("baru", 1, 5), stat("kosong", 0, 0), stat("ok", 5, 20)], opts);
    expect(ranked.map((r) => r.boothId)).toEqual(["ok"]);
  });

  it("memberi peringkat berurutan 1..n dengan skor menurun", () => {
    const ranked = rankBooths([stat("a", 10, 40), stat("b", 10, 45), stat("c", 10, 30)], opts);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(ranked.map((r) => r.boothId)).toEqual(["b", "a", "c"]);
    const scores = ranked.map((r) => r.score);
    expect([...scores].sort((x, y) => y - x)).toEqual(scores);
  });

  it("memborong ★5 di booth yang hanya punya 3 review tidak mengalahkan booth dengan 80 review 4,8", () => {
    const field = Array.from({ length: 10 }, (_, i) => stat(`f${i}`, 20, 70)); // rata-rata 3,5
    const ranked = rankBooths([...field, stat("borongan", 3, 15), stat("mapan", 80, 384)], opts);
    const rankOf = (id: string) => ranked.find((r) => r.boothId === id)?.rank ?? Number.NaN;
    expect(rankOf("mapan")).toBe(1);
    expect(rankOf("borongan")).toBeGreaterThan(rankOf("mapan"));
  });

  it("seri skor, jumlah review, dan rata-rata: review terakhir yang lebih dulu menang", () => {
    const ranked = rankBooths([stat("lambat", 4, 16, 2000), stat("cepat", 4, 16, 1000)], opts);
    expect(ranked.map((r) => r.boothId)).toEqual(["cepat", "lambat"]);
  });

  it("seri total: urut id agar hasil selalu deterministik", () => {
    const a = rankBooths([stat("b", 4, 16, 1000), stat("a", 4, 16, 1000)], opts);
    const b = rankBooths([stat("a", 4, 16, 1000), stat("b", 4, 16, 1000)], opts);
    expect(a.map((r) => r.boothId)).toEqual(["a", "b"]);
    expect(b.map((r) => r.boothId)).toEqual(["a", "b"]);
  });

  it("jumlah review lebih banyak menang bila skor sama", () => {
    // Semua booth berrata-rata sama (4) → skor identik; yang paling banyak review di atas.
    const ranked = rankBooths([stat("sedikit", 3, 12), stat("banyak", 9, 36)], opts);
    expect(ranked.map((r) => r.boothId)).toEqual(["banyak", "sedikit"]);
  });

  it("daftar kosong menghasilkan peringkat kosong", () => {
    expect(rankBooths([], opts)).toEqual([]);
  });
});

describe("statsDelta", () => {
  const apply = (
    state: { count: number; sum: number; stars: number[] },
    d: ReturnType<typeof statsDelta>,
  ) => ({
    count: state.count + d.count,
    sum: state.sum + d.sum,
    stars: state.stars.map((n, i) => n + (d.stars[i] ?? 0)),
  });

  it("review baru menambah satu", () => {
    expect(statsDelta(null, 4)).toEqual({ count: 1, sum: 4, stars: [0, 0, 0, 1, 0] });
  });

  it("mengubah bintang memindahkan hitungan tanpa mengubah jumlah", () => {
    expect(statsDelta(3, 5)).toEqual({ count: 0, sum: 2, stars: [0, 0, -1, 0, 1] });
  });

  it("review disembunyikan atau dihapus mengurangi satu", () => {
    expect(statsDelta(4, null)).toEqual({ count: -1, sum: -4, stars: [0, 0, 0, -1, 0] });
  });

  it("permintaan kembar menghasilkan selisih nol (idempoten)", () => {
    expect(statsDelta(5, 5)).toEqual({ count: 0, sum: 0, stars: [0, 0, 0, 0, 0] });
    expect(statsDelta(null, null)).toEqual({ count: 0, sum: 0, stars: [0, 0, 0, 0, 0] });
  });

  it("rangkaian perubahan konsisten dengan hitung ulang dari nol", () => {
    const steps: [Stars | null, Stars | null][] = [
      [null, 5],
      [null, 3],
      [5, 4],
      [3, null],
      [null, 1],
    ];
    let state = { count: 0, sum: 0, stars: [0, 0, 0, 0, 0] };
    for (const [before, after] of steps) state = apply(state, statsDelta(before, after));
    // Sisa review: ★4 dan ★1
    expect(state).toEqual({ count: 2, sum: 5, stars: [1, 0, 0, 1, 0] });
  });
});
