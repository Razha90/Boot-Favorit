import { describe, expect, it } from "vitest";
import { fairOrder, hash32, spotlightOrder, spotlightPosition } from "./fair-order";

const booths = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `booth-${i + 1}` }));
const ids = (list: { id: string }[]) => list.map((x) => x.id);

describe("hash32", () => {
  it("deterministik dan bertipe uint32", () => {
    expect(hash32("abc")).toBe(hash32("abc"));
    expect(hash32("abc")).not.toBe(hash32("abd"));
    const h = hash32("apa saja");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(2 ** 32);
  });
});

describe("fairOrder", () => {
  it("stabil: seed sama menghasilkan urutan sama, tidak memengaruhi input asli", () => {
    const input = booths(10);
    const copy = [...input];
    expect(ids(fairOrder(input, "seed-1"))).toEqual(ids(fairOrder(input, "seed-1")));
    expect(input).toEqual(copy);
  });

  it("urutan input tidak memengaruhi hasil", () => {
    const input = booths(10);
    expect(ids(fairOrder(input, "x"))).toEqual(ids(fairOrder([...input].reverse(), "x")));
  });

  it("seed berbeda menghasilkan urutan berbeda", () => {
    const input = booths(12);
    expect(ids(fairOrder(input, "satu"))).not.toEqual(ids(fairOrder(input, "dua")));
  });

  it("booth baru tidak menggeser urutan relatif booth lama", () => {
    const before = ids(fairOrder(booths(10), "seed-x"));
    const after = ids(fairOrder(booths(11), "seed-x")).filter((id) => id !== "booth-11");
    expect(after).toEqual(before);
  });

  it("menjaga semua item (tanpa hilang atau ganda)", () => {
    const out = ids(fairOrder(booths(50), "s"));
    expect(new Set(out).size).toBe(50);
  });

  it("adil: dari 10.000 seed, tiap booth jadi pertama dan terakhir ±1/N kali", () => {
    const n = 8;
    const input = booths(n);
    const first = new Map<string, number>();
    const last = new Map<string, number>();
    for (let i = 0; i < 10_000; i++) {
      const out = fairOrder(input, `pengunjung-${i}`);
      const f = out[0]?.id ?? "";
      const l = out[n - 1]?.id ?? "";
      first.set(f, (first.get(f) ?? 0) + 1);
      last.set(l, (last.get(l) ?? 0) + 1);
    }
    const expected = 10_000 / n; // 1250; simpangan baku ≈ 33, toleransi ±15% ≈ 5σ
    for (const b of input) {
      expect(first.get(b.id) ?? 0).toBeGreaterThan(expected * 0.85);
      expect(first.get(b.id) ?? 0).toBeLessThan(expected * 1.15);
      expect(last.get(b.id) ?? 0).toBeGreaterThan(expected * 0.85);
      expect(last.get(b.id) ?? 0).toBeLessThan(expected * 1.15);
    }
  });
});

describe("spotlight", () => {
  it("posisi dihitung dari waktu server", () => {
    expect(spotlightPosition(0, 8000, 5)).toEqual({ round: 0, index: 0 });
    expect(spotlightPosition(8000, 8000, 5)).toEqual({ round: 0, index: 1 });
    expect(spotlightPosition(8000 * 5, 8000, 5)).toEqual({ round: 1, index: 0 });
    expect(spotlightPosition(8000 * 7 + 100, 8000, 5)).toEqual({ round: 1, index: 2 });
  });

  it("tanpa booth atau interval tidak valid: tidak error", () => {
    expect(spotlightPosition(123456, 8000, 0)).toEqual({ round: 0, index: 0 });
    expect(spotlightPosition(123456, 0, 5)).toEqual({ round: 0, index: 0 });
  });

  it("dalam satu putaran tiap booth tampil tepat satu kali", () => {
    const n = 7;
    const input = booths(n);
    for (const round of [0, 1, 2, 9]) {
      const order = spotlightOrder(input, "seed", round);
      const shown = new Set<string>();
      for (let tick = round * n; tick < (round + 1) * n; tick++) {
        const pos = spotlightPosition(tick * 8000, 8000, n);
        expect(pos.round).toBe(round);
        shown.add(order[pos.index]?.id ?? "");
      }
      expect(shown.size).toBe(n);
    }
  });

  it("urutan berbeda antar putaran, tetap stabil dalam satu putaran", () => {
    const input = booths(9);
    expect(ids(spotlightOrder(input, "s", 0))).toEqual(ids(spotlightOrder(input, "s", 0)));
    expect(ids(spotlightOrder(input, "s", 0))).not.toEqual(ids(spotlightOrder(input, "s", 1)));
  });
});
