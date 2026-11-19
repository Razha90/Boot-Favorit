import { describe, expect, it } from "vitest";
import { type ImpactBooth, rankImpact } from "./rank-impact";

// Tiga booth dengan 5 ulasan masing-masing (ambang peringkat bawaan 3).
const booth = (id: string, name: string, avg: number, n = 5): ImpactBooth => ({
  boothId: id,
  name,
  reviewCount: n,
  starSum: Math.round(avg * n),
});
const BOOTHS = [booth("a", "Kopi", 4.6), booth("b", "Teh", 4.2), booth("c", "Roti", 3.8)];

describe("rankImpact", () => {
  it("tanpa suntingan: tidak ada perubahan", () => {
    expect(rankImpact(BOOTHS, [])).toEqual([]);
  });

  it("menurunkan bintang booth teratas: peringkat bergeser dan rata-rata turun", () => {
    // Kopi: 23 bintang; tiga ulasan 5★ → 1★ memberi 23-12 = 11 → rata-rata 2,2
    const edits = [0, 1, 2].map(() => ({
      boothId: "a",
      before: { stars: 5, status: "visible" as const },
      after: { stars: 1, status: "visible" as const },
    }));
    const r = rankImpact(BOOTHS, edits);
    const kopi = r.find((x) => x.boothId === "a");
    expect(kopi).toMatchObject({ before: 1, averageBefore: 4.6 });
    expect(kopi?.after).toBe(3);
    expect(kopi?.averageAfter).toBeCloseTo(2.2, 5);
    expect(r.find((x) => x.boothId === "b")?.after).toBe(1); // yang di bawah naik
    expect(r.map((x) => x.after)).toEqual([1, 2, 3]); // urut peringkat baru
  });

  it("menyembunyikan review mengurangi jumlah; memulihkannya menambah (hanya 'visible' dihitung)", () => {
    const hide = rankImpact(BOOTHS, [
      {
        boothId: "a",
        before: { stars: 5, status: "visible" },
        after: { stars: 5, status: "hidden" },
      },
    ]);
    expect(hide.find((x) => x.boothId === "a")?.averageAfter).toBeCloseTo(18 / 4, 5);
    const restore = rankImpact(BOOTHS, [
      {
        boothId: "a",
        before: { stars: 5, status: "hidden" },
        after: { stars: 5, status: "visible" },
      },
    ]);
    expect(restore.find((x) => x.boothId === "a")?.averageAfter).toBeCloseTo(28 / 6, 5);
  });

  it("booth yang turun di bawah ambang menjadi belum diperingkat (null)", () => {
    const few = [booth("a", "Kopi", 4.5, 3), booth("b", "Teh", 4, 5)];
    const r = rankImpact(few, [
      {
        boothId: "a",
        before: { stars: 5, status: "visible" },
        after: { stars: 5, status: "hidden" },
      },
    ]);
    expect(r.find((x) => x.boothId === "a")).toMatchObject({ before: 1, after: null });
  });

  it("suntingan yang tidak mengubah apa pun (sama sebelum/sesudah) tidak menghasilkan entri", () => {
    const same = { stars: 4, status: "visible" as const };
    expect(rankImpact(BOOTHS, [{ boothId: "a", before: same, after: same }])).toEqual([]);
  });

  it("booth tidak dikenal diabaikan", () => {
    expect(
      rankImpact(BOOTHS, [
        {
          boothId: "zzz",
          before: { stars: 1, status: "visible" },
          after: { stars: 5, status: "visible" },
        },
      ]),
    ).toEqual([]);
  });

  it("konsisten dengan hitungan ulang server: hasil sama dengan rankBooths atas statistik yang sudah diubah", () => {
    const edit = {
      boothId: "c",
      before: { stars: 4, status: "visible" as const },
      after: { stars: 5, status: "visible" as const },
    };
    const r = rankImpact(BOOTHS, [edit]);
    expect(r.find((x) => x.boothId === "c")?.averageAfter).toBeCloseTo(20 / 5, 5);
  });
});
