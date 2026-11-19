import { CONFIG } from "@shared/config";
import { ApiError } from "@shared/errors";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import type { AppContext, AppEnv } from "../app-env";
import type { EventRow } from "../db/schema";
import { getDb } from "../lib/db";
import { edgeJson } from "../lib/edge-cache";
import { eventState, isPublicEvent } from "../lib/event";
import { getBoothDetail, getBoothProducts, getSnapshot } from "../services/public";
import { getPublicResults } from "../services/results";

/** Data publik hanya untuk event aktif yang terbit dan tidak disembunyikan (A0). */
const requirePublicEvent = createMiddleware<AppEnv>(async (c, next) => {
  if (!isPublicEvent(c.get("event"))) throw new ApiError("not_found", "event");
  await next();
});

const eventOf = (c: AppContext): EventRow => {
  const e = c.get("event");
  if (!e) throw new ApiError("not_found");
  return e;
};

/** Setelah event selesai data beku: cache lebih lama dan klien polling jarang (B8). */
const ttlFor = (c: AppContext, e: EventRow) =>
  eventState(e, c.get("now")()).frozen
    ? CONFIG.live.snapshotTtlSecAfterEnd
    : CONFIG.live.snapshotTtlSec;

/** Bagian kunci cache yang berubah saat admin mengubah apa pun (B17) atau event aktif berganti. */
const versionKey = (e: EventRow) => `a${e.activeVersion}:s${e.statsVersion}:r${e.resultsVersion}`;

// Snapshot, detail booth, produk, dan hasil lewat Cache API (lib/edge-cache): beban ke D1 tidak bergantung pada
// jumlah pengunjung. Peringkat/rating yang disembunyikan sudah dipangkas di service sebelum masuk cache (B20).
export const publicRoutes = new Hono<AppEnv>()
  .use("/api/snapshot", requirePublicEvent)
  .use("/api/results", requirePublicEvent)
  .use("/api/booths/*", requirePublicEvent)

  .get("/api/snapshot", (c) => {
    const event = eventOf(c);
    return edgeJson(
      c,
      { key: `snapshot:${event.id}:${versionKey(event)}`, ttlSec: ttlFor(c, event) },
      () => getSnapshot(getDb(c.env), event),
    );
  })

  .get("/api/results", (c) => {
    const event = eventOf(c);
    return edgeJson(
      c,
      { key: `results:${event.id}:${versionKey(event)}`, ttlSec: ttlFor(c, event) },
      async () => getPublicResults(event),
    );
  })

  .get("/api/booths/:id", (c) => {
    const event = eventOf(c);
    const frozen = eventState(event, c.get("now")()).frozen ? 1 : 0;
    return edgeJson(
      c,
      {
        key: `booth:${event.id}:${c.req.param("id")}:${versionKey(event)}:f${frozen}`,
        ttlSec: ttlFor(c, event),
      },
      async () => ({
        booth: await getBoothDetail(getDb(c.env), event, c.req.param("id"), c.get("now")()),
      }),
    );
  })

  .get("/api/booths/:id/products", (c) => {
    const event = eventOf(c);
    const frozen = eventState(event, c.get("now")()).frozen ? 1 : 0;
    return edgeJson(
      c,
      {
        key: `products:${event.id}:${c.req.param("id")}:${versionKey(event)}:f${frozen}`,
        ttlSec: ttlFor(c, event),
      },
      () => getBoothProducts(getDb(c.env), event, c.req.param("id"), c.get("now")()),
    );
  });
