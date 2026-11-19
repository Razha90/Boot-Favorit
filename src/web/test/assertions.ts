// Penegasan bersama untuk matriks "data kosong" (explore.md B26 pengujian butir 1).
import { expect } from "vitest";

const BAD_TEXT =
  /tidak tersedia|tidak ditemukan|not found|\bundefined\b|\bnull\b|\bNaN\b|\[object/i;

/** Tidak ada gambar tanpa sumber, bagian kosong, atau teks "galat" di halaman pengunjung. */
export function assertNoBrokenUI(container: HTMLElement, label = ""): void {
  const where = label ? ` (${label})` : "";

  for (const img of container.querySelectorAll("img")) {
    expect(img.getAttribute("src"), `<img> tanpa src${where}`).toBeTruthy();
  }

  // Judul/paragraf/tombol/tautan kosong di luar dekorasi (aria-hidden).
  for (const el of container.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,button,a")) {
    if (el.closest("[aria-hidden='true']")) continue;
    const hasLabel = el.getAttribute("aria-label");
    expect(
      (el.textContent ?? "").trim() !== "" ||
        !!hasLabel ||
        el.querySelector("img,[role='img']") !== null,
      `<${el.tagName.toLowerCase()}> kosong${where}`,
    ).toBe(true);
  }

  expect(container.textContent ?? "", `teks galat${where}`).not.toMatch(BAD_TEXT);
}

/** Simulasikan semua gambar gagal dimuat (berkas 404). */
export function failAllImages(container: HTMLElement): number {
  const imgs = [...container.querySelectorAll("img")];
  for (const img of imgs) img.dispatchEvent(new Event("error"));
  return imgs.length;
}
