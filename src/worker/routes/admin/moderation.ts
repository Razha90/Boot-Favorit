// Moderasi oleh admin (explore.md A15, B25, B10): antrean, keputusan, sunting/pulihkan/hapus review, daftar kata,
// blokir pengunjung. Semua mengubah data dengan alasan wajib (di skema) dan masuk log admin.

import {
  adminCommentStatusSchema,
  adminReasonOnlySchema,
  adminReviewPatchSchema,
  moderationTermsPutSchema,
  moderationTestSchema,
  reportDecisionSchema,
  visitorBlockSchema,
} from "@shared/schemas";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../app-env";
import { getDb } from "../../lib/db";
import {
  adminActor,
  adminIdempotencyActor,
  logAdmin,
  parseBody,
  serviceDeps,
} from "../../lib/http";
import { idempotency } from "../../middleware/idempotency";
import {
  decideReport,
  deleteReview,
  getQueue,
  listAllReviews,
  patchReview,
  restoreReview,
  setCommentStatus,
  setVisitorBlocked,
} from "../../services/admin-moderation";
import { listTerms, testSentence, upsertTerms } from "../../services/moderation";

const keyed = idempotency({ required: true, actor: adminIdempotencyActor });
const P = "/api/admin/e/:id";

const listQuery = z.object({
  boothId: z.string().min(1).optional(),
  stars: z.coerce.number().int().min(1).max(5).optional(),
  status: z.enum(["visible", "held", "hidden"]).optional(),
  commentStatus: z.enum(["visible", "masked", "held", "hidden"]).optional(),
  visitorId: z.string().min(1).optional(),
});

export const adminModerationRoutes = new Hono<AppEnv>()
  .get(`${P}/reviews`, async (c) =>
    c.json({
      reviews: await listAllReviews(
        getDb(c.env),
        c.req.param("id"),
        listQuery.parse(c.req.query()),
      ),
    }),
  )

  .get(`${P}/moderation/queue`, async (c) =>
    c.json(await getQueue(getDb(c.env), c.req.param("id"))),
  )

  .post(`${P}/moderation/reports/:rid`, keyed, async (c) => {
    const eventId = c.req.param("id");
    const body = await parseBody(c, reportDecisionSchema);
    const actor = (await adminActor(c)).id;
    const review = await decideReport(
      getDb(c.env),
      serviceDeps(c),
      eventId,
      c.req.param("rid"),
      body,
      actor,
    );
    await logAdmin(c, eventId, {
      action: "moderation.report_decided",
      target: { type: "review", id: review.id },
      meta: { decision: body.decision, action: body.action },
    });
    return c.json({ review });
  })

  .patch(`${P}/reviews/:rid/comment`, keyed, async (c) => {
    const eventId = c.req.param("id");
    const body = await parseBody(c, adminCommentStatusSchema);
    const review = await setCommentStatus(
      getDb(c.env),
      serviceDeps(c),
      eventId,
      c.req.param("rid"),
      body,
      (await adminActor(c)).id,
    );
    await logAdmin(c, eventId, {
      action: body.commentStatus === "hidden" ? "review.hidden" : "review.restored",
      target: { type: "review", id: review.id },
      meta: { commentStatus: body.commentStatus },
    });
    return c.json({ review });
  })

  .patch(`${P}/reviews/:rid`, keyed, async (c) => {
    const eventId = c.req.param("id");
    const body = await parseBody(c, adminReviewPatchSchema);
    const review = await patchReview(
      getDb(c.env),
      serviceDeps(c),
      eventId,
      c.req.param("rid"),
      body,
      (await adminActor(c)).id,
    );
    await logAdmin(c, eventId, {
      action: "admin.review_edited",
      target: { type: "review", id: review.id },
      meta: { fields: Object.keys(body).filter((k) => k !== "reason") },
    });
    return c.json({ review });
  })

  .post(`${P}/reviews/:rid/restore`, keyed, async (c) => {
    const eventId = c.req.param("id");
    const body = await parseBody(c, adminReasonOnlySchema);
    const review = await restoreReview(
      getDb(c.env),
      serviceDeps(c),
      eventId,
      c.req.param("rid"),
      body.reason,
      (await adminActor(c)).id,
    );
    await logAdmin(c, eventId, {
      action: "review.restored",
      target: { type: "review", id: review.id },
    });
    return c.json({ review });
  })

  .delete(`${P}/reviews/:rid`, keyed, async (c) => {
    const eventId = c.req.param("id");
    // Alasan lewat query: DELETE tanpa badan. Divalidasi dengan skema yang sama.
    const { reason } = adminReasonOnlySchema.parse({ reason: c.req.query("reason") });
    await deleteReview(getDb(c.env), serviceDeps(c), eventId, c.req.param("rid"));
    await logAdmin(c, eventId, {
      action: "admin.review_deleted",
      target: { type: "review", id: c.req.param("rid") },
      meta: { reason },
    });
    return c.json({ ok: true });
  })

  .get(`${P}/moderation/terms`, async (c) =>
    c.json({ terms: await listTerms(getDb(c.env), c.req.param("id"), serviceDeps(c)) }),
  )

  .put(`${P}/moderation/terms`, keyed, async (c) => {
    const eventId = c.req.param("id");
    const body = await parseBody(c, moderationTermsPutSchema);
    const terms = await upsertTerms(
      getDb(c.env),
      eventId,
      body.terms,
      serviceDeps(c),
      (await adminActor(c)).id,
    );
    // Log memuat jumlah dan alasan, TIDAK memuat daftar kata (B25).
    await logAdmin(c, eventId, {
      action: "moderation.terms_changed",
      meta: { count: body.terms.length, reason: body.reason },
    });
    return c.json({ terms });
  })

  .post(`${P}/moderation/test`, async (c) => {
    const body = await parseBody(c, moderationTestSchema);
    return c.json(await testSentence(getDb(c.env), c.req.param("id"), body.text, serviceDeps(c)));
  })

  .put(`${P}/visitors/:vid/blocked`, keyed, async (c) => {
    const eventId = c.req.param("id");
    const body = await parseBody(c, visitorBlockSchema);
    await setVisitorBlocked(
      getDb(c.env),
      serviceDeps(c),
      eventId,
      c.req.param("vid"),
      body.blocked,
    );
    await logAdmin(c, eventId, {
      action: "admin.visitor_blocked",
      target: { type: "visitor", id: c.req.param("vid") },
      meta: { blocked: body.blocked, reason: body.reason },
    });
    return c.json({ ok: true });
  });
