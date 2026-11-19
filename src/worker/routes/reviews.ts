// Review dan laporan oleh pengunjung (explore.md A5, A15, B9, B25).
// Tidak ada rute apa pun di sini (atau di area publik lain) yang mengubah `status`/`comment_status`: itu hanya admin.

import type { MyReview } from "@shared/api-types";
import { CONFIG } from "@shared/config";
import { reportRequestSchema, reviewRequestSchema } from "@shared/schemas";
import { Hono } from "hono";
import type { AppContext, AppEnv } from "../app-env";
import type { EventRow, VisitorRow } from "../db/schema";
import { getDb } from "../lib/db";
import { parseBody, serviceDeps } from "../lib/http";
import { sessionSecret, signalHash } from "../lib/identity";
import { logEvent } from "../lib/logger";
import { assertHuman, type TurnstileVerifier } from "../lib/turnstile";
import { requireEvent, requireVotingOpen } from "../middleware/event-gate";
import { idempotency } from "../middleware/idempotency";
import { rateLimit } from "../middleware/rate-limit";
import {
  loadVisitor,
  requireVisitor,
  visitorIdempotencyActor,
} from "../middleware/visitor-session";
import { ratingsVisible } from "../services/public";
import { listPublicReviews } from "../services/public-reviews";
import { reportReviewAsVisitor } from "../services/reports";
import { myReviews, submitReview, toMyReview } from "../services/reviews";

const keyed = idempotency({ required: true, actor: visitorIdempotencyActor });
const visitorKey = (c: AppContext) =>
  c.get("visitor")?.id ?? c.req.header("cf-connecting-ip") ?? "x";

export function createReviewRoutes(deps: { turnstile?: TurnstileVerifier } = {}) {
  const app = new Hono<AppEnv>();

  app.get("/api/booths/:id/reviews", requireEvent, async (c) => {
    const event = c.get("event") as EventRow;
    return c.json(
      await listPublicReviews(
        getDb(c.env),
        event,
        c.req.param("id"),
        ratingsVisible(event),
        c.req.query("cursor"),
      ),
    );
  });

  app.get("/api/me/reviews", requireEvent, loadVisitor, requireVisitor, async (c) => {
    const event = c.get("event") as EventRow;
    const v = c.get("visitor") as VisitorRow;
    const rows = await myReviews(getDb(c.env), event.id, v.id);
    c.header("Cache-Control", "no-store");
    return c.json({ reviews: rows.map((r): MyReview => toMyReview(r)) });
  });

  app.post(
    "/api/booths/:id/review",
    requireEvent,
    requireVotingOpen,
    loadVisitor,
    requireVisitor,
    rateLimit({
      name: "review",
      limit: CONFIG.spam.maxReviewsPerVisitorPerMinute,
      windowSec: 60,
      key: visitorKey,
    }),
    keyed,
    async (c) => {
      const event = c.get("event") as EventRow;
      const visitor = c.get("visitor") as VisitorRow;
      const body = await parseBody(c, reviewRequestSchema);
      await assertHuman(c, body.turnstileToken, deps.turnstile);
      const secret = sessionSecret(c.env);
      const { turnstileToken: _t, ...input } = body;

      const result = await submitReview(getDb(c.env), serviceDeps(c), {
        event,
        visitor,
        boothId: c.req.param("id"),
        input,
        secret,
        ipHash: await signalHash(secret, c.req.header("cf-connecting-ip")),
        uaHash: await signalHash(secret, c.req.header("user-agent")),
      });

      // Log tanpa isi komentar dan tanpa kata yang tertangkap (B13, B25).
      logEvent(c, {
        eventId: event.id,
        category: "review",
        action: result.created ? "review.created" : "review.updated",
        actor: { type: "visitor", id: visitor.id },
        target: { type: "booth", id: result.review.boothId },
        meta: { stars: result.review.stars, commentHeld: result.commentHeld },
      });
      return c.json(result, result.created ? 201 : 200);
    },
  );

  app.post(
    "/api/reviews/:id/report",
    requireEvent,
    loadVisitor,
    requireVisitor,
    rateLimit({ name: "report", limit: 10, windowSec: 60, key: visitorKey }),
    keyed,
    async (c) => {
      const event = c.get("event") as EventRow;
      const visitor = c.get("visitor") as VisitorRow;
      const body = await parseBody(c, reportRequestSchema);
      await assertHuman(c, body.turnstileToken, deps.turnstile);
      const r = await reportReviewAsVisitor(getDb(c.env), serviceDeps(c), {
        eventId: event.id,
        visitor,
        reviewId: c.req.param("id"),
        reason: body.reason,
        note: body.note,
      });
      logEvent(c, {
        eventId: event.id,
        category: "review",
        action: "review.reported",
        actor: { type: "visitor", id: visitor.id },
        target: { type: "review", id: c.req.param("id") },
        meta: { reason: body.reason },
      });
      return c.json({ ok: true, alreadyReported: r.alreadyReported });
    },
  );

  return app;
}
