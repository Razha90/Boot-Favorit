// Data publik (explore.md A8, A14, B8): hanya booth `approved` dari event aktif yang terbit.
// Aturan rating/peringkat DITEGAKKAN DI SINI (server), bukan hanya disembunyikan di UI: bila rating
// disembunyikan admin, angka, bintang, jumlah ulasan, dan sebaran tidak ada di respons.

import type {
  PublicBooth,
  PublicBoothDetail,
  PublicEventMedia,
  PublicProduct,
  PublicProducts,
  PublicSnapshot,
} from "@shared/api-types";
import { ApiError } from "@shared/errors";
import { globalMean } from "@shared/scoring";
import { and, asc, eq } from "drizzle-orm";
import {
  type BoothRow,
  boothPhotos,
  boothStats,
  booths,
  type EventRow,
  products,
} from "../db/schema";
import type { Db } from "../lib/db";
import { eventState } from "../lib/event";

/** Rating tampil: `visible`, atau `on_results` setelah hasil diumumkan. */
export const ratingsVisible = (e: Pick<EventRow, "ratingsMode" | "resultsPublishedAt">): boolean =>
  e.ratingsMode === "visible" || (e.ratingsMode === "on_results" && e.resultsPublishedAt !== null);

export function eventMedia(
  e: Pick<EventRow, "logoKey" | "ogImageKey" | "heroKeysJson">,
): PublicEventMedia {
  let heroKeys: string[] = [];
  try {
    const parsed = e.heroKeysJson ? JSON.parse(e.heroKeysJson) : [];
    heroKeys = Array.isArray(parsed)
      ? parsed.filter((k): k is string => typeof k === "string").slice(0, 3)
      : [];
  } catch {
    heroKeys = [];
  }
  return { logoKey: e.logoKey, ogImageKey: e.ogImageKey, heroKeys };
}

const orNull = (s: string | null) => (s !== null && s.trim() !== "" ? s : null);

function toPublicBooth(
  b: BoothRow,
  cover: { keyFull: string; keyThumb: string } | undefined,
  stat: typeof boothStats.$inferSelect | undefined,
  featured: typeof products.$inferSelect | undefined,
  showRatings: boolean,
): PublicBooth {
  const count = stat?.reviewCount ?? 0;
  const productCount = stat?.productCount ?? 0;
  return {
    id: b.id,
    name: b.name,
    boothNo: orNull(b.boothNo),
    tagline: orNull(b.tagline),
    description: orNull(b.description),
    coverThumbKey: cover?.keyThumb ?? null,
    coverKey: cover?.keyFull ?? null,
    ratingAverage: showRatings && stat && count > 0 ? stat.starSum / count : null,
    ratingCount: showRatings ? count : 0,
    priceFrom: stat?.priceFrom ?? null,
    allFree: productCount > 0 && (stat?.priceFrom ?? null) === null,
    featuredProduct: featured
      ? {
          id: featured.id,
          name: featured.name,
          priceIdr: featured.priceIdr,
          thumbKey: featured.keyThumb,
        }
      : null,
  };
}

async function approvedBooths(db: Db, eventId: string) {
  return db
    .select()
    .from(booths)
    .where(and(eq(booths.eventId, eventId), eq(booths.status, "approved")));
}

export async function getSnapshot(db: Db, event: EventRow): Promise<PublicSnapshot> {
  const showRatings = ratingsVisible(event);
  const [rows, covers, stats, featured] = await Promise.all([
    approvedBooths(db, event.id),
    db
      .select({
        boothId: boothPhotos.boothId,
        keyFull: boothPhotos.keyFull,
        keyThumb: boothPhotos.keyThumb,
      })
      .from(boothPhotos)
      .where(and(eq(boothPhotos.eventId, event.id), eq(boothPhotos.position, 0))),
    db.select().from(boothStats).where(eq(boothStats.eventId, event.id)),
    db
      .select()
      .from(products)
      .where(
        and(
          eq(products.eventId, event.id),
          eq(products.isFeatured, 1),
          eq(products.status, "active"),
        ),
      ),
  ]);
  const cover = new Map(covers.map((c) => [c.boothId, c]));
  const stat = new Map(stats.map((s) => [s.boothId, s]));
  const feat = new Map(featured.map((p) => [p.boothId, p]));

  const list = rows.map((b) =>
    toPublicBooth(b, cover.get(b.id), stat.get(b.id), feat.get(b.id), showRatings),
  );
  const approvedIds = new Set(rows.map((b) => b.id));
  const counted = stats.filter((s) => approvedIds.has(s.boothId));
  return {
    eventId: event.id,
    ratingsHidden: !showRatings,
    booths: list,
    stats: {
      boothCount: list.length,
      reviewCount: showRatings ? counted.reduce((n, s) => n + s.reviewCount, 0) : 0,
      average: showRatings && counted.some((s) => s.reviewCount > 0) ? globalMean(counted) : null,
    },
  };
}

async function getApprovedBooth(db: Db, event: EventRow, boothId: string): Promise<BoothRow> {
  const b = await db
    .select()
    .from(booths)
    .where(and(eq(booths.id, boothId), eq(booths.eventId, event.id), eq(booths.status, "approved")))
    .get();
  if (!b) throw new ApiError("not_found", "booth");
  return b;
}

export async function getBoothDetail(
  db: Db,
  event: EventRow,
  boothId: string,
  now: number,
): Promise<PublicBoothDetail> {
  const b = await getApprovedBooth(db, event, boothId);
  const showRatings = ratingsVisible(event);
  const [photos, stat, featured] = await Promise.all([
    db
      .select({ keyFull: boothPhotos.keyFull, keyThumb: boothPhotos.keyThumb })
      .from(boothPhotos)
      .where(eq(boothPhotos.boothId, b.id))
      .orderBy(asc(boothPhotos.position)),
    db.select().from(boothStats).where(eq(boothStats.boothId, b.id)).get(),
    db
      .select()
      .from(products)
      .where(
        and(eq(products.boothId, b.id), eq(products.isFeatured, 1), eq(products.status, "active")),
      )
      .get(),
  ]);
  const base = toPublicBooth(b, photos[0], stat, featured, showRatings);
  const frozen = eventState(event, now).frozen;
  return {
    ...base,
    about: orNull(b.about),
    teamName: orNull(b.teamName),
    photos,
    ratingsHidden: !showRatings,
    distribution:
      showRatings && stat
        ? [stat.s1, stat.s2, stat.s3, stat.s4, stat.s5]
        : showRatings
          ? [0, 0, 0, 0, 0]
          : null,
    // Nomornya sendiri TIDAK pernah dikirim; setelah event selesai tombol hilang (A14).
    hasWhatsapp: b.whatsappE164 !== null && !frozen,
  };
}

export async function getBoothProducts(
  db: Db,
  event: EventRow,
  boothId: string,
  now: number,
): Promise<PublicProducts> {
  const b = await getApprovedBooth(db, event, boothId);
  const frozen = eventState(event, now).frozen;
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.boothId, b.id), eq(products.status, "active")))
    .orderBy(asc(products.position), asc(products.createdAt));
  const list: PublicProduct[] = rows.map((p) => ({
    id: p.id,
    name: p.name,
    description: orNull(p.description),
    category: orNull(p.category),
    priceIdr: p.priceIdr,
    // Setelah event selesai promo dan penanda disembunyikan; harga tetap tampil (A14).
    comparePriceIdr: frozen ? null : p.comparePriceIdr,
    badge: frozen ? null : p.badge,
    thumbKey: p.keyThumb,
    fullKey: p.keyFull,
  }));
  return { products: list, hasWhatsapp: b.whatsappE164 !== null && !frozen };
}
