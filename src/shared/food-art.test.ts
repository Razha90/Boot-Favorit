import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_OG_PATH, FOOD_ART, foodArtFor, foodArtPath, foodOgPath } from "./food-art";

// Vitest berjalan dari akar repo.
const file = (p: string) => resolve("public", p.replace(/^\//, ""));

describe("ilustrasi makanan pengganti foto", () => {
  it("daftar nama sama dengan sumber pembuat gambar (scripts/art/food.mjs)", () => {
    const src = readFileSync(resolve("scripts/art/food.mjs"), "utf8");
    const body = src.slice(
      src.indexOf("export const FOOD = {"),
      src.indexOf("export const FOOD_NAMES"),
    );
    const names = [...body.matchAll(/^ {2}([a-z]+): \(\) =>/gm)].map((m) => m[1]);
    expect([...FOOD_ART].sort()).toEqual([...names].sort());
  });

  it("setiap ilustrasi punya SVG dan kartu OG di public/ (jalankan `npm run build:art` bila gagal)", () => {
    for (const name of FOOD_ART) {
      expect(existsSync(file(foodArtPath(name))), `${name}.svg`).toBe(true);
      expect(existsSync(file(foodOgPath(name))), `food-${name}.png`).toBe(true);
    }
    expect(existsSync(file(DEFAULT_OG_PATH))).toBe(true);
    for (const f of [
      "brand/lppm-logo.png",
      "brand/unimed-seal.png",
      "favicon.ico",
      "apple-touch-icon.png",
      "icon-192.png",
      "icon-512.png",
      "icon-maskable-512.png",
    ]) {
      expect(existsSync(file(f)), f).toBe(true);
    }
  });

  it("kartu OG berukuran 1200x630 (PNG)", () => {
    const png = readFileSync(file(DEFAULT_OG_PATH));
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  });

  it("pemilihan stabil per id dan merata antar ilustrasi", () => {
    expect(foodArtFor("abc")).toBe(foodArtFor("abc"));
    const counts = new Map<string, number>();
    for (let i = 0; i < 1200; i++) {
      const n = foodArtFor(`booth-${i}`);
      counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    expect(counts.size).toBe(FOOD_ART.length);
    for (const c of counts.values()) expect(c).toBeGreaterThan(50); // rata-rata 100
  });

  it("offset menggeser pilihan (dua kartu bersebelahan tidak kembar)", () => {
    expect(foodArtFor("abc", 1)).not.toBe(foodArtFor("abc", 0));
  });
});
