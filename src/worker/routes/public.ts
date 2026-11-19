import { CONFIG } from "@shared/config";
import { ApiError } from "@shared/errors";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../app-env";
import { getDb } from "../lib/db";
import { isPublicEvent } from "../lib/event";
import { getBoothDetail, getBoothProducts, getSnapshot } from "../services/public";

/** Data publik hanya untuk event aktif yang terbit dan tidak disembunyikan (A0). */
const requirePublicEvent = createMiddleware<AppEnv>(async (c, next) => {
  if (!isPublicEvent(c.get("event"))) throw new ApiError("not_found", "event");
  await next();
});

const cacheHeader = (c: { header: (k: string, v: string) => void }) =>
  c.header("Cache-Control", `public, s-maxage=${CONFIG.live.snapshotTtlSec}`);

// Tahap 5: dibaca langsung dari D1 + header cache edge. Tahap 7 menggantinya dengan snapshot dari
// LiveHub (memori DO) + Cache API agar beban tidak bergantung pada jumlah pengunjung (B8).
export const publicRoutes = new Hono<AppEnv>()
  .use("/api/snapshot", requirePublicEvent)
  .use("/api/booths/*", requirePublicEvent)

  .get("/api/snapshot", async (c) => {
    const event = c.get("event");
    if (!event) throw new ApiError("not_found");
    cacheHeader(c);
    return c.json(await getSnapshot(getDb(c.env), event));
  })

  .get("/api/booths/:id", async (c) => {
    const event = c.get("event");
    if (!event) throw new ApiError("not_found");
    cacheHeader(c);
    return c.json({
      booth: await getBoothDetail(getDb(c.env), event, c.req.param("id"), c.get("now")()),
    });
  })

  .get("/api/booths/:id/products", async (c) => {
    const event = c.get("event");
    if (!event) throw new ApiError("not_found");
    cacheHeader(c);
    return c.json(await getBoothProducts(getDb(c.env), event, c.req.param("id"), c.get("now")()));
  });
