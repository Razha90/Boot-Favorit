// Layanan booth untuk admin (explore.md A16, B26): buat, impor CSV, daftar, ubah, pemilik, WhatsApp.
// Hanya NAMA yang wajib; booth buatan admin selalu langsung tayang dan tidak terkena jadwal pendaftaran.

import type { AdminBoothView, ImportRowResult, ImportSummary } from "@shared/api-types";
import { normalizeWhatsapp, type OwnerState, ownerState } from "@shared/booth";
import { CONFIG } from "@shared/config";
import { ApiError } from "@shared/errors";
import type { CreateBoothInput, ImportBoothsInput, UpdateBoothInput } from "@shared/schemas";
import { type Completeness, completeness } from "@shared/visual";
import { and, eq, ne, sql } from "drizzle-orm";
import { type BoothRow, boothPhotos, boothStats, booths, events, products } from "../db/schema";
import { type Db, runBatch } from "../lib/db";
import { type Deps, getEventOrThrow } from "./events";

export interface ListFilters {
  status?: BoothRow["status"];
  owner?: OwnerState;
  completeness?: Completeness;
  q?: string;
}

const norm = (s: string) => s.trim().toLowerCase();

/** Versi selalu naik, walau dua perubahan jatuh pada milidetik yang sama (kontrol konkurensi, B18). */
export const nextVersion = (row: Pick<BoothRow, "updatedAt">, now: number) =>
  Math.max(now, row.updatedAt + 1);

async function viewsFor(db: Db, eventId: string, rows: BoothRow[]): Promise<AdminBoothView[]> {
  if (rows.length === 0) return [];
  const [covers, photoCounts, stats, productCounts] = await Promise.all([
    db
      .select({ boothId: boothPhotos.boothId, key: boothPhotos.keyThumb })
      .from(boothPhotos)
      .where(and(eq(boothPhotos.eventId, eventId), eq(boothPhotos.position, 0))),
    db
      .select({ boothId: boothPhotos.boothId, n: sql<number>`count(*)` })
      .from(boothPhotos)
      .where(eq(boothPhotos.eventId, eventId))
      .groupBy(boothPhotos.boothId),
    db.select().from(boothStats).where(eq(boothStats.eventId, eventId)),
    db
      .select({ boothId: products.boothId, n: sql<number>`count(*)` })
      .from(products)
      .where(and(eq(products.eventId, eventId), ne(products.status, "removed_by_admin")))
      .groupBy(products.boothId),
  ]);
  const cover = new Map(covers.map((c) => [c.boothId, c.key]));
  const photoN = new Map(photoCounts.map((c) => [c.boothId, Number(c.n)]));
  const productN = new Map(productCounts.map((c) => [c.boothId, Number(c.n)]));
  const stat = new Map(stats.map((s) => [s.boothId, s]));

  return rows.map((b) => {
    const coverThumbKey = cover.get(b.id) ?? null;
    const s = stat.get(b.id);
    return {
      id: b.id,
      eventId: b.eventId,
      name: b.name,
      boothNo: b.boothNo,
      email: b.email,
      ownerState: ownerState(b),
      tagline: b.tagline,
      description: b.description,
      about: b.about,
      teamName: b.teamName,
      status: b.status,
      rejectReason: b.rejectReason,
      approvedBy: b.approvedBy,
      approvedAt: b.approvedAt,
      isLate: b.isLate === 1,
      createdBy: b.createdBy,
      createdAt: b.createdAt,
      version: b.updatedAt,
      logoKey: b.logoKey,
      coverThumbKey,
      photoCount: photoN.get(b.id) ?? 0,
      productCount: productN.get(b.id) ?? 0,
      hasWhatsapp: b.whatsappE164 !== null,
      whatsappConsentBy: b.whatsappConsentBy,
      completeness: completeness({
        id: b.id,
        name: b.name,
        boothNo: b.boothNo,
        coverThumbKey,
        description: b.description,
        tagline: b.tagline,
      }),
      reviewCount: s?.reviewCount ?? 0,
      average: s && s.reviewCount > 0 ? s.starSum / s.reviewCount : null,
    };
  });
}

export async function getBoothRow(db: Db, eventId: string, boothId: string): Promise<BoothRow> {
  const row = await db
    .select()
    .from(booths)
    .where(and(eq(booths.id, boothId), eq(booths.eventId, eventId)))
    .get();
  if (!row) throw new ApiError("not_found", "booth");
  return row;
}

export async function getBoothView(db: Db, eventId: string, boothId: string) {
  const row = await getBoothRow(db, eventId, boothId);
  const [view] = await viewsFor(db, eventId, [row]);
  if (!view) throw new ApiError("not_found", "booth");
  return view;
}

export async function listBooths(
  db: Db,
  eventId: string,
  f: ListFilters = {},
): Promise<AdminBoothView[]> {
  await getEventOrThrow(db, eventId);
  const rows = await db.select().from(booths).where(eq(booths.eventId, eventId));
  const q = f.q ? norm(f.q) : "";
  const filtered = rows.filter(
    (b) =>
      (!f.status || b.status === f.status) &&
      (!f.owner || ownerState(b) === f.owner) &&
      (!q || norm(b.name).includes(q) || norm(b.boothNo ?? "").includes(q)),
  );
  const views = await viewsFor(db, eventId, filtered);
  const byCompleteness = f.completeness
    ? views.filter((v) => v.completeness === f.completeness)
    : views;
  return byCompleteness.sort((a, b) => a.name.localeCompare(b.name, "id"));
}

async function assertEmailFree(db: Db, eventId: string, email: string, exceptBoothId?: string) {
  const taken = await db
    .select({ id: booths.id })
    .from(booths)
    .where(and(eq(booths.eventId, eventId), eq(booths.email, email)))
    .get();
  if (taken && taken.id !== exceptBoothId) throw new ApiError("email_in_use");
}

export const bumpStats = (db: Db, eventId: string, now: number) =>
  db
    .update(events)
    .set({ statsVersion: sql`${events.statsVersion} + 1`, updatedAt: now })
    .where(eq(events.id, eventId));

function newBoothStatements(
  db: Db,
  eventId: string,
  input: CreateBoothInput,
  id: string,
  d: Deps,
  adminEmail: string,
) {
  return [
    db.insert(booths).values({
      id,
      eventId,
      email: input.email,
      name: input.name,
      boothNo: input.boothNo,
      tagline: input.tagline,
      description: input.description,
      status: "approved", // admin sendiri verifikatornya; tidak ada opsi draf (A16)
      approvedBy: adminEmail,
      approvedAt: d.now,
      isLate: 0, // bukan susulan: jalur admin tidak terikat penutupan pendaftaran
      createdBy: "admin",
      createdAt: d.now,
      updatedAt: d.now,
    }),
    db.insert(boothStats).values({ boothId: id, eventId, updatedAt: d.now }),
  ];
}

/** Admin membuat booth: hanya nama yang wajib; email kosong = tanpa pemilik. Langsung tayang. */
export async function createBoothByAdmin(
  db: Db,
  eventId: string,
  input: CreateBoothInput,
  d: Deps,
  adminEmail: string,
): Promise<AdminBoothView> {
  await getEventOrThrow(db, eventId);
  if (input.email) await assertEmailFree(db, eventId, input.email);
  const id = d.newId();
  await runBatch(db, [
    ...newBoothStatements(db, eventId, input, id, d, adminEmail),
    bumpStats(db, eventId, d.now),
  ]);
  return getBoothView(db, eventId, id);
}

// ---------- Impor CSV (B26) ----------

export async function importBooths(
  db: Db,
  eventId: string,
  input: ImportBoothsInput,
  d: Deps,
  adminEmail: string,
): Promise<ImportSummary> {
  await getEventOrThrow(db, eventId);
  const existing = await db
    .select({ name: booths.name, email: booths.email })
    .from(booths)
    .where(eq(booths.eventId, eventId));
  const takenEmails = new Set(existing.flatMap((b) => (b.email ? [b.email] : [])));
  const seenNames = new Set(existing.map((b) => norm(b.name)));
  const emailsInFile = new Set<string>();

  const results: ImportRowResult[] = new Array(input.rows.length);
  const toCreate: { index: number; id: string; row: CreateBoothInput }[] = [];

  input.rows.forEach((row, index) => {
    if (row.email) {
      if (takenEmails.has(row.email)) {
        results[index] = { index, status: "error", reason: "email_in_use" };
        return;
      }
      if (emailsInFile.has(row.email)) {
        results[index] = { index, status: "error", reason: "email_duplicate_in_file" };
        return;
      }
    }
    const key = norm(row.name);
    if (input.onDuplicateName === "skip" && seenNames.has(key)) {
      results[index] = { index, status: "skipped", reason: "duplicate_name" };
      return;
    }
    if (row.email) emailsInFile.add(row.email);
    seenNames.add(key);
    toCreate.push({ index, id: d.newId(), row });
  });

  // Potongan kecil per batch() D1; tiap potongan atomik, kegagalan satu potongan tidak membatalkan yang lain.
  for (let i = 0; i < toCreate.length; i += CONFIG.booths.csvChunkSize) {
    const chunk = toCreate.slice(i, i + CONFIG.booths.csvChunkSize);
    try {
      await runBatch(
        db,
        chunk.flatMap((c) => newBoothStatements(db, eventId, c.row, c.id, d, adminEmail)),
      );
      for (const c of chunk) results[c.index] = { index: c.index, status: "created", id: c.id };
    } catch {
      for (const c of chunk)
        results[c.index] = { index: c.index, status: "error", reason: "chunk_failed" };
    }
  }

  const created = results.filter((r) => r.status === "created").length;
  if (created > 0) await bumpStats(db, eventId, d.now); // sekali di akhir, bukan per baris
  return {
    created,
    skipped: results.filter((r) => r.status === "skipped").length,
    errors: results.filter((r) => r.status === "error").length,
    results,
  };
}

// ---------- Ubah booth ----------

type Tracked =
  | "name"
  | "boothNo"
  | "tagline"
  | "description"
  | "about"
  | "teamName"
  | "status"
  | "rejectReason";
export type FieldChanges = Partial<Record<Tracked, { before: unknown; after: unknown }>>;

/** Booth dengan pemilik aktif: perubahan admin wajib beralasan (A16). Tanpa pemilik: tidak diminta. */
function requireReasonIfOwned(row: BoothRow, reason: string | null | undefined) {
  if (
    ownerState(row) === "active" &&
    (reason ?? "").trim().length < CONFIG.registration.adminReasonMinLength
  ) {
    throw new ApiError("reason_required");
  }
}

export async function updateBooth(
  db: Db,
  eventId: string,
  boothId: string,
  patch: UpdateBoothInput,
  d: Deps,
  adminEmail: string,
): Promise<{ booth: AdminBoothView; changes: FieldChanges }> {
  const row = await getBoothRow(db, eventId, boothId);
  if (patch.version !== undefined && patch.version !== row.updatedAt) {
    throw new ApiError("version_conflict");
  }
  if ((patch.status === "rejected" || patch.status === "revision") && !patch.rejectReason) {
    throw new ApiError("reason_required", "reject_reason");
  }

  const next: Partial<BoothRow> = {};
  const changes: FieldChanges = {};
  const apply = <K extends Tracked>(key: K, value: BoothRow[K] | undefined) => {
    if (value === undefined || value === row[key]) return;
    next[key] = value;
    changes[key] = { before: row[key], after: value };
  };
  apply("name", patch.name);
  apply("boothNo", patch.boothNo);
  apply("tagline", patch.tagline);
  apply("description", patch.description);
  apply("about", patch.about);
  apply("teamName", patch.teamName);
  apply("status", patch.status);
  apply("rejectReason", patch.rejectReason);

  if (patch.status === "approved" && row.status !== "approved") {
    next.approvedBy = adminEmail;
    next.approvedAt = d.now;
    if (patch.rejectReason === undefined && row.rejectReason !== null) {
      next.rejectReason = null;
      changes.rejectReason = { before: row.rejectReason, after: null };
    }
  }

  if (Object.keys(changes).length === 0) {
    return { booth: await getBoothView(db, eventId, boothId), changes };
  }
  requireReasonIfOwned(row, patch.reason);

  await runBatch(db, [
    db
      .update(booths)
      .set({ ...next, updatedAt: nextVersion(row, d.now) })
      .where(and(eq(booths.id, boothId), eq(booths.eventId, eventId))),
    bumpStats(db, eventId, d.now),
  ]);
  return { booth: await getBoothView(db, eventId, boothId), changes };
}

// ---------- Pemilik (A16) ----------

export interface OwnerChange {
  booth: AdminBoothView;
  before: { email: string | null; state: OwnerState };
  after: { email: string | null; state: OwnerState };
}

/** Isi, ganti, atau lepas pemilik. Mengisi email TIDAK mengirim apa pun. Mengganti/melepas membuat sesi lama tidak sah (B7). */
export async function setOwner(
  db: Db,
  eventId: string,
  boothId: string,
  email: string | null,
  reason: string | null | undefined,
  d: Deps,
): Promise<OwnerChange> {
  const row = await getBoothRow(db, eventId, boothId);
  const before = { email: row.email, state: ownerState(row) };
  if (email === row.email) {
    return { booth: await getBoothView(db, eventId, boothId), before, after: before };
  }
  if (email) await assertEmailFree(db, eventId, email, boothId);
  requireReasonIfOwned(row, reason);

  await runBatch(db, [
    db
      .update(booths)
      .set({
        email,
        ownerInvitedAt: null,
        ownerLastLoginAt: null,
        updatedAt: nextVersion(row, d.now),
      })
      .where(eq(booths.id, boothId)),
    bumpStats(db, eventId, d.now),
  ]);
  const after = { email, state: email === null ? ("none" as const) : ("invited" as const) };
  return { booth: await getBoothView(db, eventId, boothId), before, after };
}

// ---------- WhatsApp (A14, B24) ----------

/**
 * Isi/ubah/hapus nomor WhatsApp. Pemilik menyetujui sendiri (`consent`); admin hanya boleh mengisi atas nama pemilik
 * setelah mengonfirmasi persetujuannya. Menghapus tidak butuh persetujuan.
 */
export async function setWhatsapp(
  db: Db,
  eventId: string,
  boothId: string,
  o: { number: string | null | undefined; consent: boolean; by: "owner" | "admin" },
  d: Deps,
): Promise<{ removed: boolean }> {
  const row = await getBoothRow(db, eventId, boothId);
  const version = nextVersion(row, d.now);
  const blank = o.number === null || o.number === undefined || o.number.trim() === "";

  if (blank) {
    await db
      .update(booths)
      .set({
        whatsappE164: null,
        whatsappConsentAt: null,
        whatsappConsentBy: null,
        updatedAt: version,
      })
      .where(eq(booths.id, boothId));
    return { removed: true };
  }

  const e164 = normalizeWhatsapp(o.number as string);
  if (!e164) throw new ApiError("validation_error", "invalid_whatsapp");
  if (!o.consent) throw new ApiError("validation_error", "consent_required");

  await db
    .update(booths)
    .set({
      whatsappE164: e164,
      whatsappConsentAt: d.now,
      whatsappConsentBy: o.by,
      updatedAt: version,
    })
    .where(eq(booths.id, boothId));
  return { removed: false };
}

/** Admin mengisi nomor atas nama pemilik hanya setelah mengonfirmasi persetujuannya. */
export async function setWhatsappByAdmin(
  db: Db,
  eventId: string,
  boothId: string,
  number: string | null | undefined,
  consentConfirmedByAdmin: boolean,
  d: Deps,
): Promise<{ booth: AdminBoothView; removed: boolean }> {
  const { removed } = await setWhatsapp(
    db,
    eventId,
    boothId,
    { number, consent: consentConfirmedByAdmin, by: "admin" },
    d,
  );
  return { booth: await getBoothView(db, eventId, boothId), removed };
}

// ---------- Undangan pemilik (A4, A16) ----------

/** Catat undangan terkirim. Butuh email pemilik; jeda antar undangan dibatasi (mencegah email-bombing). */
export async function markInvited(
  db: Db,
  eventId: string,
  boothId: string,
  d: Deps,
): Promise<BoothRow> {
  const row = await getBoothRow(db, eventId, boothId);
  if (!row.email) throw new ApiError("validation_error", "no_owner_email");
  if (
    row.ownerInvitedAt !== null &&
    d.now - row.ownerInvitedAt < CONFIG.registration.inviteCooldownSec * 1000
  ) {
    throw new ApiError("rate_limited");
  }
  await db
    .update(booths)
    .set({ ownerInvitedAt: d.now, updatedAt: nextVersion(row, d.now) })
    .where(eq(booths.id, boothId));
  return row;
}
