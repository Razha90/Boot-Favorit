// Aturan pemutaran animasi pemenang dan panel Layar Besar (explore.md A8, B20): fungsi MURNI, tanpa Date.now().

import type { RevealInfo } from "./api-types";
import { CONFIG } from "./config";
import type { ResultEntry } from "./results";

// ---------- Urutan animasi ----------

export type RevealStep =
  | { kind: "count"; n: number; ms: number }
  | { kind: "place"; rank: 1 | 2 | 3; entry: ResultEntry; ms: number }
  | { kind: "list" };

/**
 * 3-2-1 → juara 3 → juara 2 → juara 1 → daftar hasil akhir. Hanya booth yang benar-benar diperingkat yang
 * mendapat panggung; kurang dari 3 → hanya yang ada; tidak ada yang diperingkat → langsung daftar (tanpa hitung mundur).
 */
export function revealSteps(results: readonly ResultEntry[]): RevealStep[] {
  const podium = ([3, 2, 1] as const).flatMap((rank) => {
    const entry = results.find((r) => r.rank === rank);
    return entry ? [{ kind: "place", rank, entry, ms: CONFIG.reveal.placeMs } as const] : [];
  });
  if (podium.length === 0) return [{ kind: "list" }];
  const count: RevealStep[] = [3, 2, 1].map((n) => ({
    kind: "count",
    n,
    ms: CONFIG.reveal.countdownStepMs,
  }));
  return [...count, ...podium, { kind: "list" }];
}

export const revealDurationMs = (steps: readonly RevealStep[]): number =>
  steps.reduce((n, s) => n + (s.kind === "list" ? 0 : s.ms), 0);

// ---------- Kapan diputar ----------

export const autoplayOffKey = (eventId: string, resultsVersion: number) =>
  `winnerAutoplayOff:${eventId}:${resultsVersion}`;
export const revealSeenKey = (eventId: string) => `revealSeen:${eventId}`;

/**
 * Pemutaran otomatis saat halaman dibuka setelah event selesai (mode `replay`): fase selesai, hasil sudah diumumkan,
 * dan pengunjung belum mematikannya di perangkat ini. Tidak ada penyimpanan "sudah dilihat": tiap muat ulang memutar lagi.
 */
export const shouldAutoReplay = (o: {
  frozen: boolean;
  resultsPublished: boolean;
  optedOut: boolean;
}): boolean => o.frozen && o.resultsPublished && !o.optedOut;

/**
 * Pemutaran langsung oleh admin (mode `live`): sekali per `seq`, hanya bila baru (< liveWindowMs), dan hanya di area
 * yang dituju (`screen` memutar untuk kedua target; halaman pengunjung hanya untuk `everyone`).
 */
export function shouldPlayLive(o: {
  reveal: RevealInfo | null;
  lastSeenSeq: number;
  now: number;
  area: "screen" | "event";
}): boolean {
  const r = o.reveal;
  if (!r || r.seq <= o.lastSeenSeq) return false;
  if (o.now - r.startedAt >= CONFIG.reveal.liveWindowMs) return false;
  return o.area === "screen" || r.target === "everyone";
}

// ---------- Panel Layar Besar ----------

export type ScreenPanel = "spotlight" | "booths" | "feed" | "ranking" | "results";

/**
 * Urutan panel: Sorotan → Semua booth → Ulasan terbaru → Peringkat. Peringkat/hasil SELALU yang terakhir dan hanya
 * ada bila boleh tampil. Panel tanpa isi dilewati (tanpa booth/ulasan, tidak ada layar kosong).
 */
export function screenPanels(o: {
  boothCount: number;
  feedCount: number;
  rankingCount: number | null;
  resultsPublished: boolean;
  frozen: boolean;
}): ScreenPanel[] {
  const panels: ScreenPanel[] = [];
  if (o.boothCount > 0) panels.push("spotlight", "booths");
  if (o.feedCount > 0) panels.push("feed");
  if (o.frozen && o.resultsPublished) panels.push("results");
  else if (o.rankingCount !== null && o.rankingCount > 0) panels.push("ranking");
  return panels;
}

/** Panel yang tampil pada waktu `now` (deterministik dari waktu server: semua layar berganti serentak). */
export function panelAt<T>(
  panels: readonly T[],
  now: number,
  startedAt: number,
  ms: number,
): T | null {
  if (panels.length === 0) return null;
  const slot = Math.max(0, Math.floor((now - startedAt) / ms));
  return panels[slot % panels.length] ?? null;
}
