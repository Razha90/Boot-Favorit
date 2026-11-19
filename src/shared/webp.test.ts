import { describe, expect, it } from "vitest";
import { parseWebp } from "./webp";
import { fakeWebp as webp } from "./webp-fixture";

describe("parseWebp", () => {
  it("membaca dimensi lossy (VP8)", () => {
    expect(parseWebp(webp("VP8 ", 1280, 960))).toEqual({
      width: 1280,
      height: 960,
      format: "lossy",
    });
    expect(parseWebp(webp("VP8 ", 480, 360))).toMatchObject({ width: 480, height: 360 });
  });

  it("membaca dimensi lossless (VP8L)", () => {
    expect(parseWebp(webp("VP8L", 512, 512))).toEqual({
      width: 512,
      height: 512,
      format: "lossless",
    });
    expect(parseWebp(webp("VP8L", 1280, 853))).toMatchObject({ width: 1280, height: 853 });
  });

  it("membaca dimensi extended (VP8X)", () => {
    expect(parseWebp(webp("VP8X", 1280, 720))).toEqual({
      width: 1280,
      height: 720,
      format: "extended",
    });
  });

  it("menolak yang bukan WebP: PNG, JPEG, teks, kosong, terlalu pendek", () => {
    const png = new Uint8Array(64);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const jpeg = new Uint8Array(64);
    jpeg.set([0xff, 0xd8, 0xff, 0xe0]);
    expect(parseWebp(png)).toBeNull();
    expect(parseWebp(jpeg)).toBeNull();
    expect(parseWebp(new TextEncoder().encode("<html>bukan gambar</html>".repeat(3)))).toBeNull();
    expect(parseWebp(new Uint8Array(0))).toBeNull();
    expect(parseWebp(new Uint8Array(10))).toBeNull();
  });

  it("menolak RIFF yang bukan WEBP dan chunk yang tidak dikenal", () => {
    const wav = webp("VP8 ", 100, 100);
    wav.set([0x57, 0x41, 0x56, 0x45], 8); // "WAVE"
    expect(parseWebp(wav)).toBeNull();
    const odd = webp("VP8 ", 100, 100);
    odd.set([0x58, 0x58, 0x58, 0x58], 12);
    expect(parseWebp(odd)).toBeNull();
  });

  it("menolak VP8 tanpa kode awal yang benar dan dimensi nol", () => {
    const bad = webp("VP8 ", 100, 100);
    bad[23] = 0;
    expect(parseWebp(bad)).toBeNull();
    expect(parseWebp(webp("VP8 ", 0, 0))).toBeNull();
  });

  it("menolak berkas terpotong (ukuran RIFF melebihi berkas)", () => {
    const full = webp("VP8 ", 100, 100, 200);
    expect(parseWebp(full.slice(0, 100))).toBeNull();
  });
});
