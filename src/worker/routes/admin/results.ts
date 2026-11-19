// Mode rating/peringkat, umumkan/perbarui hasil, dan animasi pemenang (explore.md A3, B10, B20).
import { rankingModeSchema, ratingsModeSchema } from "@shared/schemas";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../app-env";
import { getDb } from "../../lib/db";
import { adminIdempotencyActor, logAdmin, parseBody, serviceDeps } from "../../lib/http";
import { idempotency } from "../../middleware/idempotency";
import { getEventOrThrow } from "../../services/events";
import {
  adminResults,
  publishResults,
  refreshResults,
  revealResults,
  setRankingMode,
  setRatingsMode,
} from "../../services/results";

const keyed = idempotency({ required: true, actor: adminIdempotencyActor });
const modeBody = (s: typeof ratingsModeSchema) => z.object({ mode: s }).strict();
const revealBody = z.object({ target: z.enum(["screen", "everyone"]) }).strict();

export const adminResultsRoutes = new Hono<AppEnv>()
  .get("/api/admin/e/:id/results", async (c) => {
    const db = getDb(c.env);
    return c.json(await adminResults(db, await getEventOrThrow(db, c.req.param("id"))));
  })

  .put("/api/admin/events/:id/ratings-mode", keyed, async (c) => {
    const db = getDb(c.env);
    const event = await getEventOrThrow(db, c.req.param("id"));
    const { mode } = await parseBody(c, modeBody(ratingsModeSchema));
    await setRatingsMode(db, serviceDeps(c), event, mode);
    await logAdmin(c, event.id, {
      action: "admin.ratings_mode_changed",
      meta: { before: event.ratingsMode, after: mode },
    });
    return c.json({ ok: true });
  })

  .put("/api/admin/events/:id/ranking-mode", keyed, async (c) => {
    const db = getDb(c.env);
    const event = await getEventOrThrow(db, c.req.param("id"));
    const { mode } = await parseBody(c, modeBody(rankingModeSchema));
    await setRankingMode(db, serviceDeps(c), event, mode);
    await logAdmin(c, event.id, {
      action: "admin.ranking_mode_changed",
      meta: { before: event.rankingMode, after: mode },
    });
    return c.json({ ok: true });
  })

  .post("/api/admin/events/:id/publish-results", keyed, async (c) => {
    const db = getDb(c.env);
    const event = await getEventOrThrow(db, c.req.param("id"));
    const results = await publishResults(db, serviceDeps(c), event);
    await logAdmin(c, event.id, {
      action: "admin.results_published",
      meta: { booths: results.length },
    });
    return c.json({ ok: true, booths: results.length });
  })

  .post("/api/admin/events/:id/refresh-results", keyed, async (c) => {
    const db = getDb(c.env);
    const event = await getEventOrThrow(db, c.req.param("id"));
    const results = await refreshResults(db, serviceDeps(c), event);
    await logAdmin(c, event.id, {
      action: "admin.results_refreshed",
      meta: { booths: results.length },
    });
    return c.json({ ok: true, booths: results.length });
  })

  .post("/api/admin/events/:id/reveal", keyed, async (c) => {
    const db = getDb(c.env);
    const event = await getEventOrThrow(db, c.req.param("id"));
    const { target } = await parseBody(c, revealBody);
    await revealResults(db, serviceDeps(c), event, target);
    await logAdmin(c, event.id, { action: "admin.reveal_played", meta: { target } });
    return c.json({ ok: true });
  });
