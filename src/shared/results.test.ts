import { describe, expect, it } from "vitest";
import { type BoothResultInput, buildResults, resultsDiffer, visibility } from "./results";

const OPTS = { priorWeight: 5, minReviewsToRank: 3 };
const b = (
  id: string,
  count: number,
  sum: number,
  over: Partial<BoothResultInput> = {},
): BoothResultInput => ({
  boothId: id,
  name: id.toUpperCase(),
  boothNo: null,
  coverThumbKey: null,
  reviewCount: count,
  starSum: sum,
  lastReviewAt: 1,
  categoryCounts: {},
  ...over,
});
const LABELS = new Map([
  ["c1", "Seru"],
  ["c2", "Ramah"],
  ["c3", "Rapi"],
  ["c4", "Kreatif"],
]);

describe("visibility", () => {
  const base = {
    ratingsMode: "visible",
    rankingMode: "visible",
    resultsPublishedAt: null,
  } as const;

  it("bawaan: keduanya tampil", () => {
    expect(visibility(base)).toEqual({ ratings: true, ranking: true });
  });

  it("peringkat bergantung pada rating: rating tersembunyi → peringkat ikut tersembunyi walau mode 'visible'", () => {
    expect(visibility({ ...base, ratingsMode: "hidden" })).toEqual({
      ratings: false,
      ranking: false,
    });
  });

  it("on_results: tersembunyi sampai hasil diumumkan", () => {
    const hidden = {
      ratingsMode: "on_results",
      rankingMode: "on_results",
      resultsPublishedAt: null,
    } as const;
    expect(visibility(hidden)).toEqual({ ratings: false, ranking: false });
    expect(visibility({ ...hidden, resultsPublishedAt: 5 })).toEqual({
      ratings: true,
      ranking: true,
    });
  });

  it("peringkat 'hidden' menyembunyikan peringkat saja; rating tetap", () => {
    expect(visibility({ ...base, rankingMode: "hidden" })).toEqual({
      ratings: true,
      ranking: false,
    });
  });

  it("hasil diumumkan tidak membuka yang 'hidden' (admin yang mengubah modenya)", () => {
    expect(
      visibility({ ratingsMode: "hidden", rankingMode: "visible", resultsPublishedAt: 9 }),
    ).toEqual({
      ratings: false,
      ranking: false,
    });
  });
});

describe("buildResults", () => {
  it("seluruh booth tercantum; yang diperingkat dulu menurut Bayesian, sisanya (belum cukup ulasan) di bawah", () => {
    const r = buildResults(
      [b("sedikit", 2, 10), b("bagus", 10, 48), b("biasa", 10, 35), b("nol", 0, 0)],
      LABELS,
      OPTS,
    );
    expect(r.map((x) => x.boothId)).toEqual(["bagus", "biasa", "sedikit", "nol"]);
    expect(r.map((x) => x.rank)).toEqual([1, 2, null, null]);
    expect(r[2]).toMatchObject({ rank: null, score: null, average: 5 }); // rata-rata tetap diketahui
    expect(r[3]).toMatchObject({ average: null, reviewCount: 0 });
  });

  it("tag teratas maksimal 3, urut jumlah lalu id; label tak dikenal dibuang", () => {
    const r = buildResults(
      [b("a", 5, 20, { categoryCounts: { c1: 12, c2: 8, c3: 8, c4: 1, x: 99 } })],
      LABELS,
      OPTS,
    );
    expect(r[0]?.topCategories).toEqual([
      { label: "Seru", count: 12 },
      { label: "Ramah", count: 8 },
      { label: "Rapi", count: 8 },
    ]);
  });

  it("tanpa booth: daftar kosong; tanpa tag: tanpa tag", () => {
    expect(buildResults([], LABELS, OPTS)).toEqual([]);
    expect(buildResults([b("a", 3, 12)], LABELS, OPTS)[0]?.topCategories).toEqual([]);
  });

  it("seri skor: yang ulasannya lebih banyak menang; urutan deterministik", () => {
    const r1 = buildResults([b("x", 4, 20), b("y", 8, 40)], LABELS, OPTS).map((x) => x.boothId);
    const r2 = buildResults([b("y", 8, 40), b("x", 4, 20)], LABELS, OPTS).map((x) => x.boothId);
    expect(r1).toEqual(["y", "x"]);
    expect(r2).toEqual(r1);
  });

  it("yang belum diperingkat diurut jumlah ulasan lalu nama", () => {
    const r = buildResults([b("b", 1, 5), b("a", 1, 5), b("c", 2, 10)], LABELS, OPTS).map(
      (x) => x.boothId,
    );
    expect(r).toEqual(["c", "a", "b"]);
  });
});

describe("resultsDiffer", () => {
  it("sama = tidak berbeda; perubahan rata-rata/peringkat/jumlah = berbeda", () => {
    const a = buildResults([b("a", 3, 12), b("b", 4, 12)], LABELS, OPTS);
    expect(resultsDiffer(a, buildResults([b("a", 3, 12), b("b", 4, 12)], LABELS, OPTS))).toBe(
      false,
    );
    expect(resultsDiffer(a, buildResults([b("a", 3, 15), b("b", 4, 12)], LABELS, OPTS))).toBe(true);
    expect(resultsDiffer(a, [])).toBe(true);
  });
});
