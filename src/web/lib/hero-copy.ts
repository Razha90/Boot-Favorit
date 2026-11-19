import type { EventState } from "@shared/event-state";

export interface HeroCopy {
  badge: string;
  sub: string;
  cta: string;
  /** Voting sedang berjalan: lencana bertanda aktif */
  live: boolean;
}

/**
 * Teks hero menurut status event (explore.md A12, tabel "Status event dan teks ajakan selalu selaras").
 * Dihitung dari `getEventState`, sehingga selalu selaras dengan tombol dan form.
 */
export function heroCopy(s: Pick<EventState, "phase" | "resultsPublished">): HeroCopy {
  if (s.phase === "upcoming") {
    return {
      badge: "VOTING SEGERA DIBUKA",
      sub: "Booth sedang bersiap. Intip dulu sajiannya, yuk!",
      cta: "Intip booth-nya",
      live: false,
    };
  }
  if (s.phase === "live") {
    return {
      badge: "VOTING DIBUKA",
      sub: "Cicipi sajian di tiap stand, lalu kasih rating buat booth favoritmu.",
      cta: "Yuk, cobain jelajah booth",
      live: true,
    };
  }
  return s.resultsPublished
    ? {
        badge: "EVENT UDAH SELESAI",
        sub: "Makasih udah ikut meramaikan! Yuk, lihat rekapitulasi acara dan siapa saja booth terfavorit.",
        cta: "Lihat Rekap & Booth Terfavorit",
        live: false,
      }
    : {
        badge: "EVENT UDAH SELESAI",
        sub: "Makasih udah ikut meramaikan, hasil segera diumumkan.",
        cta: "Lihat semua booth",
        live: false,
      };
}

/** Pecah nama acara menjadi potongan, dengan kata sorotan (mis. "Terfavorit") ditandai. */
export function splitHighlight(
  name: string,
  highlight: string | null,
): { text: string; hl: boolean }[] {
  const h = highlight?.trim();
  if (!h) return [{ text: name, hl: false }];
  const idx = name.toLowerCase().indexOf(h.toLowerCase());
  if (idx < 0) return [{ text: name, hl: false }];
  const parts = [
    { text: name.slice(0, idx), hl: false },
    { text: name.slice(idx, idx + h.length), hl: true },
    { text: name.slice(idx + h.length), hl: false },
  ];
  return parts.filter((p) => p.text !== "");
}

/** Hitung mundur ringkas: "2 hari 3 jam", "3 jam 5 menit", "kurang dari semenit". */
export function countdownText(targetMs: number, nowMs: number): string {
  const diff = Math.max(0, targetMs - nowMs);
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (d > 0) return h > 0 ? `${d} hari ${h} jam` : `${d} hari`;
  if (h > 0) return m > 0 ? `${h} jam ${m} menit` : `${h} jam`;
  if (m > 0) return `${m} menit`;
  return "kurang dari semenit";
}
