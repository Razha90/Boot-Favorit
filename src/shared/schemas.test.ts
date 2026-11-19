import { describe, expect, it } from "vitest";
import { CONFIG } from "./config";
import {
  createBoothSchema,
  idempotencyKeySchema,
  importBoothsSchema,
  productInputSchema,
  reviewInputSchema,
  scheduleSchema,
} from "./schemas";

describe("createBoothSchema (A16)", () => {
  it("hanya nama yang wajib; sisanya menjadi null", () => {
    expect(createBoothSchema.parse({ name: "Kopi Rempah" })).toEqual({
      name: "Kopi Rempah",
      boothNo: null,
      email: null,
      tagline: null,
      description: null,
      teamName: null,
    });
  });

  it("institusi/fakultas opsional: dirapikan, kosong menjadi null, dibatasi panjangnya", () => {
    expect(createBoothSchema.parse({ name: "A", teamName: "  Fakultas Teknik " }).teamName).toBe(
      "Fakultas Teknik",
    );
    expect(createBoothSchema.parse({ name: "A", teamName: "  " }).teamName).toBeNull();
    const tooLong = "x".repeat(CONFIG.profile.teamNameMaxLength + 1);
    expect(createBoothSchema.safeParse({ name: "A", teamName: tooLong }).success).toBe(false);
  });

  it("menolak nama kosong, spasi saja, atau terlalu panjang", () => {
    expect(createBoothSchema.safeParse({ name: "" }).success).toBe(false);
    expect(createBoothSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(createBoothSchema.safeParse({}).success).toBe(false);
    const max = CONFIG.profile.nameMaxLength;
    expect(createBoothSchema.safeParse({ name: "a".repeat(max) }).success).toBe(true);
    expect(createBoothSchema.safeParse({ name: "a".repeat(max + 1) }).success).toBe(false);
  });

  it("men-trim teks dan mengubah string kosong menjadi null", () => {
    const r = createBoothSchema.parse({ name: "  Mie Ayam  ", boothNo: " ", tagline: "  enak  " });
    expect(r.name).toBe("Mie Ayam");
    expect(r.boothNo).toBeNull();
    expect(r.tagline).toBe("enak");
  });

  it("email: huruf kecil, kosong = tanpa pemilik, tidak valid ditolak", () => {
    expect(createBoothSchema.parse({ name: "X", email: "  Owner@Contoh.ID " }).email).toBe(
      "owner@contoh.id",
    );
    expect(createBoothSchema.parse({ name: "X", email: "" }).email).toBeNull();
    expect(createBoothSchema.parse({ name: "X", email: null }).email).toBeNull();
    expect(createBoothSchema.safeParse({ name: "X", email: "bukan-email" }).success).toBe(false);
  });
});

describe("importBoothsSchema (impor CSV)", () => {
  const row = (i: number) => ({ name: `Booth ${i}` });

  it("menerima baris yang hanya bernama", () => {
    const r = importBoothsSchema.parse({ rows: [row(1), row(2)] });
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]?.email).toBeNull();
  });

  it("batas jumlah baris: 500 boleh, 501 ditolak, kosong ditolak", () => {
    const max = CONFIG.booths.csvMaxRows;
    const rows = (n: number) => Array.from({ length: n }, (_, i) => row(i));
    expect(importBoothsSchema.safeParse({ rows: rows(max) }).success).toBe(true);
    expect(importBoothsSchema.safeParse({ rows: rows(max + 1) }).success).toBe(false);
    expect(importBoothsSchema.safeParse({ rows: [] }).success).toBe(false);
  });
});

describe("scheduleSchema (B17)", () => {
  const ok = {
    registrationOpenAt: 1000,
    registrationCloseAt: 2000,
    eventStartAt: 3000,
    eventEndAt: 4000,
  };
  const messages = (input: unknown) => {
    const r = scheduleSchema.safeParse(input);
    return r.success ? [] : r.error.issues.map((i) => i.message);
  };

  it("menerima jadwal yang benar, juga tanpa waktu buka", () => {
    expect(scheduleSchema.safeParse(ok).success).toBe(true);
    expect(scheduleSchema.safeParse({ ...ok, registrationOpenAt: null }).success).toBe(true);
  });

  it("event harus selesai setelah mulai", () => {
    expect(messages({ ...ok, eventEndAt: 3000 })).toContain("event_end_before_start");
    expect(messages({ ...ok, eventEndAt: 2500 })).toContain("event_end_before_start");
  });

  it("pendaftaran harus ditutup setelah dibuka", () => {
    expect(messages({ ...ok, registrationCloseAt: 1000 })).toContain(
      "registration_close_before_open",
    );
  });

  it("pendaftaran tidak boleh ditutup setelah event selesai", () => {
    expect(messages({ ...ok, registrationCloseAt: 4500 })).toContain(
      "registration_close_after_event_end",
    );
  });

  it("menolak waktu negatif atau pecahan", () => {
    expect(scheduleSchema.safeParse({ ...ok, eventStartAt: -1 }).success).toBe(false);
    expect(scheduleSchema.safeParse({ ...ok, eventStartAt: 1.5 }).success).toBe(false);
  });
});

describe("reviewInputSchema (A5)", () => {
  it("hanya bintang yang wajib: komentar dan kategori opsional; bawaan tidak anonim", () => {
    expect(reviewInputSchema.parse({ stars: 5 })).toEqual({
      stars: 5,
      comment: null,
      categoryIds: [],
      anonymous: false,
    });
    for (const stars of [0, 6, 3.5, "4"]) {
      expect(reviewInputSchema.safeParse({ stars }).success).toBe(false);
    }
  });

  it("komentar opsional: di-trim, kosong/spasi/null = null, maksimal 280 karakter", () => {
    expect(reviewInputSchema.parse({ stars: 4, comment: "  bagus  " }).comment).toBe("bagus");
    for (const comment of ["", "   ", null, undefined]) {
      expect(reviewInputSchema.parse({ stars: 4, comment }).comment, String(comment)).toBeNull();
    }
    const max = CONFIG.review.maxCommentLength;
    expect(reviewInputSchema.safeParse({ stars: 4, comment: "a".repeat(max) }).success).toBe(true);
    expect(reviewInputSchema.safeParse({ stars: 4, comment: "a".repeat(max + 1) }).success).toBe(
      false,
    );
  });

  it("kategori: maksimal 3 dan tanpa duplikat", () => {
    const base = { stars: 4 };
    expect(reviewInputSchema.safeParse({ ...base, categoryIds: ["a", "b", "c"] }).success).toBe(
      true,
    );
    expect(
      reviewInputSchema.safeParse({ ...base, categoryIds: ["a", "b", "c", "d"] }).success,
    ).toBe(false);
    expect(reviewInputSchema.safeParse({ ...base, categoryIds: ["a", "a"] }).success).toBe(false);
  });
});

describe("productInputSchema (A14, B24)", () => {
  const ok = { name: "Kopi Rempah", priceIdr: 18000 };

  it("harga rupiah bulat 0 (Gratis) sampai batas atas", () => {
    expect(productInputSchema.safeParse({ ...ok, priceIdr: 0 }).success).toBe(true);
    expect(
      productInputSchema.safeParse({ ...ok, priceIdr: CONFIG.booth.maxPriceIdr }).success,
    ).toBe(true);
    expect(
      productInputSchema.safeParse({ ...ok, priceIdr: CONFIG.booth.maxPriceIdr + 1 }).success,
    ).toBe(false);
    expect(productInputSchema.safeParse({ ...ok, priceIdr: -1 }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...ok, priceIdr: 18000.5 }).success).toBe(false);
  });

  it("harga normal harus lebih besar dari harga", () => {
    expect(productInputSchema.safeParse({ ...ok, comparePriceIdr: 25000 }).success).toBe(true);
    expect(productInputSchema.safeParse({ ...ok, comparePriceIdr: 18000 }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...ok, comparePriceIdr: null }).success).toBe(true);
  });

  it("penanda hanya dari daftar tetap (tanpa 'terlaris')", () => {
    expect(productInputSchema.safeParse({ ...ok, badge: "limited" }).success).toBe(true);
    expect(productInputSchema.safeParse({ ...ok, badge: "terlaris" }).success).toBe(false);
  });

  it("nama wajib dan maksimal 60 karakter", () => {
    expect(productInputSchema.safeParse({ ...ok, name: "" }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...ok, name: "a".repeat(61) }).success).toBe(false);
  });
});

describe("idempotencyKeySchema", () => {
  it("menerima UUID dan menolak yang lain", () => {
    expect(idempotencyKeySchema.safeParse(crypto.randomUUID()).success).toBe(true);
    expect(idempotencyKeySchema.safeParse("abc").success).toBe(false);
  });
});
