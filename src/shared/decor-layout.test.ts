import { describe, expect, it } from "vitest";
import { decorLayout, seededRandom } from "./decor-layout";
import { FOOD_ART } from "./food-art";

describe("decorLayout", () => {
  it("stabil: benih yang sama menghasilkan tata letak yang sama; benih/sisi berbeda berbeda", () => {
    expect(decorLayout("e1", "left", 8)).toEqual(decorLayout("e1", "left", 8));
    expect(decorLayout("e1", "left", 8)).not.toEqual(decorLayout("e2", "left", 8));
    expect(decorLayout("e1", "left", 8)).not.toEqual(decorLayout("e1", "right", 8));
  });

  it("satu stiker per jalur tinggi (merata, tidak menumpuk), semua dalam batas", () => {
    for (let s = 0; s < 50; s++) {
      const items = decorLayout(`seed-${s}`, "left", 8);
      items.forEach((it, i) => {
        expect(it.topPct).toBeGreaterThanOrEqual((i / 8) * 100);
        expect(it.topPct).toBeLessThan(((i + 1) / 8) * 100);
        expect(it.leftFrac).toBeGreaterThanOrEqual(0);
        expect(it.leftFrac).toBeLessThan(1);
        expect(Math.abs(it.rotate)).toBeLessThanOrEqual(28);
        expect(it.scale).toBeGreaterThanOrEqual(0.7);
        expect(it.scale).toBeLessThanOrEqual(1.15);
      });
    }
  });

  it("ilustrasi tidak kembar dalam satu lajur dan jumlah dibatasi daftar yang ada", () => {
    const items = decorLayout("e1", "right", 99);
    expect(items).toHaveLength(FOOD_ART.length);
    expect(new Set(items.map((i) => i.art)).size).toBe(items.length);
  });

  it("tampak acak: posisi mendatar dan sudut bervariasi (bukan pola tetap)", () => {
    const items = decorLayout("e1", "left", 10);
    expect(new Set(items.map((i) => Math.round(i.leftFrac * 10))).size).toBeGreaterThan(4);
    expect(new Set(items.map((i) => i.rotate)).size).toBeGreaterThan(6);
  });

  it("seededRandom menghasilkan angka 0..1 yang stabil", () => {
    const a = seededRandom("x");
    const b = seededRandom("x");
    for (let i = 0; i < 20; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
