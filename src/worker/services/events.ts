// Layanan event untuk admin (explore.md A0, A3, B17). Route hanya memvalidasi lalu memanggil ini.

import type { AdminEventView } from "@shared/api-types";
import { CONFIG } from "@shared/config";
import { ApiError } from "@shared/errors";
import { type EventSchedule, scheduleWarnings } from "@shared/event-state";
import {
  type CreateEventInput,
  type ReviewCategoriesInput,
  scheduleSchema,
  type UpdateEventInput,
} from "@shared/schemas";
import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { type EventRow, events, reviewCategories } from "../db/schema";
import { type Db, runBatch } from "../lib/db";
import { eventSchedule, eventState, readEventSettings } from "../lib/event";
import { eventMedia } from "./public";

export interface Deps {
  now: number;
  newId: () => string;
}

export const slugify = (name: string): string =>
  name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "") || "acara";

async function uniqueSlug(db: Db, base: string): Promise<string> {
  for (let n = 1; n < 1000; n++) {
    const candidate = n === 1 ? base : `${base.slice(0, 56)}-${n}`;
    const taken = await db
      .select({ id: events.id })
      .from(events)
      .where(eq(events.slug, candidate))
      .get();
    if (!taken) return candidate;
  }
  throw new ApiError("conflict", "slug_exhausted");
}

export function adminEventView(e: EventRow, now: number): AdminEventView {
  return {
    id: e.id,
    slug: e.slug,
    name: e.name,
    titleHighlight: e.titleHighlight,
    timezone: e.timezone,
    isActive: e.isActive === 1,
    hiddenFromPublic: e.hiddenFromPublic === 1,
    visibility: e.visibility,
    schedule: eventSchedule(e),
    settings: readEventSettings(e),
    state: eventState(e, now),
    warnings: scheduleWarnings(e, now),
    ratingsMode: e.ratingsMode,
    rankingMode: e.rankingMode,
    resultsPublishedAt: e.resultsPublishedAt,
    versions: { active: e.activeVersion, stats: e.statsVersion, results: e.resultsVersion },
    media: eventMedia(e),
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

export async function getEventOrThrow(db: Db, id: string): Promise<EventRow> {
  const row = await db.select().from(events).where(eq(events.id, id)).get();
  if (!row) throw new ApiError("not_found", "event");
  return row;
}

export const listEvents = (db: Db) =>
  db.select().from(events).orderBy(desc(events.isActive), desc(events.eventStartAt));

export async function createEvent(db: Db, input: CreateEventInput, d: Deps): Promise<EventRow> {
  const slug = input.slug ? input.slug : await uniqueSlug(db, slugify(input.name));
  if (input.slug) {
    const taken = await db
      .select({ id: events.id })
      .from(events)
      .where(eq(events.slug, slug))
      .get();
    if (taken) throw new ApiError("conflict", "slug_in_use");
  }

  const id = d.newId();
  const settings =
    input.allowLateRegistration === undefined
      ? null
      : JSON.stringify({ allowLateRegistration: input.allowLateRegistration });

  const row: typeof events.$inferInsert = {
    id,
    slug,
    name: input.name,
    titleHighlight: input.titleHighlight,
    timezone: input.timezone,
    registrationOpenAt: input.registrationOpenAt,
    registrationCloseAt: input.registrationCloseAt,
    eventStartAt: input.eventStartAt,
    eventEndAt: input.eventEndAt,
    settingsJson: settings,
    createdAt: d.now,
    updatedAt: d.now,
  };
  const categories = CONFIG.review.defaultCategories.map((label, position) => ({
    id: d.newId(),
    eventId: id,
    label,
    position,
    createdAt: d.now,
    updatedAt: d.now,
  }));

  await db.batch([db.insert(events).values(row), db.insert(reviewCategories).values(categories)]);
  return getEventOrThrow(db, id);
}

export interface UpdateResult {
  event: EventRow;
  scheduleChanged: { before: EventSchedule; after: EventSchedule } | null;
  settingsChanged: boolean;
}

export async function updateEvent(
  db: Db,
  id: string,
  patch: UpdateEventInput,
  d: Deps,
): Promise<UpdateResult> {
  const current = await getEventOrThrow(db, id);

  // Jadwal: gabungkan dengan nilai lama lalu validasi ulang seluruhnya (B17).
  const merged = {
    registrationOpenAt:
      patch.registrationOpenAt === undefined
        ? current.registrationOpenAt
        : patch.registrationOpenAt,
    registrationCloseAt: patch.registrationCloseAt ?? current.registrationCloseAt,
    eventStartAt: patch.eventStartAt ?? current.eventStartAt,
    eventEndAt: patch.eventEndAt ?? current.eventEndAt,
  };
  const scheduleTouched =
    patch.registrationOpenAt !== undefined ||
    patch.registrationCloseAt !== undefined ||
    patch.eventStartAt !== undefined ||
    patch.eventEndAt !== undefined;
  if (scheduleTouched) scheduleSchema.parse(merged);

  const settings = patch.settings
    ? { ...readEventSettings(current), ...patch.settings }
    : undefined;

  const set: Partial<typeof events.$inferInsert> = {
    ...(patch.name !== undefined && { name: patch.name }),
    ...(patch.titleHighlight !== undefined && { titleHighlight: patch.titleHighlight }),
    ...(patch.timezone !== undefined && { timezone: patch.timezone }),
    ...(patch.visibility !== undefined && { visibility: patch.visibility }),
    ...(scheduleTouched && merged),
    ...(settings && { settingsJson: JSON.stringify(settings) }),
    updatedAt: d.now,
  };
  // Event aktif: ubah kunci cache supaya tampilan publik mengikuti dalam hitungan detik (B8, B17).
  const bump = current.isActive === 1 ? { statsVersion: sql`${events.statsVersion} + 1` } : {};
  await db
    .update(events)
    .set({ ...set, ...bump })
    .where(eq(events.id, id));

  const event = await getEventOrThrow(db, id);
  return {
    event,
    scheduleChanged: scheduleTouched
      ? { before: eventSchedule(current), after: eventSchedule(event) }
      : null,
    settingsChanged: patch.settings !== undefined,
  };
}

/**
 * "Jadikan event aktif": tepat satu event aktif. Dua langkah dalam SATU batch() agar tidak pernah ada
 * dua event aktif (indeks unik parsial `one_active`) maupun nol di tengah jalan. Sekaligus menerbitkan.
 */
export async function activateEvent(db: Db, id: string, d: Deps): Promise<EventRow> {
  const target = await getEventOrThrow(db, id);
  if (target.isActive === 1 && target.visibility === "published" && target.hiddenFromPublic === 0) {
    return target; // sudah aktif: tidak menaikkan versi lagi
  }
  await db.batch([
    db
      .update(events)
      .set({ isActive: 0, updatedAt: d.now })
      .where(and(eq(events.isActive, 1), ne(events.id, id))),
    db
      .update(events)
      .set({
        isActive: 1,
        visibility: "published",
        hiddenFromPublic: 0,
        activeVersion: sql`${events.activeVersion} + 1`,
        updatedAt: d.now,
      })
      .where(eq(events.id, id)),
  ]);
  return getEventOrThrow(db, id);
}

/** Sembunyikan/tampilkan event aktif dari publik tanpa menggantinya (halaman utama: "Segera hadir"). */
export async function setHiddenFromPublic(
  db: Db,
  id: string,
  hidden: boolean,
  d: Deps,
): Promise<EventRow> {
  await getEventOrThrow(db, id);
  await db
    .update(events)
    .set({
      hiddenFromPublic: hidden ? 1 : 0,
      activeVersion: sql`${events.activeVersion} + 1`,
      updatedAt: d.now,
    })
    .where(eq(events.id, id));
  return getEventOrThrow(db, id);
}

/** Pintasan: tutup pendaftaran sekarang. */
export async function closeRegistrationNow(db: Db, id: string, d: Deps) {
  return updateEvent(db, id, { registrationCloseAt: d.now }, d);
}

/** Pintasan: perpanjang penutupan pendaftaran (membuka kembali bila sudah lewat). */
export async function extendRegistration(db: Db, id: string, byMs: number, d: Deps) {
  const current = await getEventOrThrow(db, id);
  const base = Math.max(current.registrationCloseAt, d.now);
  return updateEvent(db, id, { registrationCloseAt: base + byMs }, d);
}

// ---------- Kategori ulasan (A5): tambah, ganti nama, urut, nonaktifkan; tidak pernah dihapus ----------

export const listCategories = (db: Db, eventId: string) =>
  db
    .select()
    .from(reviewCategories)
    .where(eq(reviewCategories.eventId, eventId))
    .orderBy(asc(reviewCategories.position));

export async function replaceCategories(
  db: Db,
  eventId: string,
  input: ReviewCategoriesInput,
  d: Deps,
) {
  await getEventOrThrow(db, eventId);
  const existing = await listCategories(db, eventId);
  const known = new Map(existing.map((c) => [c.id, c]));

  for (const item of input.categories) {
    if (item.id && !known.has(item.id)) throw new ApiError("validation_error", "unknown_category");
  }
  const kept = new Set(input.categories.flatMap((c) => (c.id ? [c.id] : [])));
  if (kept.size !== input.categories.filter((c) => c.id).length) {
    throw new ApiError("validation_error", "duplicate_category_id");
  }

  const statements = [
    // Yang tidak disebut dinonaktifkan, bukan dihapus (data ulasan lama tetap terbaca).
    ...existing
      .filter((c) => !kept.has(c.id) && c.active === 1)
      .map((c) =>
        db
          .update(reviewCategories)
          .set({ active: 0, updatedAt: d.now })
          .where(eq(reviewCategories.id, c.id)),
      ),
    ...input.categories.map((item, position) =>
      item.id
        ? db
            .update(reviewCategories)
            .set({ label: item.label, position, active: item.active ? 1 : 0, updatedAt: d.now })
            .where(eq(reviewCategories.id, item.id))
        : db.insert(reviewCategories).values({
            id: d.newId(),
            eventId,
            label: item.label,
            position,
            active: item.active ? 1 : 0,
            createdAt: d.now,
            updatedAt: d.now,
          }),
    ),
  ];
  await runBatch(db, statements);
  return listCategories(db, eventId);
}
