import { CONFIG } from "@shared/config";
import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { AppEnv } from "../app-env";
import { reviewCategories } from "../db/schema";
import { getDb } from "../lib/db";
import { eventSchedule, eventState, isPublicEvent } from "../lib/event";
import { eventMedia } from "../services/public";

// GET /api/event: info event aktif + jadwal + serverNow (explore.md B10).
// Client menghitung offset = serverNow − Date.now() agar jam HP yang salah tidak memengaruhi
// tombol yang muncul/hilang (B17).
export const eventRoutes = new Hono<AppEnv>().get("/api/event", async (c) => {
  const now = c.get("now")();
  const event = c.get("event");

  // Edge cache singkat; admin mengganti jadwal terlihat dalam hitungan detik.
  c.header("Cache-Control", `public, s-maxage=${CONFIG.live.snapshotTtlSec}`);

  if (!isPublicEvent(event)) return c.json({ event: null, serverNow: now });

  const categories = await getDb(c.env)
    .select({ id: reviewCategories.id, label: reviewCategories.label })
    .from(reviewCategories)
    .where(and(eq(reviewCategories.eventId, event.id), eq(reviewCategories.active, 1)))
    .orderBy(asc(reviewCategories.position));

  return c.json({
    event: {
      id: event.id,
      name: event.name,
      titleHighlight: event.titleHighlight,
      timezone: event.timezone,
      schedule: eventSchedule(event),
      state: eventState(event, now),
      ratingsMode: event.ratingsMode,
      rankingMode: event.rankingMode,
      // Kunci cache: berubah saat event aktif berganti, statistik berubah, atau hasil diumumkan.
      versions: {
        active: event.activeVersion,
        stats: event.statsVersion,
        results: event.resultsVersion,
      },
      reviewCategories: categories,
      media: eventMedia(event),
    },
    serverNow: now,
  });
});
