// Perhitungan ukuran gambar (murni, mudah diuji). Konversi sebenarnya ada di convert-to-webp.ts.

export interface Size {
  width: number;
  height: number;
}

/** Perkecil proporsional agar sisi terpanjang ≤ max. Tidak pernah memperbesar. */
export function fitInside(width: number, height: number, max: number): Size {
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export interface SquareCrop {
  /** Sumber: persegi di tengah gambar */
  sx: number;
  sy: number;
  side: number;
  /** Keluaran: persegi `size` × `size` (tidak melebihi sisi sumber) */
  size: number;
}

/** Potong persegi di tengah (foto produk, B15) lalu perkecil ke `size`. */
export function coverSquare(width: number, height: number, size: number): SquareCrop {
  const side = Math.min(width, height);
  return {
    sx: Math.floor((width - side) / 2),
    sy: Math.floor((height - side) / 2),
    side,
    size: Math.min(size, side),
  };
}
