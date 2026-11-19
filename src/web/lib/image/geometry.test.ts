import { describe, expect, it } from "vitest";
import { coverSquare, fitInside } from "./geometry";

describe("fitInside", () => {
  it("memperkecil proporsional sehingga sisi terpanjang = max", () => {
    expect(fitInside(4000, 3000, 1280)).toEqual({ width: 1280, height: 960 });
    expect(fitInside(3000, 4000, 1280)).toEqual({ width: 960, height: 1280 });
  });

  it("tidak pernah memperbesar", () => {
    expect(fitInside(800, 600, 1280)).toEqual({ width: 800, height: 600 });
    expect(fitInside(1280, 960, 1280)).toEqual({ width: 1280, height: 960 });
  });

  it("selalu menghasilkan sisi minimal 1 piksel (gambar sangat lonjong)", () => {
    expect(fitInside(10_000, 1, 480).height).toBe(1);
  });
});

describe("coverSquare", () => {
  it("memotong persegi di tengah dari gambar landscape dan portrait", () => {
    expect(coverSquare(1600, 1000, 960)).toEqual({ sx: 300, sy: 0, side: 1000, size: 960 });
    expect(coverSquare(1000, 1600, 960)).toEqual({ sx: 0, sy: 300, side: 1000, size: 960 });
  });

  it("tidak memperbesar bila sumber lebih kecil dari ukuran target", () => {
    expect(coverSquare(300, 200, 960)).toMatchObject({ side: 200, size: 200 });
  });

  it("gambar sudah persegi: tanpa pergeseran", () => {
    expect(coverSquare(500, 500, 400)).toEqual({ sx: 0, sy: 0, side: 500, size: 400 });
  });
});
