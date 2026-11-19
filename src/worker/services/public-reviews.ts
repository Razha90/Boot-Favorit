// Ulasan yang dilihat pengunjung lain (explore.md A5, B25). ATURAN YANG DITEGAKKAN DI SINI: komentar `held` dan
// `hidden` TIDAK pernah dikirim; komentar `masked` hanya dalam bentuk tersamar; review yang ditahan/disembunyikan
// tidak tampil; bintang tidak dikirim bila rating disembunyikan admin; yang tampil hanya nama depan/alias.

import type { LatestReview, PublicReview, PublicReviews, TopCategory } from "@shared/api-types";
import { ApiError } from "@shared/errors";
import { and, desc, eq, inArray, isNotNull, lt, or } from "drizzle-orm";
import { booths, type EventRow, reviewCategories, reviews, visitors } from "../db/schema";
import type { Db } from "../lib/db";
import { parseIds } from "./reviews";
import { publicName } from "./visitors";

export const REVIEWS_PAGE_SIZE = 10;

async function categoryLabels(db: Db, eventId: string): Promise<Map<string, string>> {
  // Termasuk kategori nonaktif: mengganti nama/menonaktifkan tidak menghapus data lama (A5).
  const rows = await db
    .select()
    .from(reviewCategories)
    .where(eq(reviewCategories.eventId, eventId));
  return new Map(rows.map((c) => [c.id, c.label]));
}

export function parseCursor(raw: string | undefined): { at: number; id: string } | null {
  if (!raw) return null;
  const [at, ...rest] = raw.split(":");
  const n = Number(at);
  const id = rest.join(":");
  return Number.isInteger(n) && id ? { at: n, id } : null;
}

export async function listPublicReviews(
  db: Db,
  event: EventRow,
  boothId: string,
  showStars: boolean,
  cursor: string | undefined,
): Promise<PublicReviews> {
  const booth = await db
    .select({ id: booths.id })
    .from(booths)
    .where(and(eq(booths.id, boothId), eq(booths.eventId, event.id), eq(booths.status, "approved")))
    .get();
  if (!booth) throw new ApiError("not_found", "booth");

  const cur = parseCursor(cursor);
  const rows = await db
    .select({
      id: reviews.id,
      stars: reviews.stars,
      comment: reviews.comment,
      commentMasked: reviews.commentMasked,
      commentStatus: reviews.commentStatus,
      categoryIdsJson: reviews.categoryIdsJson,
      createdAt: reviews.createdAt,
      displayName: visitors.displayName,
    })
    .from(reviews)
    .innerJoin(visitors, eq(visitors.id, reviews.visitorId))
    .where(
      and(
        eq(reviews.boothId, boothId),
        eq(reviews.status, "visible"),
        isNotNull(reviews.comment),
        inArray(reviews.commentStatus, ["visible", "masked"]),
        cur
          ? or(
              lt(reviews.createdAt, cur.at),
              and(eq(reviews.createdAt, cur.at), lt(reviews.id, cur.id)),
            )
          : undefined,
      ),
    )
    .orderBy(desc(reviews.createdAt), desc(reviews.id))
    .limit(REVIEWS_PAGE_SIZE + 1);

  const labels = await categoryLabels(db, event.id);
  const page = rows.slice(0, REVIEWS_PAGE_SIZE);
  const out: PublicReview[] = page.flatMap((r) => {
    const text = r.commentStatus === "masked" ? r.commentMasked : r.comment;
    if (!text || text.trim() === "") return [];
    return [
      {
        id: r.id,
        stars: showStars ? r.stars : null,
        text,
        displayName: publicName({ displayName: r.displayName }),
        categories: parseIds(r.categoryIdsJson).flatMap((id) => {
          const label = labels.get(id);
          return label ? [{ id, label }] : [];
        }),
        createdAt: r.createdAt,
      },
    ];
  });
  const last = page[page.length - 1];
  return {
    reviews: out,
    next: rows.length > REVIEWS_PAGE_SIZE && last ? `${last.createdAt}:${last.id}` : null,
  };
}

const FEED_TEXT_MAX = 140;
const clip = (s: string) =>
  s.length > FEED_TEXT_MAX ? `${s.slice(0, FEED_TEXT_MAX - 1).trimEnd()}…` : s;

/**
 * Ulasan terbaru lintas booth (bagian 03, A8). Aturan yang sama dengan daftar per booth: hanya review `visible` dengan
 * komentar `visible`/`masked`, hanya booth yang tayang, tanpa email; komentar dipotong ±140 karakter.
 */
export async function latestReviews(
  db: Db,
  event: EventRow,
  showStars: boolean,
  limit: number,
): Promise<LatestReview[]> {
  const rows = await db
    .select({
      id: reviews.id,
      boothId: reviews.boothId,
      boothName: booths.name,
      stars: reviews.stars,
      comment: reviews.comment,
      commentMasked: reviews.commentMasked,
      commentStatus: reviews.commentStatus,
      createdAt: reviews.createdAt,
      displayName: visitors.displayName,
    })
    .from(reviews)
    .innerJoin(booths, eq(booths.id, reviews.boothId))
    .innerJoin(visitors, eq(visitors.id, reviews.visitorId))
    .where(
      and(
        eq(reviews.eventId, event.id),
        eq(booths.status, "approved"),
        eq(reviews.status, "visible"),
        isNotNull(reviews.comment),
        inArray(reviews.commentStatus, ["visible", "masked"]),
      ),
    )
    .orderBy(desc(reviews.createdAt), desc(reviews.id))
    .limit(limit);

  return rows.flatMap((r) => {
    const text = r.commentStatus === "masked" ? r.commentMasked : r.comment;
    if (!text || text.trim() === "") return [];
    return [
      {
        id: r.id,
        boothId: r.boothId,
        boothName: r.boothName,
        stars: showStars ? r.stars : null,
        text: clip(text),
        displayName: publicName({ displayName: r.displayName }),
        createdAt: r.createdAt,
      },
    ];
  });
}

/** "Sering disebut: Seru (12) · Ramah (9)": tiga kategori terbanyak. */
export async function topCategories(
  db: Db,
  eventId: string,
  countsJson: string | null,
): Promise<TopCategory[]> {
  let counts: Record<string, number> = {};
  try {
    counts = countsJson ? (JSON.parse(countsJson) as Record<string, number>) : {};
  } catch {
    counts = {};
  }
  const entries = Object.entries(counts)
    .filter(([, n]) => typeof n === "number" && n > 0)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, 3);
  if (entries.length === 0) return [];
  const labels = await categoryLabels(db, eventId);
  return entries.flatMap(([id, n]) => {
    const label = labels.get(id);
    return label ? [{ id, label, count: n }] : [];
  });
}
