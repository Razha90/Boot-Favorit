// Konversi gambar ke WebP DI BROWSER (explore.md B15). Cloudflare tidak mengonversi; server hanya memvalidasi.
// Modul ini di-import() saat file dipilih, jadi tidak ikut bundle awal (B16).

import { CONFIG } from "@shared/config";
import { parseWebp } from "@shared/webp";
import { coverSquare, fitInside } from "./geometry";

export type ImageKind = "photo" | "logo" | "product";

export type ImageConvertCode =
  | "not_image"
  | "too_large_raw"
  | "decode_failed"
  | "webp_unsupported"
  | "cannot_fit";

export class ImageConvertError extends Error {
  readonly code: ImageConvertCode;
  constructor(code: ImageConvertCode) {
    super(code);
    this.name = "ImageConvertError";
    this.code = code;
  }
}

export interface ConvertedImage {
  full: Blob;
  thumb: Blob;
}

/** Kualitas diturunkan bertahap bila hasil melebihi batas byte (B15). */
const QUALITY_STEPS = [CONFIG.media.quality, 0.7, 0.6, 0.5] as const;

type Canvas = OffscreenCanvas | HTMLCanvasElement;

function makeCanvas(width: number, height: number): Canvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c;
}

function toBlob(canvas: Canvas, quality: number): Promise<Blob | null> {
  if ("convertToBlob" in canvas) return canvas.convertToBlob({ type: "image/webp", quality });
  return new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
}

async function encode(
  bitmap: ImageBitmap,
  crop: { sx: number; sy: number; sw: number; sh: number },
  out: { width: number; height: number },
  maxBytes: number,
): Promise<Blob> {
  const canvas = makeCanvas(out.width, out.height);
  const ctx = canvas.getContext("2d") as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null;
  if (!ctx) throw new ImageConvertError("decode_failed");
  ctx.drawImage(bitmap, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, out.width, out.height);

  for (const quality of QUALITY_STEPS) {
    const blob = await toBlob(canvas, quality);
    if (!blob) throw new ImageConvertError("webp_unsupported");
    // Beberapa browser (Safari lama) diam-diam mengembalikan PNG bila tak bisa meng-encode WebP.
    if (blob.type !== "image/webp") throw new ImageConvertError("webp_unsupported");
    if (blob.size <= maxBytes) {
      if (!parseWebp(new Uint8Array(await blob.arrayBuffer()))) {
        throw new ImageConvertError("webp_unsupported");
      }
      return blob;
    }
  }
  throw new ImageConvertError("cannot_fit");
}

/**
 * Konversi satu berkas menjadi dua ukuran WebP (full dan thumb).
 * - photo/logo: perkecil proporsional (tidak memperbesar).
 * - product: dipotong persegi di tengah.
 * Putaran EXIF dikoreksi saat decode; re-encode lewat canvas membuang EXIF/GPS (bonus privasi).
 */
export async function convertToWebp(file: File, kind: ImageKind): Promise<ConvertedImage> {
  if (!file.type.startsWith("image/")) throw new ImageConvertError("not_image");
  if (file.size > CONFIG.media.maxRawFileMB * 1024 * 1024)
    throw new ImageConvertError("too_large_raw");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImageConvertError("decode_failed"); // mis. HEIC yang tidak didukung browser
  }

  try {
    const limits = CONFIG.media[kind];
    const make = (px: number, maxBytes: number) => {
      if (kind === "product") {
        const sq = coverSquare(bitmap.width, bitmap.height, px);
        return encode(
          bitmap,
          { sx: sq.sx, sy: sq.sy, sw: sq.side, sh: sq.side },
          { width: sq.size, height: sq.size },
          maxBytes,
        );
      }
      const size = fitInside(bitmap.width, bitmap.height, px);
      return encode(bitmap, { sx: 0, sy: 0, sw: bitmap.width, sh: bitmap.height }, size, maxBytes);
    };
    const full = await make(limits.fullPx, limits.maxBytesFull);
    const thumb = await make(limits.thumbPx, limits.maxBytesThumb);
    return { full, thumb };
  } finally {
    bitmap.close();
  }
}
