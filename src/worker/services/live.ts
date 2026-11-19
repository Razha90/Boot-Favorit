// Pembaca data untuk siaran realtime (explore.md B8). Dipanggil Durable Object SEKALI per tick (bukan per penonton):
// beban D1 tidak dikalikan jumlah penonton. Hasil berupa `LiveInput` murni untuk `LiveCore`.

import type { LiveInput } from "@shared/live-core";
import { visibility } from "@shared/results";
import { and, eq } from "drizzle-orm";
import { boothStats, booths, events } from "../db/schema";
import type { Db } from "../lib/db";
import { eventState } from "../lib/event";
import { latestReviews } from "./public-reviews";

const FEED_SIZE = 5;

export interface LiveSource {
  /** Event sudah selesai: siaran berhenti dan semua koneksi ditutup (B8) */
  ended: boolean;
  live: LiveInput;
}

export async function loadLiveInput(
  db: Db,
  eventId: string,
  pendingReviews: number,
  now: number,
): Promise<LiveSource | null> {
  const event = await db.select().from(events).where(eq(events.id, eventId)).get();
  if (!event) return null;
  const vis = visibility(event);

  const [rows, stats, feed] = await Promise.all([
    db
      .select({ id: booths.id })
      .from(booths)
      .where(and(eq(booths.eventId, eventId), eq(booths.status, "approved"))),
    db.select().from(boothStats).where(eq(boothStats.eventId, eventId)),
    latestReviews(db, event, vis.ratings, FEED_SIZE),
  ]);
  const approved = new Set(rows.map((b) => b.id));
  return {
    ended: eventState(event, now).frozen,
    live: {
      booths: stats
        .filter((s) => approved.has(s.boothId))
        .map((s) => ({
          id: s.boothId,
          count: s.reviewCount,
          sum: s.starSum,
          lastReviewAt: s.lastReviewAt,
        })),
      ratingsVisible: vis.ratings,
      rankingVisible: vis.ranking,
      feed,
      pendingReviews,
    },
  };
}
