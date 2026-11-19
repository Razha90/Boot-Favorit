// Review pengunjung (explore.md A5, A6, A15, B9, B25). Alur kirim: validasi → filter kata (hanya teks) → skor risiko
// (hanya menahan) → tulis review + hitung ulang booth_stats dalam SATU batch() D1 → ringkasan terima kasih.

import type { MyReview, ReviewSubmitResult } from "@shared/api-types";
import { ApiError } from "@shared/errors";
import { fairOrder } from "@shared/fair-order";
import { computeRisk, shouldHold } from "@shared/risk";
import type { ReviewInput } from "@shared/schemas";
import { and, count, eq, gt, ne } from "drizzle-orm";
import {
  type BoothRow,
  booths,
  type EventRow,
  type ReviewRow,
  reviewCategories,
  reviews,
  type VisitorRow,
} from "../db/schema";
import { type Db, runBatch } from "../lib/db";
import { emailIdentity } from "../lib/identity";
import { checkComment } from "./moderation";
import { recomputeStatsStatement } from "./stats";
import type { Deps } from "./visitors";

export const parseIds = (json: string | null): string[] => {
  try {
    const v = json ? JSON.parse(json) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};

export const toMyReview = (r: ReviewRow): MyReview => ({
  boothId: r.boothId,
  stars: r.stars,
  comment: r.comment,
  categoryIds: parseIds(r.categoryIdsJson),
  anonymous: r.anonymous === 1,
});

export async function getApprovedBoothRow(db: Db, eventId: string, id: string): Promise<BoothRow> {
  const b = await db
    .select()
    .from(booths)
    .where(and(eq(booths.id, id), eq(booths.eventId, eventId), eq(booths.status, "approved")))
    .get();
  if (!b) throw new ApiError("not_found", "booth");
  return b;
}

export interface SubmitContext {
  event: EventRow;
  visitor: VisitorRow;
  boothId: string;
  input: ReviewInput;
  secret: string;
  ipHash: string | null;
  uaHash: string | null;
}

export async function submitReview(db: Db, d: Deps, x: SubmitContext): Promise<ReviewSubmitResult> {
  const { event, visitor, input } = x;
  const booth = await getApprovedBoothRow(db, event.id, x.boothId);

  // Booth menilai diri sendiri: bandingkan identitas dengan email booth (HMAC yang sama). Booth tanpa email dilewati.
  if (booth.email && visitor.identityHash === (await emailIdentity(x.secret, booth.email))) {
    throw new ApiError("own_booth");
  }

  // Kategori: hanya yang aktif milik event ini.
  const active = await db
    .select({ id: reviewCategories.id })
    .from(reviewCategories)
    .where(and(eq(reviewCategories.eventId, event.id), eq(reviewCategories.active, 1)));
  const activeIds = new Set(active.map((c) => c.id));
  if (input.categoryIds.some((id) => !activeIds.has(id))) {
    throw new ApiError("validation_error", "unknown_category");
  }

  const existing = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.boothId, booth.id), eq(reviews.visitorId, visitor.id)))
    .get();

  // ---- Filter kata: hanya teks komentar; bintang tidak pernah terpengaruh ----
  const comment = input.comment;
  let commentStatus: ReviewRow["commentStatus"] = "visible";
  let commentMasked: string | null = null;
  let hitIds: string[] = [];
  let filterVersion: number | null = null;
  const sameText = existing !== undefined && existing.comment === comment;

  if (comment && sameText && existing && existing.commentStatus !== "visible") {
    // Teks sama: keputusan sebelumnya (filter atau admin) dipertahankan; mengirim ulang tidak melepas tahanan.
    commentStatus = existing.commentStatus;
    commentMasked = existing.commentMasked;
    hitIds = parseIds(existing.filterHitsJson);
    filterVersion = existing.filterVersion;
  } else if (comment) {
    const r = await checkComment(db, event.id, comment, d);
    commentStatus = r.status;
    commentMasked = r.masked;
    hitIds = r.hits;
    filterVersion = r.version;
  }

  // ---- Skor risiko: hanya menahan review (diam-diam) untuk dicek admin ----
  const [burst, sameIp, others] = await Promise.all([
    db
      .select({ n: count() })
      .from(reviews)
      .where(and(eq(reviews.boothId, booth.id), gt(reviews.createdAt, d.now - 60_000)))
      .get(),
    x.ipHash
      ? db
          .select({ n: count() })
          .from(reviews)
          .where(
            and(
              eq(reviews.boothId, booth.id),
              eq(reviews.ipHash, x.ipHash),
              ne(reviews.visitorId, visitor.id),
            ),
          )
          .get()
      : Promise.resolve({ n: 0 }),
    db
      .select({ stars: reviews.stars })
      .from(reviews)
      .where(and(eq(reviews.visitorId, visitor.id), ne(reviews.boothId, booth.id))),
  ]);
  const risk = computeRisk({
    stars: input.stars,
    hasComment: !!comment,
    boothReviewsLastMinute: burst?.n ?? 0,
    sameIpBoothReviews: sameIp?.n ?? 0,
    visitorAgeMs: d.now - visitor.createdAt,
    otherStars: others.map((o) => o.stars),
    filterHit: hitIds.length > 0,
  });

  // Yang sudah `hidden`/`held` oleh admin atau risiko tetap begitu sampai admin memutuskan.
  const status: ReviewRow["status"] =
    existing?.status === "hidden" || existing?.status === "held"
      ? existing.status
      : shouldHold(risk.score)
        ? "held"
        : "visible";

  const values = {
    stars: input.stars,
    comment,
    categoryIdsJson: JSON.stringify(input.categoryIds),
    anonymous: input.anonymous ? 1 : 0,
    status,
    commentStatus,
    commentMasked,
    filterHitsJson: JSON.stringify(hitIds),
    filterVersion,
    commentLocked: sameText && existing ? existing.commentLocked : 0,
    riskScore: risk.score,
    flagsJson: JSON.stringify(risk.flags),
    ipHash: x.ipHash,
    uaHash: x.uaHash,
    updatedAt: d.now,
  };

  await runBatch(db, [
    db
      .insert(reviews)
      .values({
        id: d.newId(),
        eventId: event.id,
        boothId: booth.id,
        visitorId: visitor.id,
        createdAt: d.now,
        ...values,
      })
      .onConflictDoUpdate({ target: [reviews.boothId, reviews.visitorId], set: values }),
    recomputeStatsStatement(db, booth.id, d.now),
  ]);

  const saved = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.boothId, booth.id), eq(reviews.visitorId, visitor.id)))
    .get();
  if (!saved) throw new ApiError("internal_error", "review_not_saved");

  return {
    review: toMyReview(saved),
    created: existing === undefined,
    commentHeld: commentStatus === "held",
    ...(await progressFor(db, event.id, visitor.id)),
  };
}

/** Ringkasan "Kamu sudah menilai N dari M booth" + 3 booth lain yang belum dinilai (urutan acak per pengunjung). */
export async function progressFor(
  db: Db,
  eventId: string,
  visitorId: string,
): Promise<Pick<ReviewSubmitResult, "progress" | "suggestions">> {
  const [all, mine] = await Promise.all([
    db
      .select({ id: booths.id, name: booths.name })
      .from(booths)
      .where(and(eq(booths.eventId, eventId), eq(booths.status, "approved"))),
    db.select({ boothId: reviews.boothId }).from(reviews).where(eq(reviews.visitorId, visitorId)),
  ]);
  const done = new Set(mine.map((m) => m.boothId));
  const todo = all.filter((b) => !done.has(b.id));
  return {
    progress: { reviewed: all.length - todo.length, total: all.length },
    suggestions: fairOrder(todo, visitorId).slice(0, 3),
  };
}

export async function myReviews(db: Db, eventId: string, visitorId: string): Promise<ReviewRow[]> {
  return db
    .select()
    .from(reviews)
    .where(and(eq(reviews.eventId, eventId), eq(reviews.visitorId, visitorId)));
}
