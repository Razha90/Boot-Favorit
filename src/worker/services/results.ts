// Hasil akhir, mode rating/peringkat, dan animasi pemenang (explore.md A3, A8, B20).
// Hasil DIBEKUKAN saat diumumkan (`results_json`); menyunting review sesudahnya tidak mengubahnya sampai admin menekan
// "Perbarui hasil". Setiap perubahan menaikkan `stats_version` (kunci cache snapshot berganti, B17).

import type { PublicResults } from "@shared/api-types";
import { CONFIG } from "@shared/config";
import { ApiError } from "@shared/errors";
import {
  type BoothResultInput,
  buildResults,
  type DisplayMode,
  type ResultEntry,
  resultsDiffer,
} from "@shared/results";
import { and, eq, sql } from "drizzle-orm";
import { boothStats, booths, type EventRow, events, reviewCategories } from "../db/schema";
import type { Db } from "./../lib/db";
import { coverRows } from "./public";
import type { Deps } from "./visitors";

const OPTS = {
  priorWeight: CONFIG.ranking.bayesPriorWeight,
  minReviewsToRank: CONFIG.ranking.minReviewsToRank,
};

const parseCounts = (json: string | null): Record<string, number> => {
  try {
    const v = json ? JSON.parse(json) : {};
    return v && typeof v === "object" ? (v as Record<string, number>) : {};
  } catch {
    return {};
  }
};

/** Hasil dari statistik SAAT INI (belum dibekukan). Hanya booth yang tayang. */
export async function liveResults(db: Db, event: EventRow): Promise<ResultEntry[]> {
  const [rows, stats, covers, cats] = await Promise.all([
    db
      .select()
      .from(booths)
      .where(and(eq(booths.eventId, event.id), eq(booths.status, "approved"))),
    db.select().from(boothStats).where(eq(boothStats.eventId, event.id)),
    coverRows(db, event.id),
    db.select().from(reviewCategories).where(eq(reviewCategories.eventId, event.id)),
  ]);
  const stat = new Map(stats.map((s) => [s.boothId, s]));
  const cover = new Map(covers.map((c) => [c.boothId, c.keyThumb]));
  const inputs: BoothResultInput[] = rows.map((b) => {
    const s = stat.get(b.id);
    return {
      boothId: b.id,
      name: b.name,
      boothNo: b.boothNo && b.boothNo.trim() !== "" ? b.boothNo : null,
      coverThumbKey: cover.get(b.id) ?? null,
      reviewCount: s?.reviewCount ?? 0,
      starSum: s?.starSum ?? 0,
      lastReviewAt: s?.lastReviewAt ?? null,
      categoryCounts: parseCounts(s?.categoryCountsJson ?? null),
    };
  });
  return buildResults(inputs, new Map(cats.map((c) => [c.id, c.label])), OPTS);
}

export function frozenResults(event: EventRow): ResultEntry[] | null {
  if (event.resultsPublishedAt === null || !event.resultsJson) return null;
  try {
    return JSON.parse(event.resultsJson) as ResultEntry[];
  } catch {
    return null;
  }
}

export function getPublicResults(event: EventRow): PublicResults {
  const results = frozenResults(event);
  return {
    published: results !== null,
    version: event.resultsVersion,
    publishedAt: event.resultsPublishedAt,
    results,
  };
}

const bump = { statsVersion: sql`${events.statsVersion} + 1` };

async function update(db: Db, d: Deps, id: string, set: Partial<typeof events.$inferInsert>) {
  await db
    .update(events)
    .set({ ...set, statsVersion: bump.statsVersion, updatedAt: d.now })
    .where(eq(events.id, id));
}

export async function setRatingsMode(db: Db, d: Deps, event: EventRow, mode: DisplayMode) {
  await update(db, d, event.id, { ratingsMode: mode });
}

/** Peringkat bergantung pada rating: tidak boleh dibuat 'visible' selagi rating 'hidden' (divalidasi di server). */
export async function setRankingMode(db: Db, d: Deps, event: EventRow, mode: DisplayMode) {
  if (mode === "visible" && event.ratingsMode === "hidden") {
    throw new ApiError("validation_error", "ratings_hidden");
  }
  await update(db, d, event.id, { rankingMode: mode });
}

/** "Umumkan hasil": bekukan hasil, tampilkan rating dan peringkat. Hanya setelah event selesai. */
export async function publishResults(db: Db, d: Deps, event: EventRow): Promise<ResultEntry[]> {
  if (event.eventEndAt > d.now) throw new ApiError("conflict", "event_not_ended");
  if (event.resultsPublishedAt !== null) throw new ApiError("conflict", "already_published");
  const results = await liveResults(db, event);
  await update(db, d, event.id, {
    resultsJson: JSON.stringify(results),
    resultsPublishedAt: d.now,
    resultsVersion: sql`${events.resultsVersion} + 1` as unknown as number,
    ratingsMode: "visible",
    rankingMode: "visible",
  });
  return results;
}

/** Bekukan ulang setelah admin menyunting review (B18). Hanya bila sudah diumumkan. */
export async function refreshResults(db: Db, d: Deps, event: EventRow): Promise<ResultEntry[]> {
  if (event.resultsPublishedAt === null) throw new ApiError("conflict", "results_not_published");
  const results = await liveResults(db, event);
  await update(db, d, event.id, {
    resultsJson: JSON.stringify(results),
    resultsVersion: sql`${events.resultsVersion} + 1` as unknown as number,
  });
  return results;
}

/** Putar animasi pemenang dari hasil yang sudah dibekukan. Tidak mengubah mode rating/peringkat. */
export async function revealResults(
  db: Db,
  d: Deps,
  event: EventRow,
  target: "screen" | "everyone",
): Promise<void> {
  if (event.resultsPublishedAt === null) throw new ApiError("conflict", "results_not_published");
  await update(db, d, event.id, {
    revealSeq: sql`${events.revealSeq} + 1` as unknown as number,
    revealStartedAt: d.now,
    revealTarget: target,
  });
}

/** Untuk panel admin: peringkat terkini, hasil beku, dan apakah keduanya berbeda ("Perbarui hasil"). */
export async function adminResults(db: Db, event: EventRow) {
  const live = await liveResults(db, event);
  const frozen = frozenResults(event);
  return {
    published: frozen !== null,
    publishedAt: event.resultsPublishedAt,
    version: event.resultsVersion,
    revealSeq: event.revealSeq,
    live,
    frozen,
    differs: frozen !== null && resultsDiffer(live, frozen),
  };
}
