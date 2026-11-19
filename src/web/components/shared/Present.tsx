import type { ReactNode } from "react";

/**
 * Apakah nilai dianggap ADA untuk ditampilkan? null, undefined, false, string kosong/spasi saja, dan
 * larik kosong dianggap tidak ada. Angka (termasuk 0) dan objek dianggap ada.
 */
export function isPresent(v: unknown): boolean {
  if (v === null || v === undefined || v === false) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

/**
 * Membungkus bagian opsional (explore.md A16, B26). Mengembalikan `null` bila datanya tidak ada, sehingga
 * `gap` pada induk flex/grid tidak menyisakan celah. Judul bagian harus menjadi ANAK Present, bukan
 * saudaranya, supaya tidak pernah tampil sendirian.
 */
export function Present({ when, children }: { when: unknown; children: ReactNode }) {
  return isPresent(when) ? children : null;
}
