import { describe, expect, it } from "vitest";
import { createTestDb } from "../test/d1";
import {
  boothValues,
  eventValues,
  insertBooth,
  insertEvent,
  visitorValues,
} from "../test/fixtures";
import * as schema from "./schema";

// Menguji SQL migrasi apa adanya pada SQLite: aturan data yang bergantung pada database (B6).

describe("migrasi", () => {
  it("diterapkan bersih dan membuat 14 tabel", () => {
    const { sqlite } = createTestDb();
    const tables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[];
    expect(tables).toHaveLength(14);
  });
});

describe("events", () => {
  it("tepat satu event aktif (indeks unik parsial)", async () => {
    const t = createTestDb();
    await insertEvent(t, { isActive: 1 });
    await expect(insertEvent(t, { isActive: 1 })).rejects.toThrow();
    // Banyak event nonaktif boleh.
    await insertEvent(t, { isActive: 0 });
    await insertEvent(t, { isActive: 0 });
  });

  it("jadwal: mulai harus sebelum selesai", async () => {
    const t = createTestDb();
    await expect(insertEvent(t, { eventStartAt: 4000, eventEndAt: 3000 })).rejects.toThrow();
    await expect(insertEvent(t, { eventStartAt: 3000, eventEndAt: 3000 })).rejects.toThrow();
  });

  it("jadwal: waktu buka pendaftaran harus sebelum waktu tutup (atau NULL)", async () => {
    const t = createTestDb();
    await expect(
      insertEvent(t, { registrationOpenAt: 2500, registrationCloseAt: 2000 }),
    ).rejects.toThrow();
    await insertEvent(t, { registrationOpenAt: null });
  });

  it("nilai bawaan sesuai B6", async () => {
    const t = createTestDb();
    const e = await insertEvent(t);
    const row = await t.db.query.events.findFirst({
      where: (events, { eq }) => eq(events.id, e.id),
    });
    expect(row).toMatchObject({
      isActive: 0,
      hiddenFromPublic: 0,
      visibility: "draft",
      timezone: "Asia/Jakarta",
      ratingsMode: "visible",
      rankingMode: "visible",
      revealTarget: "screen",
      statsVersion: 0,
    });
  });
});

describe("booths (A16)", () => {
  it("hanya nama yang wajib: booth tanpa email, foto, nomor, dan data lain", async () => {
    const t = createTestDb();
    const e = await insertEvent(t);
    const b = await insertBooth(t, e.id);
    const row = await t.db.query.booths.findFirst({ where: (x, { eq }) => eq(x.id, b.id) });
    expect(row).toMatchObject({
      email: null,
      boothNo: null,
      description: null,
      status: "pending",
      isLate: 0,
      createdBy: "self",
    });
  });

  it("banyak booth tanpa pemilik (email NULL) boleh dalam satu event", async () => {
    const t = createTestDb();
    const e = await insertEvent(t);
    await insertBooth(t, e.id, { email: null });
    await insertBooth(t, e.id, { email: null });
    await insertBooth(t, e.id, { email: null });
  });

  it("akun per-event: email sama ditolak dalam satu event, boleh di event lain", async () => {
    const t = createTestDb();
    const e1 = await insertEvent(t);
    const e2 = await insertEvent(t);
    await insertBooth(t, e1.id, { email: "a@contoh.id" });
    await expect(insertBooth(t, e1.id, { email: "a@contoh.id" })).rejects.toThrow();
    await insertBooth(t, e2.id, { email: "a@contoh.id" });
  });

  it("nama tidak boleh kosong atau spasi saja", async () => {
    const t = createTestDb();
    const e = await insertEvent(t);
    await expect(insertBooth(t, e.id, { name: "" })).rejects.toThrow();
    await expect(insertBooth(t, e.id, { name: "   " })).rejects.toThrow();
  });

  it("kunci asing: booth tidak bisa menunjuk event yang tidak ada", async () => {
    const t = createTestDb();
    await expect(insertBooth(t, "tidak-ada")).rejects.toThrow();
  });

  it("foto: satu posisi per booth; foto opsional (tabel boleh kosong)", async () => {
    const t = createTestDb();
    const e = await insertEvent(t);
    const b = await insertBooth(t, e.id);
    const photo = (position: number, id: string) => ({
      id,
      eventId: e.id,
      boothId: b.id,
      keyFull: "f",
      keyThumb: "t",
      position,
      createdAt: 1,
    });
    await t.db.insert(schema.boothPhotos).values(photo(0, "p0"));
    await t.db.insert(schema.boothPhotos).values(photo(1, "p1"));
    await expect(t.db.insert(schema.boothPhotos).values(photo(0, "p0b"))).rejects.toThrow();
  });
});

describe("products (A14, B24)", () => {
  const product = (eventId: string, boothId: string, over = {}) => ({
    id: `prod-${Math.random()}`,
    eventId,
    boothId,
    name: "Kopi",
    priceIdr: 18000,
    createdAt: 1,
    updatedAt: 1,
    ...over,
  });

  it("tepat satu andalan aktif per booth", async () => {
    const t = createTestDb();
    const e = await insertEvent(t);
    const b = await insertBooth(t, e.id);
    await t.db.insert(schema.products).values(product(e.id, b.id, { isFeatured: 1 }));
    await expect(
      t.db.insert(schema.products).values(product(e.id, b.id, { isFeatured: 1 })),
    ).rejects.toThrow();
    // Yang disembunyikan tidak dihitung; andalan di booth lain boleh.
    await t.db
      .insert(schema.products)
      .values(product(e.id, b.id, { isFeatured: 1, status: "hidden" }));
    const b2 = await insertBooth(t, e.id);
    await t.db.insert(schema.products).values(product(e.id, b2.id, { isFeatured: 1 }));
  });

  it("harga: 0 (Gratis) boleh, negatif atau di atas batas ditolak", async () => {
    const t = createTestDb();
    const e = await insertEvent(t);
    const b = await insertBooth(t, e.id);
    await t.db.insert(schema.products).values(product(e.id, b.id, { priceIdr: 0 }));
    await expect(
      t.db.insert(schema.products).values(product(e.id, b.id, { priceIdr: -1 })),
    ).rejects.toThrow();
    await expect(
      t.db.insert(schema.products).values(product(e.id, b.id, { priceIdr: 100_000_000 })),
    ).rejects.toThrow();
  });

  it("harga normal harus lebih besar dari harga", async () => {
    const t = createTestDb();
    const e = await insertEvent(t);
    const b = await insertBooth(t, e.id);
    await t.db
      .insert(schema.products)
      .values(product(e.id, b.id, { priceIdr: 1000, comparePriceIdr: 2000 }));
    await expect(
      t.db
        .insert(schema.products)
        .values(product(e.id, b.id, { priceIdr: 1000, comparePriceIdr: 1000 })),
    ).rejects.toThrow();
  });
});

describe("reviews", () => {
  async function setup() {
    const t = createTestDb();
    const e = await insertEvent(t);
    const b = await insertBooth(t, e.id);
    const v = visitorValues(e.id);
    await t.db.insert(schema.visitors).values(v);
    const review = (over = {}) => ({
      id: `rev-${Math.random()}`,
      eventId: e.id,
      boothId: b.id,
      visitorId: v.id,
      stars: 5,
      createdAt: 1,
      updatedAt: 1,
      ...over,
    });
    return { t, e, b, v, review };
  }

  it("bintang hanya 1–5", async () => {
    const { t, review } = await setup();
    await expect(t.db.insert(schema.reviews).values(review({ stars: 0 }))).rejects.toThrow();
    await expect(t.db.insert(schema.reviews).values(review({ stars: 6 }))).rejects.toThrow();
    await t.db.insert(schema.reviews).values(review({ stars: 1 }));
  });

  it("satu review per pengunjung per booth", async () => {
    const { t, review } = await setup();
    await t.db.insert(schema.reviews).values(review());
    await expect(t.db.insert(schema.reviews).values(review())).rejects.toThrow();
  });

  it("pengunjung yang sama boleh menilai booth lain", async () => {
    const { t, e, v, review } = await setup();
    await t.db.insert(schema.reviews).values(review());
    const b2 = await insertBooth(t, e.id);
    await t.db.insert(schema.reviews).values(review({ boothId: b2.id }));
    expect(v.id).toBeTruthy();
  });

  it("pengunjung unik per event berdasarkan identity_hash", async () => {
    const { t, e, v } = await setup();
    await expect(
      t.db.insert(schema.visitors).values(visitorValues(e.id, { identityHash: v.identityHash })),
    ).rejects.toThrow();
  });
});

describe("review_reports", () => {
  it("satu laporan per pelapor per komentar; pelapor lain boleh", async () => {
    const t = createTestDb();
    const e = await insertEvent(t);
    const b = await insertBooth(t, e.id);
    const b2 = await insertBooth(t, e.id);
    const v = visitorValues(e.id);
    await t.db.insert(schema.visitors).values(v);
    await t.db.insert(schema.reviews).values({
      id: "r1",
      eventId: e.id,
      boothId: b.id,
      visitorId: v.id,
      stars: 3,
      createdAt: 1,
      updatedAt: 1,
    });
    const report = (over = {}) => ({
      id: `rep-${Math.random()}`,
      eventId: e.id,
      reviewId: "r1",
      reporterRole: "booth" as const,
      reporterBoothId: b.id,
      reason: "spam" as const,
      createdAt: 1,
      ...over,
    });
    await t.db.insert(schema.reviewReports).values(report());
    await expect(t.db.insert(schema.reviewReports).values(report())).rejects.toThrow();
    await t.db.insert(schema.reviewReports).values(report({ reporterBoothId: b2.id }));
    await t.db.insert(schema.reviewReports).values(
      report({
        reporterRole: "visitor",
        reporterBoothId: null,
        reporterVisitorId: v.id,
      }),
    );
  });

  it("pelapor harus sesuai perannya", async () => {
    const t = createTestDb();
    const e = await insertEvent(t);
    const b = await insertBooth(t, e.id);
    const v = visitorValues(e.id);
    await t.db.insert(schema.visitors).values(v);
    await t.db.insert(schema.reviews).values({
      id: "r1",
      eventId: e.id,
      boothId: b.id,
      visitorId: v.id,
      stars: 3,
      createdAt: 1,
      updatedAt: 1,
    });
    await expect(
      t.db.insert(schema.reviewReports).values({
        id: "x",
        eventId: e.id,
        reviewId: "r1",
        reporterRole: "booth",
        reason: "spam",
        createdAt: 1,
      }),
    ).rejects.toThrow();
  });
});

describe("idempotency_keys", () => {
  it("kunci unik per (actor, key)", async () => {
    const t = createTestDb();
    const row = (actor: string) => ({
      actor,
      key: "k1",
      route: "POST /x",
      bodyHash: "h",
      status: "processing" as const,
      createdAt: 1,
      updatedAt: 1,
    });
    await t.db.insert(schema.idempotencyKeys).values(row("a"));
    await expect(t.db.insert(schema.idempotencyKeys).values(row("a"))).rejects.toThrow();
    await t.db.insert(schema.idempotencyKeys).values(row("b"));
  });
});

// Pastikan fixture sendiri valid.
describe("fixtures", () => {
  it("menghasilkan id unik", () => {
    expect(eventValues().id).not.toBe(eventValues().id);
    expect(boothValues("e").id).not.toBe(boothValues("e").id);
  });
});
