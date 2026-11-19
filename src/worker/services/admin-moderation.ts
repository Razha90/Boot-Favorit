// Moderasi oleh admin (explore.md A15, B25, B18): antrean laporan + komentar ditahan, keputusan, sunting/sembunyikan/
// pulihkan/hapus review. Setiap perubahan = SATU batch(): ubah review → hitung ulang booth_stats → naikkan
// stats_version → catat keputusan laporan. Nilai asli (`original_*`) tidak pernah ditimpa. Alasan wajib (di skema).

import type {
  AdminModerationQueue,
  AdminReport,
  AdminReportGroup,
  AdminReview,
} from "@shared/api-types";
import { CONFIG } from "@shared/config";
import { ApiError } from "@shared/errors";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { booths, events, type ReviewRow, reviewReports, reviews, visitors } from "../db/schema";
import { type Db, runBatch } from "../lib/db";
import { parseIds } from "./reviews";
import { recomputeStatsStatement } from "./stats";
import type { Deps } from "./visitors";

const bump = (db: Db, eventId: string, now: number) =>
  db
    .update(events)
    .set({ statsVersion: sql`${events.statsVersion} + 1`, updatedAt: now })
    .where(eq(events.id, eventId));

async function loadReview(db: Db, eventId: string, id: string): Promise<ReviewRow> {
  const r = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.id, id), eq(reviews.eventId, eventId)))
    .get();
  if (!r) throw new ApiError("not_found", "review");
  return r;
}

const flags = (json: string | null): string[] => parseIds(json);

type ReviewJoin = {
  r: ReviewRow;
  boothName: string | null;
  displayName: string | null;
};

const toAdminReview = ({ r, boothName, displayName }: ReviewJoin): AdminReview => ({
  id: r.id,
  boothId: r.boothId,
  boothName: boothName ?? "",
  visitorId: r.visitorId,
  displayName,
  stars: r.stars,
  comment: r.comment,
  commentStatus: r.commentStatus,
  commentMasked: r.commentMasked,
  status: r.status,
  filterHits: parseIds(r.filterHitsJson).length,
  commentLocked: r.commentLocked === 1,
  riskScore: r.riskScore,
  flags: flags(r.flagsJson),
  originalStars: r.originalStars,
  originalComment: r.originalComment,
  moderationReason: r.moderationReason,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

const joined = (db: Db) =>
  db
    .select({ r: reviews, boothName: booths.name, displayName: visitors.displayName })
    .from(reviews)
    .leftJoin(booths, eq(booths.id, reviews.boothId))
    .leftJoin(visitors, eq(visitors.id, reviews.visitorId));

export interface ReviewFilters {
  boothId?: string;
  stars?: number;
  status?: ReviewRow["status"];
  commentStatus?: ReviewRow["commentStatus"];
  visitorId?: string;
}

export async function listAllReviews(
  db: Db,
  eventId: string,
  f: ReviewFilters,
): Promise<AdminReview[]> {
  const rows = await joined(db)
    .where(
      and(
        eq(reviews.eventId, eventId),
        f.boothId ? eq(reviews.boothId, f.boothId) : undefined,
        f.stars ? eq(reviews.stars, f.stars) : undefined,
        f.status ? eq(reviews.status, f.status) : undefined,
        f.commentStatus ? eq(reviews.commentStatus, f.commentStatus) : undefined,
        f.visitorId ? eq(reviews.visitorId, f.visitorId) : undefined,
      ),
    )
    .orderBy(desc(reviews.createdAt))
    .limit(200);
  return rows.map(toAdminReview);
}

// ---------- Antrean ----------

const REASON_PRIORITY: Record<AdminReport["reason"], number> = {
  hate: 0,
  personal_data: 1,
  profanity: 2,
  spam: 3,
  other: 4,
};

export async function getQueue(db: Db, eventId: string): Promise<AdminModerationQueue> {
  const reportRows = await db
    .select()
    .from(reviewReports)
    .where(and(eq(reviewReports.eventId, eventId), eq(reviewReports.status, "open")));

  const reviewIds = [...new Set(reportRows.map((r) => r.reviewId))];
  const reviewRows =
    reviewIds.length === 0
      ? []
      : await joined(db).where(
          and(
            eq(reviews.eventId, eventId),
            inArray(reviews.id, reviewIds),
            eq(reviews.commentLocked, 0),
          ),
        );
  const byId = new Map(reviewRows.map((x) => [x.r.id, x]));
  const suspicious = await suspiciousBoothReporters(db, eventId);

  const groups: AdminReportGroup[] = [];
  for (const id of reviewIds) {
    const rv = byId.get(id); // komentar terkunci (dipulihkan admin) tidak muncul lagi di antrean
    if (!rv) continue;
    const reports: AdminReport[] = reportRows
      .filter((r) => r.reviewId === id)
      .map((r) => ({
        id: r.id,
        reviewId: r.reviewId,
        reporterRole: r.reporterRole,
        reason: r.reason,
        note: r.note,
        status: r.status,
        createdAt: r.createdAt,
      }));
    groups.push({
      review: toAdminReview(rv),
      reports,
      priority: Math.min(...reports.map((r) => REASON_PRIORITY[r.reason])),
      suspiciousReporter: reportRows.some(
        (r) => r.reviewId === id && r.reporterBoothId && suspicious.has(r.reporterBoothId),
      ),
    });
  }
  groups.sort(
    (a, b) =>
      a.priority - b.priority ||
      b.reports.length - a.reports.length ||
      a.review.createdAt - b.review.createdAt,
  );

  const reported = new Set(reviewIds);
  const held = (
    await joined(db)
      .where(
        and(
          eq(reviews.eventId, eventId),
          sql`(${reviews.commentStatus} = 'held' OR ${reviews.status} = 'held')`,
        ),
      )
      .orderBy(desc(reviews.createdAt))
      .limit(200)
  )
    .filter((x) => !reported.has(x.r.id))
    .map(toAdminReview);

  return { reports: groups, held };
}

/**
 * Booth yang sebagian besar laporannya menyasar komentar berbintang ≤ 3 TANPA temuan filter (A15). Laporan tidak
 * menyembunyikan apa pun, jadi ini hanya penanda untuk admin.
 */
async function suspiciousBoothReporters(db: Db, eventId: string): Promise<Set<string>> {
  const rows = await db
    .select({
      boothId: reviewReports.reporterBoothId,
      stars: reviews.stars,
      hits: reviews.filterHitsJson,
    })
    .from(reviewReports)
    .innerJoin(reviews, eq(reviews.id, reviewReports.reviewId))
    .where(and(eq(reviewReports.eventId, eventId), eq(reviewReports.reporterRole, "booth")));
  const stat = new Map<string, { total: number; low: number }>();
  for (const r of rows) {
    if (!r.boothId) continue;
    const s = stat.get(r.boothId) ?? { total: 0, low: 0 };
    s.total += 1;
    if (r.stars <= 3 && parseIds(r.hits).length === 0) s.low += 1;
    stat.set(r.boothId, s);
  }
  const out = new Set<string>();
  for (const [id, s] of stat) {
    if (
      s.total >= CONFIG.moderation.suspiciousReportMin &&
      s.low / s.total >= CONFIG.moderation.suspiciousReportRatio
    ) {
      out.add(id);
    }
  }
  return out;
}

// ---------- Keputusan ----------

interface Change {
  set: Partial<typeof reviews.$inferInsert>;
  reportIds?: string[];
  reportStatus?: "upheld" | "dismissed";
  reportReason?: string;
}

/** Satu pintu penulisan: review + statistik + stats_version (+ laporan) dalam satu batch. */
async function apply(
  db: Db,
  d: Deps,
  eventId: string,
  cur: ReviewRow,
  actor: string,
  reason: string,
  c: Change,
): Promise<void> {
  await runBatch(db, [
    db
      .update(reviews)
      .set({
        ...c.set,
        // Nilai asli disimpan SEKALI (yang pertama kali diubah), tidak pernah ditimpa.
        originalStars: cur.originalStars ?? cur.stars,
        originalComment: cur.originalComment ?? cur.comment,
        moderatedBy: actor,
        moderatedAt: d.now,
        moderationReason: reason,
        updatedAt: d.now,
      })
      .where(eq(reviews.id, cur.id)),
    recomputeStatsStatement(db, cur.boothId, d.now),
    bump(db, eventId, d.now),
    ...(c.reportIds && c.reportIds.length > 0 && c.reportStatus
      ? [
          db
            .update(reviewReports)
            .set({
              status: c.reportStatus,
              decidedBy: actor,
              decidedAt: d.now,
              decisionReason: reason,
            })
            .where(inArray(reviewReports.id, c.reportIds)),
        ]
      : []),
  ]);
}

export async function setCommentStatus(
  db: Db,
  d: Deps,
  eventId: string,
  id: string,
  o: { commentStatus: ReviewRow["commentStatus"]; lock?: boolean; reason: string },
  actor: string,
): Promise<AdminReview> {
  const cur = await loadReview(db, eventId, id);
  if (cur.comment === null) throw new ApiError("validation_error", "no_comment");
  if (o.commentStatus === "masked" && !cur.commentMasked) {
    throw new ApiError("validation_error", "no_masked_text");
  }
  await apply(db, d, eventId, cur, actor, o.reason, {
    set: {
      commentStatus: o.commentStatus,
      commentLocked: o.commentStatus === "visible" && o.lock ? 1 : 0,
    },
  });
  return one(db, eventId, id);
}

export async function patchReview(
  db: Db,
  d: Deps,
  eventId: string,
  id: string,
  o: { stars?: number; comment?: string | null; status?: ReviewRow["status"]; reason: string },
  actor: string,
): Promise<AdminReview> {
  const cur = await loadReview(db, eventId, id);
  const set: Change["set"] = {};
  if (o.stars !== undefined) set.stars = o.stars;
  if (o.status !== undefined) set.status = o.status;
  if (o.comment !== undefined) {
    // Teks hasil sunting admin dianggap sudah diperiksa manusia: tayang apa adanya.
    set.comment = o.comment;
    set.commentStatus = "visible";
    set.commentMasked = null;
    set.filterHitsJson = "[]";
    set.commentLocked = 1;
  }
  await apply(db, d, eventId, cur, actor, o.reason, { set });
  return one(db, eventId, id);
}

/** Pulihkan: review tayang lagi, komentar tayang, dan DIKUNCI agar tidak kembali ke antrean oleh laporan baru. */
export async function restoreReview(
  db: Db,
  d: Deps,
  eventId: string,
  id: string,
  reason: string,
  actor: string,
): Promise<AdminReview> {
  const cur = await loadReview(db, eventId, id);
  await apply(db, d, eventId, cur, actor, reason, {
    set: { status: "visible", commentStatus: "visible", commentLocked: 1 },
  });
  return one(db, eventId, id);
}

export async function deleteReview(db: Db, d: Deps, eventId: string, id: string): Promise<void> {
  const cur = await loadReview(db, eventId, id);
  await runBatch(db, [
    db.delete(reviewReports).where(eq(reviewReports.reviewId, id)),
    db.delete(reviews).where(eq(reviews.id, id)),
    recomputeStatsStatement(db, cur.boothId, d.now),
    bump(db, eventId, d.now),
  ]);
}

export async function decideReport(
  db: Db,
  d: Deps,
  eventId: string,
  reportId: string,
  o: {
    decision: "upheld" | "dismissed";
    action: "none" | "hide_comment" | "hide_review" | "restore";
    lock?: boolean;
    reason: string;
  },
  actor: string,
): Promise<AdminReview> {
  const report = await db
    .select()
    .from(reviewReports)
    .where(and(eq(reviewReports.id, reportId), eq(reviewReports.eventId, eventId)))
    .get();
  if (!report) throw new ApiError("not_found", "report");
  const cur = await loadReview(db, eventId, report.reviewId);

  // Keputusan berlaku untuk SEMUA laporan terbuka pada komentar yang sama.
  const open = await db
    .select({ id: reviewReports.id })
    .from(reviewReports)
    .where(and(eq(reviewReports.reviewId, cur.id), eq(reviewReports.status, "open")));

  const set: Change["set"] = {};
  if (o.action === "hide_comment") set.commentStatus = "hidden";
  if (o.action === "hide_review") set.status = "hidden";
  if (o.action === "restore") {
    set.status = "visible";
    set.commentStatus = "visible";
    set.commentLocked = 1;
  }
  if (o.action === "none" && o.lock) set.commentLocked = 1;

  await apply(db, d, eventId, cur, actor, o.reason, {
    set,
    reportIds: open.map((r) => r.id),
    reportStatus: o.decision,
  });
  return one(db, eventId, cur.id);
}

async function one(db: Db, eventId: string, id: string): Promise<AdminReview> {
  const row = await joined(db)
    .where(and(eq(reviews.id, id), eq(reviews.eventId, eventId)))
    .get();
  if (!row) throw new ApiError("not_found", "review");
  return toAdminReview(row);
}

export async function setVisitorBlocked(
  db: Db,
  d: Deps,
  eventId: string,
  visitorId: string,
  blocked: boolean,
): Promise<void> {
  const r = await db
    .update(visitors)
    .set({ blocked: blocked ? 1 : 0, updatedAt: d.now })
    .where(and(eq(visitors.id, visitorId), eq(visitors.eventId, eventId)));
  if ((r.meta?.changes ?? 0) === 0) throw new ApiError("not_found", "visitor");
}
