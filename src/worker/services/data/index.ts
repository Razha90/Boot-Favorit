// Data Grid admin (explore.md A3, B18): kueri per entity, tab Peringkat (hanya-baca, dihitung), dan ekspor CSV.

import { CONFIG } from "@shared/config";
import {
  type CellValue,
  GRID_COLUMNS,
  type GridEntity,
  type GridPage,
  type GridQuery,
  type GridRow,
} from "@shared/data-grid";
import { rankBooths } from "@shared/scoring";
import { and, eq } from "drizzle-orm";
import { boothStats, booths } from "../../db/schema";
import type { Db } from "../../lib/db";
import { runGrid } from "./engine";
import { SPECS } from "./specs";

const ranking = (stats: (typeof boothStats.$inferSelect)[]) =>
  rankBooths(
    stats.map((s) => ({
      boothId: s.boothId,
      reviewCount: s.reviewCount,
      starSum: s.starSum,
      lastReviewAt: s.lastReviewAt,
    })),
    {
      priorWeight: CONFIG.ranking.bayesPriorWeight,
      minReviewsToRank: CONFIG.ranking.minReviewsToRank,
    },
  );

/** Statistik booth yang tayang (sama dengan peringkat publik). */
async function approvedStats(db: Db, eventId: string) {
  const live = await db
    .select({ id: booths.id })
    .from(booths)
    .where(and(eq(booths.eventId, eventId), eq(booths.status, "approved")));
  const ids = new Set(live.map((b) => b.id));
  const stats = await db.select().from(boothStats).where(eq(boothStats.eventId, eventId));
  return stats.filter((s) => ids.has(s.boothId));
}

/** Tab Peringkat (hanya-baca): peringkat, rata-rata mentah, skor Bayesian, dan selisih dari peringkat di atasnya. */
async function rankingPage(db: Db, eventId: string, q: GridQuery): Promise<GridPage> {
  const [stats, rows] = await Promise.all([
    approvedStats(db, eventId),
    db
      .select({
        id: booths.id,
        name: booths.name,
        boothNo: booths.boothNo,
        updatedAt: booths.updatedAt,
      })
      .from(booths)
      .where(and(eq(booths.eventId, eventId), eq(booths.status, "approved"))),
  ]);
  const byId = new Map(rows.map((b) => [b.id, b]));
  const stat = new Map(stats.map((s) => [s.boothId, s]));
  const ranked = ranking(stats);
  const needle = q.q?.toLowerCase();

  const out: GridRow[] = [];
  let prevScore: number | null = null;
  for (const r of ranked) {
    const b = byId.get(r.boothId);
    if (!b) continue;
    out.push(
      row(
        b,
        r.rank,
        r.average,
        r.reviewCount,
        r.score,
        prevScore === null ? null : prevScore - r.score,
      ),
    );
    prevScore = r.score;
  }
  const rankedIds = new Set(ranked.map((r) => r.boothId));
  for (const b of [...rows].sort((a, c) => a.name.localeCompare(c.name, "id"))) {
    if (rankedIds.has(b.id)) continue;
    const s = stat.get(b.id);
    out.push(
      row(
        b,
        null,
        s && s.reviewCount > 0 ? s.starSum / s.reviewCount : null,
        s?.reviewCount ?? 0,
        null,
        null,
      ),
    );
  }
  const filtered = needle
    ? out.filter((r) => String(r.values.name).toLowerCase().includes(needle))
    : out;
  return {
    rows: filtered,
    next: null,
    summary: { total: filtered.length, avgStars: null, byStatus: {} },
  };
}

function row(
  b: { id: string; name: string; boothNo: string | null; updatedAt: number },
  rank: number | null,
  average: number | null,
  reviewCount: number,
  score: number | null,
  gap: number | null,
): GridRow {
  return {
    id: b.id,
    version: b.updatedAt,
    values: { rank, name: b.name, boothNo: b.boothNo, average, reviewCount, score, gap },
  };
}

/** Skor dan peringkat booth diisi dari seluruh statistik event (tidak bisa dihitung per baris di SQL). */
async function enrichBooths(db: Db, eventId: string, page: GridPage): Promise<GridPage> {
  const ranked = new Map(ranking(await approvedStats(db, eventId)).map((r) => [r.boothId, r]));
  for (const r of page.rows) {
    const x = ranked.get(r.id);
    r.values.score = x?.score ?? null;
    r.values.rank = x?.rank ?? null;
  }
  return page;
}

export async function queryGrid(
  db: Db,
  eventId: string,
  entity: GridEntity,
  q: GridQuery,
): Promise<GridPage> {
  if (entity === "ranking") return rankingPage(db, eventId, q);
  const page = await runGrid(db, SPECS[entity], eventId, q);
  return entity === "booths" ? enrichBooths(db, eventId, page) : page;
}

// ---------- Ekspor CSV ----------

/** Sel yang diawali = + - @ dianggap rumus oleh Excel: diberi awalan agar tidak dieksekusi (CSV injection). */
export function csvCell(v: CellValue): string {
  if (v === null) return "";
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "number") return String(v);
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const isDateKey = (entity: GridEntity, key: string) =>
  GRID_COLUMNS[entity].find((c) => c.key === key)?.type === "datetime";

/** CSV dialirkan per halaman kursor (tidak memuat seluruh data di memori). Tanggal = ISO UTC; hash tetap singkat. */
export function exportCsvStream(
  db: Db,
  eventId: string,
  entity: GridEntity,
  base: GridQuery,
): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  const keys = GRID_COLUMNS[entity].map((c) => c.key);
  let cursor: string | undefined = base.cursor;
  let started = false;
  let done = false;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!started) {
        started = true;
        // BOM agar Excel membaca UTF-8
        controller.enqueue(enc.encode(`﻿${keys.join(",")}\r\n`));
        return;
      }
      if (done) {
        controller.close();
        return;
      }
      const page = await queryGrid(db, eventId, entity, {
        ...base,
        cursor,
        limit: CONFIG.grid.exportPageSize,
      });
      const lines = page.rows.map((r) =>
        keys
          .map((k) => {
            const v = r.values[k] ?? null;
            return csvCell(
              typeof v === "number" && isDateKey(entity, k) ? new Date(v).toISOString() : v,
            );
          })
          .join(","),
      );
      if (lines.length > 0) controller.enqueue(enc.encode(`${lines.join("\r\n")}\r\n`));
      cursor = page.next ?? undefined;
      if (page.next === null) done = true;
    },
  });
}
