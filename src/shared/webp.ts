// Pemeriksa WebP murni (explore.md B15): magic bytes + dimensi dari header. Server TIDAK mengonversi,
// hanya menolak yang tidak sesuai; client memakai fungsi yang sama untuk memastikan hasil konversinya WebP.

export interface WebpInfo {
  width: number;
  height: number;
  format: "lossy" | "lossless" | "extended";
}

const ascii = (b: Uint8Array, start: number, text: string) =>
  [...text].every((ch, i) => b[start + i] === ch.charCodeAt(0));

/**
 * Mengembalikan dimensi bila berkas adalah WebP yang valid secara struktur header, selain itu null.
 * Mendukung VP8 (lossy), VP8L (lossless), dan VP8X (extended, mis. dengan alfa).
 */
export function parseWebp(bytes: Uint8Array): WebpInfo | null {
  if (bytes.length < 30) return null;
  if (!ascii(bytes, 0, "RIFF") || !ascii(bytes, 8, "WEBP")) return null;
  const u8 = (i: number) => bytes[i] ?? 0;

  // Ukuran RIFF (little-endian) tidak boleh melebihi berkas yang diterima.
  const riffSize = u8(4) | (u8(5) << 8) | (u8(6) << 16) | (u8(7) << 24);
  if (riffSize + 8 > bytes.length) return null;

  if (ascii(bytes, 12, "VP8 ")) {
    // Header frame lossy: kode awal 9d 01 2a, lalu lebar dan tinggi 14 bit.
    if (u8(23) !== 0x9d || u8(24) !== 0x01 || u8(25) !== 0x2a) return null;
    const width = (u8(26) | (u8(27) << 8)) & 0x3fff;
    const height = (u8(28) | (u8(29) << 8)) & 0x3fff;
    return width > 0 && height > 0 ? { width, height, format: "lossy" } : null;
  }

  if (ascii(bytes, 12, "VP8L")) {
    if (u8(20) !== 0x2f) return null; // tanda tangan VP8L
    const width = 1 + (u8(21) | ((u8(22) & 0x3f) << 8));
    const height = 1 + ((u8(22) >> 6) | (u8(23) << 2) | ((u8(24) & 0x0f) << 10));
    return { width, height, format: "lossless" };
  }

  if (ascii(bytes, 12, "VP8X")) {
    // Kanvas: lebar-1 dan tinggi-1, masing-masing 24 bit.
    const width = 1 + (u8(24) | (u8(25) << 8) | (u8(26) << 16));
    const height = 1 + (u8(27) | (u8(28) << 8) | (u8(29) << 16));
    return { width, height, format: "extended" };
  }

  return null;
}
