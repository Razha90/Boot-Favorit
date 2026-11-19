// Log aktivitas & kesehatan hari-H untuk admin (explore.md B10, B12, B13).
import type { EventHealth, LogsResponse } from "@shared/api-types";
import { CONFIG } from "@shared/config";
import { LOG_ACTIONS, LOG_CATEGORIES, LOG_LEVELS } from "@shared/log-events";
import { and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../app-env";
import { booths, reviewReports, reviews } from "../../db/schema";
import {
  isSafeLogId,
  LOG_RANGES,
  type LogFetcher,
  logsConfigured,
  queryLogs,
} from "../../lib/analytics-logs";
import { getDb } from "../../lib/db";
import { getEventOrThrow } from "../../services/events";

const safeId = z.string().refine(isSafeLogId, "unsafe_id");
const query = z.object({
  range: z
    .enum(Object.keys(LOG_RANGES) as [keyof typeof LOG_RANGES, ...(keyof typeof LOG_RANGES)[]])
    .default(CONFIG.logs.defaultRange),
  category: z.enum(LOG_CATEGORIES).optional(),
  level: z.enum(LOG_LEVELS).optional(),
  action: z.enum(LOG_ACTIONS).optional(),
  actor: safeId.optional(),
  target: safeId.optional(),
});

export function createAdminLogRoutes(deps: { logFetcher?: LogFetcher } = {}) {
  return new Hono<AppEnv>()
    .get("/api/admin/e/:id/logs", async (c) => {
      const eventId = c.req.param("id");
      await getEventOrThrow(getDb(c.env), eventId); // id event divalidasi ke D1 sebelum masuk SQL AE
      const q = query.parse(c.req.query());
      c.header("Cache-Control", "private, max-age=10"); // jeda singkat agar penyegaran berulang tidak menghabiskan kuota baca
      if (!logsConfigured(c.env)) {
        return c.json<LogsResponse>({ configured: false, entries: [] });
      }
      const entries = await queryLogs(c.env, { eventId, ...q }, deps.logFetcher);
      return c.json<LogsResponse>({ configured: true, entries });
    })

    .get("/api/admin/e/:id/health", async (c) => {
      const eventId = c.req.param("id");
      const db = getDb(c.env);
      await getEventOrThrow(db, eventId);
      const now = c.get("now")();
      const [revStats, repCount, boothCount, wsStats] = await Promise.all([
        db
          .select({
            total: sql<number>`COUNT(*)`,
            held: sql<number>`COALESCE(SUM(CASE WHEN ${reviews.status} = 'held' OR ${reviews.commentStatus} = 'held' THEN 1 ELSE 0 END), 0)`,
            lastMinute: sql<number>`COALESCE(SUM(CASE WHEN ${reviews.createdAt} >= ${now - 60_000} THEN 1 ELSE 0 END), 0)`,
            lastHour: sql<number>`COALESCE(SUM(CASE WHEN ${reviews.createdAt} >= ${now - 3_600_000} THEN 1 ELSE 0 END), 0)`,
          })
          .from(reviews)
          .where(eq(reviews.eventId, eventId))
          .get(),
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(reviewReports)
          .where(and(eq(reviewReports.eventId, eventId), eq(reviewReports.status, "open")))
          .get(),
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(booths)
          .where(and(eq(booths.eventId, eventId), eq(booths.status, "pending")))
          .get(),
        readLiveStats(c.env, eventId),
      ]);
      return c.json<EventHealth>({
        liveViewers: wsStats.viewers,
        liveScreens: wsStats.screens,
        maxLiveViewers: CONFIG.live.maxLiveViewers,
        reviewsLastMinute: Number(revStats?.lastMinute ?? 0),
        reviewsLastHour: Number(revStats?.lastHour ?? 0),
        totalReviews: Number(revStats?.total ?? 0),
        heldReviews: Number(revStats?.held ?? 0),
        openReports: Number(repCount?.count ?? 0),
        pendingBooths: Number(boothCount?.count ?? 0),
        measuredAt: now,
      });
    });
}

async function readLiveStats(env: Env, eventId: string) {
  try {
    const id = env.LIVE_HUB.idFromName(eventId);
    return await env.LIVE_HUB.get(id).stats();
  } catch {
    return { viewers: 0, screens: 0, pending: 0 };
  }
}
