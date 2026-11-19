// Laporan komentar oleh pengunjung (explore.md A15, B25). Hanya menulis baris laporan: TIDAK mengubah komentar
// apa pun; yang menyembunyikan hanya filter kata dan admin.

import { CONFIG } from "@shared/config";
import { ApiError } from "@shared/errors";
import type { REPORT_REASONS } from "@shared/schemas";
import { and, count, eq, gt, isNotNull } from "drizzle-orm";
import { reviewReports, reviews, type VisitorRow } from "../db/schema";
import type { Db } from "../lib/db";
import type { Deps } from "./visitors";

const HOUR_MS = 3_600_000;

export async function reportReviewAsVisitor(
  db: Db,
  d: Deps,
  o: {
    eventId: string;
    visitor: VisitorRow;
    reviewId: string;
    reason: (typeof REPORT_REASONS)[number];
    note: string | null;
  },
): Promise<{ alreadyReported: boolean }> {
  const review = await db
    .select()
    .from(reviews)
    .where(
      and(eq(reviews.id, o.reviewId), eq(reviews.eventId, o.eventId), isNotNull(reviews.comment)),
    )
    .get();
  // Hanya komentar yang memang tampil bagi pengunjung yang bisa dilaporkan (yang ditahan/disembunyikan tidak terlihat).
  const visible =
    review?.status === "visible" &&
    (review.commentStatus === "visible" || review.commentStatus === "masked");
  if (!review || !visible) throw new ApiError("not_found", "review");
  if (review.visitorId === o.visitor.id) throw new ApiError("validation_error", "own_review");

  const recent = await db
    .select({ n: count() })
    .from(reviewReports)
    .where(
      and(
        eq(reviewReports.reporterVisitorId, o.visitor.id),
        gt(reviewReports.createdAt, d.now - HOUR_MS),
      ),
    )
    .get();
  if ((recent?.n ?? 0) >= CONFIG.spam.maxReportsPerVisitorPerHour)
    throw new ApiError("rate_limited");

  const r = await db
    .insert(reviewReports)
    .values({
      id: d.newId(),
      eventId: o.eventId,
      reviewId: review.id,
      reporterRole: "visitor",
      reporterVisitorId: o.visitor.id,
      reason: o.reason,
      note: o.note,
      createdAt: d.now,
    })
    .onConflictDoNothing();
  return { alreadyReported: (r.meta?.changes ?? 0) === 0 };
}
