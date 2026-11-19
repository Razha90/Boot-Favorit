// Layanan portal booth (explore.md A4, B7): pendaftaran mandiri, profil sendiri, kirim ulang, ringkasan ulasan.
// Pemilik TIDAK bisa mengubah status, email, atau kolom moderasi: skema masukan strict dan fungsi di sini tidak menyentuhnya.

import type { BoothMe, BoothSelfView, BoothStatsView } from "@shared/api-types";
import { ApiError } from "@shared/errors";
import { visibility } from "@shared/results";
import type { BoothSelfUpdateInput, SelfRegisterInput } from "@shared/schemas";
import { completeness } from "@shared/visual";
import { and, eq, ne, sql } from "drizzle-orm";
import {
  type BoothRow,
  boothPhotos,
  boothStats,
  booths,
  type EventRow,
  products,
} from "../db/schema";
import { type Db, runBatch } from "../lib/db";
import { bumpStats, nextVersion } from "./booths";
import { liveRanking } from "./public";
import type { Deps } from "./visitors";

export const findBoothByEmail = (db: Db, eventId: string, email: string) =>
  db
    .select()
    .from(booths)
    .where(and(eq(booths.eventId, eventId), eq(booths.email, email)))
    .get();

/** Pendaftaran mandiri: status `pending` (tidak tampil publik, tidak bisa dinilai) sampai admin menyetujui. */
export async function registerBooth(
  db: Db,
  d: Deps,
  o: { eventId: string; email: string; input: SelfRegisterInput; late: boolean },
): Promise<BoothRow> {
  const id = d.newId();
  try {
    await runBatch(db, [
      db.insert(booths).values({
        id,
        eventId: o.eventId,
        email: o.email,
        name: o.input.name,
        boothNo: o.input.boothNo,
        tagline: o.input.tagline,
        description: o.input.description,
        teamName: o.input.teamName,
        status: "pending",
        isLate: o.late ? 1 : 0,
        createdBy: "self",
        createdAt: d.now,
        updatedAt: d.now,
      }),
      db.insert(boothStats).values({ boothId: id, eventId: o.eventId, updatedAt: d.now }),
    ]);
  } catch (e) {
    // Dua pendaftaran serentak dengan email sama: indeks unik (event, email) menolak yang kedua.
    if (await findBoothByEmail(db, o.eventId, o.email)) throw new ApiError("email_in_use");
    throw e;
  }
  const row = await db.select().from(booths).where(eq(booths.id, id)).get();
  if (!row) throw new ApiError("internal_error", "booth_missing_after_insert");
  return row;
}

export const touchOwnerLogin = (db: Db, boothId: string, now: number) =>
  db.update(booths).set({ ownerLastLoginAt: now }).where(eq(booths.id, boothId));

// ---------- Tampilan untuk pemilik ----------

async function selfView(db: Db, b: BoothRow): Promise<BoothSelfView> {
  const [cover, photoN, productN] = await Promise.all([
    db
      .select({ key: boothPhotos.keyThumb })
      .from(boothPhotos)
      .where(and(eq(boothPhotos.boothId, b.id), eq(boothPhotos.position, 0)))
      .get(),
    db
      .select({ n: sql<number>`count(*)` })
      .from(boothPhotos)
      .where(eq(boothPhotos.boothId, b.id))
      .get(),
    db
      .select({ n: sql<number>`count(*)` })
      .from(products)
      .where(and(eq(products.boothId, b.id), ne(products.status, "removed_by_admin")))
      .get(),
  ]);
  const coverThumbKey = cover?.key ?? null;
  return {
    id: b.id,
    name: b.name,
    boothNo: b.boothNo,
    tagline: b.tagline,
    description: b.description,
    about: b.about,
    teamName: b.teamName,
    status: b.status,
    rejectReason: b.rejectReason,
    isLate: b.isLate === 1,
    createdBy: b.createdBy,
    logoKey: b.logoKey,
    coverThumbKey,
    photoCount: Number(photoN?.n ?? 0),
    productCount: Number(productN?.n ?? 0),
    whatsapp: b.whatsappE164,
    completeness: completeness({
      id: b.id,
      name: b.name,
      boothNo: b.boothNo,
      coverThumbKey,
      description: b.description,
      tagline: b.tagline,
    }),
    version: b.updatedAt,
  };
}

/** Rating/peringkat mengikuti aturan tampil publik (A3): yang disembunyikan tidak dikirim sama sekali. */
async function statsView(db: Db, event: EventRow, b: BoothRow): Promise<BoothStatsView> {
  const vis = visibility(event);
  if (!vis.ratings) {
    return {
      ratingsVisible: false,
      reviewCount: null,
      average: null,
      distribution: null,
      rank: null,
      rankedCount: null,
    };
  }
  const all = await db.select().from(boothStats).where(eq(boothStats.eventId, event.id));
  const mine = all.find((s) => s.boothId === b.id);
  let rank: number | null = null;
  let rankedCount: number | null = null;
  if (vis.ranking && b.status === "approved") {
    // Hanya booth yang tayang ikut peringkat (sama dengan snapshot publik).
    const live = new Set(
      (
        await db
          .select({ id: booths.id })
          .from(booths)
          .where(and(eq(booths.eventId, event.id), eq(booths.status, "approved")))
      ).map((r) => r.id),
    );
    const ranking = liveRanking(all.filter((s) => live.has(s.boothId))) ?? [];
    rank = ranking.find((r) => r.boothId === b.id)?.rank ?? null;
    rankedCount = ranking.filter((r) => r.rank !== null).length;
  }
  const count = mine?.reviewCount ?? 0;
  return {
    ratingsVisible: true,
    reviewCount: count,
    average: mine && count > 0 ? mine.starSum / count : null,
    distribution: mine ? [mine.s1, mine.s2, mine.s3, mine.s4, mine.s5] : [0, 0, 0, 0, 0],
    rank,
    rankedCount,
  };
}

export async function boothMe(db: Db, event: EventRow, booth: BoothRow): Promise<BoothMe> {
  const [view, stats] = await Promise.all([selfView(db, booth), statsView(db, event, booth)]);
  return { booth: view, stats };
}

// ---------- Ubah profil sendiri ----------

type Own = "name" | "boothNo" | "tagline" | "description" | "about" | "teamName";

export async function updateOwnProfile(
  db: Db,
  event: EventRow,
  booth: BoothRow,
  patch: BoothSelfUpdateInput,
  d: Deps,
): Promise<{ changed: Own[] }> {
  const next: Partial<BoothRow> = {};
  const changed: Own[] = [];
  const apply = <K extends Own>(key: K, value: BoothRow[K] | undefined) => {
    if (value === undefined || value === booth[key]) return;
    next[key] = value;
    changed.push(key);
  };
  apply("name", patch.name);
  apply("boothNo", patch.boothNo);
  apply("tagline", patch.tagline);
  apply("description", patch.description);
  apply("about", patch.about);
  apply("teamName", patch.teamName);
  if (changed.length === 0) return { changed };
  await runBatch(db, [
    db
      .update(booths)
      .set({ ...next, updatedAt: nextVersion(booth, d.now) })
      .where(eq(booths.id, booth.id)),
    bumpStats(db, event.id, d.now), // nama/profil tampil di kartu publik: kunci cache berganti
  ]);
  return { changed };
}

/** Perbaikan sudah dikirim: `revision` → `pending` untuk diperiksa admin lagi. Hanya dari `revision`. */
export async function resubmitBooth(db: Db, booth: BoothRow, d: Deps): Promise<void> {
  if (booth.status !== "revision") throw new ApiError("booth_not_editable", "not_in_revision");
  await db
    .update(booths)
    .set({ status: "pending", updatedAt: nextVersion(booth, d.now) })
    .where(and(eq(booths.id, booth.id), eq(booths.status, "revision")));
}
