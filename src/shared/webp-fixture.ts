// Hanya untuk tes: header WebP sintetis (cukup untuk pemeriksa struktur, bukan gambar yang bisa dirender).
export function fakeWebp(
  kind: "VP8 " | "VP8L" | "VP8X",
  width: number,
  height: number,
  total = 40,
): Uint8Array {
  const b = new Uint8Array(Math.max(total, 40));
  const put = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) b[at + i] = s.charCodeAt(i);
  };
  put(0, "RIFF");
  const size = b.length - 8;
  b[4] = size & 255;
  b[5] = (size >> 8) & 255;
  b[6] = (size >> 16) & 255;
  b[7] = (size >> 24) & 255;
  put(8, "WEBP");
  put(12, kind);
  if (kind === "VP8 ") {
    b[23] = 0x9d;
    b[24] = 0x01;
    b[25] = 0x2a;
    b[26] = width & 255;
    b[27] = (width >> 8) & 0x3f;
    b[28] = height & 255;
    b[29] = (height >> 8) & 0x3f;
  } else if (kind === "VP8L") {
    b[20] = 0x2f;
    const w = width - 1;
    const h = height - 1;
    b[21] = w & 255;
    b[22] = ((w >> 8) & 0x3f) | ((h & 3) << 6);
    b[23] = (h >> 2) & 255;
    b[24] = (h >> 10) & 0x0f;
  } else {
    const w = width - 1;
    const h = height - 1;
    b[24] = w & 255;
    b[25] = (w >> 8) & 255;
    b[26] = (w >> 16) & 255;
    b[27] = h & 255;
    b[28] = (h >> 8) & 255;
    b[29] = (h >> 16) & 255;
  }
  return b;
}
