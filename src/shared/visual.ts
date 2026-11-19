// Aturan tampilan saat data tidak lengkap (explore.md A16, B26). Fungsi murni.
// Server mengirim null/[]; komponen memutuskan bingkai, hanya-teks, atau hilang berdasarkan ini.

import { CONFIG } from "./config";

export const hasText = (v: string | null | undefined): v is string =>
  typeof v === "string" && v.trim().length > 0;

export interface BoothVisualFields {
  id: string;
  name: string;
  boothNo: string | null;
  coverThumbKey: string | null;
  description: string | null;
  tagline: string | null;
}

/**
 * Satu keputusan untuk SELURUH daftar, bukan per kartu:
 * - "photo": sedikitnya satu item berfoto; item tanpa foto memakai bingkai (ukuran kartu seragam).
 * - "text": tak satu pun berfoto; semua kartu beralih ke tampilan hanya-teks.
 */
export const gridVisualMode = (
  items: readonly { coverThumbKey: string | null }[],
): "photo" | "text" => (items.some((i) => hasText(i.coverThumbKey)) ? "photo" : "text");

export type Completeness = "name_only" | "partial" | "full";

const NEEDS: Record<(typeof CONFIG.profile.fullNeeds)[number], (b: BoothVisualFields) => boolean> =
  {
    cover: (b) => hasText(b.coverThumbKey),
    description: (b) => hasText(b.description),
    tagline: (b) => hasText(b.tagline),
    boothNo: (b) => hasText(b.boothNo),
  };

/** Kelengkapan profil: hanya untuk chip admin dan saran di portal; tidak memengaruhi tampilan publik. */
export function completeness(b: BoothVisualFields): Completeness {
  const results = CONFIG.profile.fullNeeds.map((need) => NEEDS[need](b));
  if (!results.some(Boolean)) return "name_only";
  return results.every(Boolean) ? "full" : "partial";
}

/**
 * Inisial aman untuk nama apa pun: huruf/angka pertama dari maksimal 2 kata.
 * Cadangan: nomor booth, lalu titik tengah.
 */
export function initials(name: string, boothNo?: string | null): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .map((word) => word.match(/[\p{L}\p{N}]/u)?.[0])
    .filter((c): c is string => c !== undefined);
  const joined = letters.slice(0, 2).join("");
  if (joined.length > 0) return joined.toLocaleUpperCase("id");
  return hasText(boothNo) ? boothNo.trim().slice(0, 3).toLocaleUpperCase("id") : "•";
}
