import { describe, expect, it } from "vitest";
import { loginBooth, setOwnerEmail } from "../../test/booth";
import { photoForm } from "../../test/seed";
import { directVisitor, fakeEmail, liveHarness, review, visitorClient } from "../../test/visitor";

const EMAIL = "pemilik@c.id";

/** Event berlangsung + booth "Kopi Rempah" dimiliki EMAIL dan pemiliknya sudah masuk. */
async function owned() {
  const ctx = await liveHarness();
  await setOwnerEmail(ctx.h, ctx.s.event.id, ctx.s.lengkap.id, EMAIL);
  const b = await loginBooth(ctx.h, EMAIL);
  return { ...ctx, b };
}

const one = async (
  h: Awaited<ReturnType<typeof liveHarness>>["h"],
  sql: string,
): Promise<Record<string, unknown>> =>
  ((await h.t.d1.prepare(sql).all()).results as Record<string, unknown>[])[0] ?? {};

describe("profil sendiri", () => {
  it("mengubah isian profil; kunci cache publik berganti dan nama baru tampil di snapshot", async () => {
    const { h, s, b } = await owned();
    const before = (await one(h, `SELECT stats_version v FROM events WHERE id='${s.event.id}'`))
      .v as number;
    const r = await b.call("PUT", "/api/booth/me", {
      name: "Kopi Rempah Baru",
      tagline: "Lebih hangat",
      about: "Cerita baru",
      teamName: "Tim Kopi",
    });
    expect(r.status).toBe(200);
    expect(r.json.booth).toMatchObject({ name: "Kopi Rempah Baru", tagline: "Lebih hangat" });
    const after = (await one(h, `SELECT stats_version v FROM events WHERE id='${s.event.id}'`))
      .v as number;
    expect(after).toBeGreaterThan(before);
    const snap = (await visitorClient(h).call("GET", "/api/snapshot")).json;
    expect(snap.booths.find((x: { id: string }) => x.id === s.lengkap.id).name).toBe(
      "Kopi Rempah Baru",
    );
  });

  it("kolom kosong menghapus nilai; yang tidak disebut tidak berubah", async () => {
    const { b } = await owned();
    const r = await b.call("PUT", "/api/booth/me", { tagline: "" });
    expect(r.json.booth.tagline).toBeNull();
    expect(r.json.booth.name).toBe("Kopi Rempah");
  });

  it("nama tidak boleh kosong", async () => {
    const { b } = await owned();
    expect((await b.call("PUT", "/api/booth/me", { name: "  " })).status).toBe(400);
  });

  it("pemilik TIDAK bisa mengubah status, email, atau kolom moderasi (skema strict, 400)", async () => {
    const { h, s, b } = await owned();
    for (const patch of [
      { status: "approved" },
      { email: "curang@c.id" },
      { rejectReason: "x" },
      { isLate: false },
      { approvedBy: "saya" },
    ]) {
      expect((await b.call("PUT", "/api/booth/me", patch)).status, JSON.stringify(patch)).toBe(400);
    }
    expect(
      await one(h, `SELECT email, status FROM booths WHERE id='${s.lengkap.id}'`),
    ).toMatchObject({
      email: EMAIL,
      status: "approved",
    });
  });

  it("tanpa Idempotency-Key: 400; tanpa sesi: 401", async () => {
    const { h, b } = await owned();
    const noKey = await b.call("PUT", "/api/booth/me", { tagline: "x" }, { key: false });
    expect(noKey.json.code).toBe("idempotency_key_required");
    const anon = await visitorClient(h).call("PUT", "/api/booth/me", { tagline: "x" });
    expect(anon.status).toBe(401);
  });

  it("revisi: perbaiki lalu kirim ulang → pending; dari status lain ditolak", async () => {
    const { h, s, b } = await owned();
    const approved = await b.call("POST", "/api/booth/resubmit");
    expect(approved.status).toBe(403);
    expect(approved.json.code).toBe("booth_not_editable");

    await h.call("PATCH", `${s.base}/${s.lengkap.id}`, {
      status: "revision",
      rejectReason: "Tambahkan deskripsi yang jelas",
      reason: "uji coba",
    });
    const me = (await b.call("GET", "/api/booth/me")).json.me.booth;
    expect(me).toMatchObject({
      status: "revision",
      rejectReason: "Tambahkan deskripsi yang jelas",
    });
    expect((await b.call("PUT", "/api/booth/me", { description: "Deskripsi baru" })).status).toBe(
      200,
    );
    expect((await b.call("POST", "/api/booth/resubmit")).status).toBe(200);
    expect((await b.call("GET", "/api/booth/me")).json.me.booth.status).toBe("pending");
    // pending: tidak tayang lagi di daftar publik sampai admin menyetujui
    const snap = (await visitorClient(h).call("GET", "/api/snapshot")).json;
    expect(snap.booths.map((x: { id: string }) => x.id)).not.toContain(s.lengkap.id);
  });
});

describe("statistik ulasan di portal", () => {
  it("rating terlihat: rata-rata, sebaran, dan peringkat sama dengan data publik", async () => {
    const { h, s, b } = await owned();
    for (let i = 0; i < 3; i++) {
      const v = await directVisitor(h, s.event.id, { name: `T${i}` });
      await review(v, s.lengkap.id, { stars: i === 0 ? 4 : 5 });
    }
    const st = (await b.call("GET", "/api/booth/me")).json.me.stats;
    expect(st).toMatchObject({
      ratingsVisible: true,
      reviewCount: 3,
      distribution: [0, 0, 0, 1, 2],
      rank: 1,
    });
    expect(st.average).toBeCloseTo(14 / 3, 5);
  });

  it("rating disembunyikan admin: semua angka null (tidak dikirim sama sekali)", async () => {
    const { h, s, b } = await owned();
    const v = await directVisitor(h, s.event.id);
    await review(v, s.lengkap.id, { stars: 5 });
    await s.setEvent({ ratingsMode: "hidden" });
    const st = (await b.call("GET", "/api/booth/me")).json.me.stats;
    expect(st).toEqual({
      ratingsVisible: false,
      reviewCount: null,
      average: null,
      distribution: null,
      rank: null,
      rankedCount: null,
    });
    expect(JSON.stringify((await b.call("GET", "/api/booth/reviews")).json)).not.toMatch(
      /"stars":\s*\d/,
    );
  });

  it("peringkat disembunyikan: rating tetap terlihat, peringkat null", async () => {
    const { h, s, b } = await owned();
    const v = await directVisitor(h, s.event.id);
    await review(v, s.lengkap.id, { stars: 5 });
    await s.setEvent({ rankingMode: "hidden" });
    const st = (await b.call("GET", "/api/booth/me")).json.me.stats;
    expect(st).toMatchObject({
      ratingsVisible: true,
      reviewCount: 1,
      rank: null,
      rankedCount: null,
    });
  });
});

describe("ulasan masuk dan laporan (A4, A15)", () => {
  async function withComment() {
    const ctx = await owned();
    const v = await directVisitor(ctx.h, ctx.s.event.id, { name: "Rina" });
    await review(v, ctx.s.lengkap.id, { stars: 2, comment: "Kopinya kurang hangat" });
    const list = (await ctx.b.call("GET", "/api/booth/reviews")).json;
    return { ...ctx, v, rid: list.reviews[0].id as string };
  }

  it("daftar ulasan hanya yang tampil publik: ditahan/disembunyikan tidak muncul", async () => {
    const { h, s, b, rid } = await withComment();
    expect((await b.call("GET", "/api/booth/reviews")).json.reviews).toHaveLength(1);
    await h.call("PATCH", `/api/admin/e/${s.event.id}/reviews/${rid}/comment`, {
      commentStatus: "hidden",
      reason: "uji coba",
    });
    expect((await b.call("GET", "/api/booth/reviews")).json.reviews).toHaveLength(0);
  });

  it("booth melaporkan: tercatat sebagai laporan booth, ulasan TIDAK berubah, laporan ganda diabaikan", async () => {
    const { h, b, rid } = await withComment();
    const r = await b.call("POST", `/api/booth/reviews/${rid}/report`, {
      reason: "profanity",
      note: "kasar",
    });
    expect(r.json).toEqual({ ok: true, alreadyReported: false });
    expect(
      (await b.call("POST", `/api/booth/reviews/${rid}/report`, { reason: "spam" })).json
        .alreadyReported,
    ).toBe(true);

    const rep = await one(h, "SELECT reporter_role, reporter_booth_id, status FROM review_reports");
    expect(rep).toMatchObject({ reporter_role: "booth", status: "open" });
    expect(await one(h, `SELECT status, comment_status FROM reviews WHERE id='${rid}'`)).toEqual({
      status: "visible",
      comment_status: "visible",
    });
    // komentar tetap tampil publik: booth tidak bisa menyembunyikan
    const pub = (
      await visitorClient(h).call(
        "GET",
        `/api/booths/${(await one(h, "SELECT booth_id b FROM reviews")).b}/reviews`,
      )
    ).json;
    expect(pub.reviews).toHaveLength(1);
  });

  it("tidak bisa melaporkan ulasan booth LAIN atau ulasan yang tidak ada", async () => {
    const { h, s, b } = await withComment();
    const v2 = await directVisitor(h, s.event.id, { name: "Dodi" });
    await review(v2, s.hanyaNama.id, { stars: 1, comment: "Kurang ramah" });
    const otherId = (await one(h, `SELECT id FROM reviews WHERE booth_id='${s.hanyaNama.id}'`))
      .id as string;
    expect(
      (await b.call("POST", `/api/booth/reviews/${otherId}/report`, { reason: "spam" })).status,
    ).toBe(404);
    expect(
      (await b.call("POST", "/api/booth/reviews/tidak-ada/report", { reason: "spam" })).status,
    ).toBe(404);
  });

  it("tidak ada rute untuk menyembunyikan/mengubah/menghapus ulasan dari sisi booth", async () => {
    const { b, rid } = await withComment();
    for (const [m, p] of [
      ["PATCH", `/api/booth/reviews/${rid}`],
      ["PUT", `/api/booth/reviews/${rid}`],
      ["DELETE", `/api/booth/reviews/${rid}`],
      ["POST", `/api/booth/reviews/${rid}/hide`],
      ["PATCH", `/api/booth/reviews/${rid}/comment`],
    ] as const) {
      const r = await b.call(m, p, { status: "hidden" });
      expect([404, 405], `${m} ${p}`).toContain(r.status);
    }
  });

  it("alasan laporan tidak valid: 400", async () => {
    const { b, rid } = await withComment();
    expect(
      (await b.call("POST", `/api/booth/reviews/${rid}/report`, { reason: "asal" })).status,
    ).toBe(400);
  });
});

describe("foto dan logo", () => {
  it("unggah, urutkan, hapus foto; logo diunggah dan dihapus (jalur yang sama dengan admin)", async () => {
    const { h, b } = await owned();
    const first = await b.call("POST", "/api/booth/media?kind=photo", undefined, {
      raw: photoForm(),
    });
    expect(first.status).toBe(201);
    const second = await b.call("POST", "/api/booth/media?kind=photo", undefined, {
      raw: photoForm(),
    });
    // seed sudah punya 2 foto: urutan lanjut
    expect(second.json.photo.position).toBe(first.json.photo.position + 1);

    const photos = (await b.call("GET", "/api/booth/photos")).json.photos;
    expect(photos).toHaveLength(4);
    const ids = photos.map((p: { id: string }) => p.id).reverse();
    const re = await b.call("PUT", "/api/booth/photos/order", { ids });
    expect(re.json.photos[0].id).toBe(ids[0]);
    const del = await b.call("DELETE", `/api/booth/photos/${ids[0]}`);
    expect(del.json.photos).toHaveLength(3);

    const logo = await b.call("POST", "/api/booth/media?kind=logo", undefined, {
      raw: photoForm([512, 512], [128, 128]),
    });
    expect(logo.status).toBe(201);
    expect((await b.call("DELETE", "/api/booth/logo")).status).toBe(200);
    expect(h.r2.objects.size).toBeGreaterThan(0);
  });

  it("tidak bisa menyentuh foto booth lain (id foto booth lain → 404)", async () => {
    const { h, s, b } = await owned();
    // foto milik booth LAIN
    const other = await h.call("POST", `${s.base}/${s.hanyaNama.id}/media?kind=photo`, undefined, {
      raw: photoForm(),
    });
    const r = await b.call("DELETE", `/api/booth/photos/${other.json.photo.id}`);
    expect(r.status).toBe(404);
    expect(
      (await b.call("GET", "/api/booth/photos")).json.photos.map((p: { id: string }) => p.id),
    ).not.toContain(other.json.photo.id);
  });

  it("badan gambar tidak valid ditolak 400; tanpa kunci 400", async () => {
    const { b } = await owned();
    const bad = new FormData();
    bad.append("full", new Blob(["bukan webp"], { type: "image/webp" }), "f.webp");
    bad.append("thumb", new Blob(["x"], { type: "image/webp" }), "t.webp");
    expect(
      (await b.call("POST", "/api/booth/media?kind=photo", undefined, { raw: bad })).status,
    ).toBe(400);
    expect(
      (
        await b.call("POST", "/api/booth/media?kind=photo", undefined, {
          raw: photoForm(),
          key: false,
        })
      ).status,
    ).toBe(400);
  });
});

describe("produk (A14): sepenuhnya opsional", () => {
  it("daftar, tambah, ubah, sembunyikan, andalan, hapus", async () => {
    const { b } = await owned();
    const list = (await b.call("GET", "/api/booth/products")).json.products;
    expect(list).toHaveLength(2);

    const c = await b.call("POST", "/api/booth/products", {
      name: "Kopi Susu",
      priceIdr: 15000,
      termsConfirmed: true,
    });
    expect(c.status).toBe(201);
    const pid = c.json.product.id as string;
    expect(
      (await b.call("PATCH", `/api/booth/products/${pid}`, { priceIdr: 16000, status: "hidden" }))
        .json.product,
    ).toMatchObject({
      priceIdr: 16000,
      status: "hidden",
    });
    expect((await b.call("PUT", `/api/booth/products/${pid}/featured`)).status).toBe(400); // tersembunyi tidak bisa jadi andalan
    await b.call("PATCH", `/api/booth/products/${pid}`, { status: "active" });
    const feat = await b.call("PUT", `/api/booth/products/${pid}/featured`);
    expect(feat.json.products.filter((p: { isFeatured: boolean }) => p.isFeatured)).toHaveLength(1);
    expect((await b.call("DELETE", `/api/booth/products/${pid}`)).status).toBe(200);
    expect((await b.call("GET", "/api/booth/products")).json.products).toHaveLength(2);
  });

  it("batas produk per event ditegakkan atomik (product_limit)", async () => {
    const { h, s, b } = await owned();
    await h.call("PUT", `/api/admin/events/${s.event.id}`, { settings: { maxProducts: 3 } });
    expect(
      (
        await b.call("POST", "/api/booth/products", {
          name: "Satu",
          priceIdr: 1000,
          termsConfirmed: true,
        })
      ).status,
    ).toBe(201);
    const over = await b.call("POST", "/api/booth/products", {
      name: "Dua",
      priceIdr: 1000,
      termsConfirmed: true,
    });
    expect(over.status).toBe(409);
    expect(over.json.code).toBe("product_limit");
  });

  it("pemilik tidak bisa memberi status removed_by_admin, dan produk yang dihapus admin tidak bisa disentuh", async () => {
    const { h, s, b } = await owned();
    expect(
      (await b.call("PATCH", `/api/booth/products/${s.p2.id}`, { status: "removed_by_admin" }))
        .status,
    ).toBe(400);

    await h.call("PATCH", `${s.base}/${s.lengkap.id}/products/${s.p2.id}`, {
      status: "removed_by_admin",
    });
    for (const [m, p, body] of [
      ["PATCH", `/api/booth/products/${s.p2.id}`, { status: "active" }],
      ["DELETE", `/api/booth/products/${s.p2.id}`, undefined],
      ["PUT", `/api/booth/products/${s.p2.id}/featured`, undefined],
      ["DELETE", `/api/booth/products/${s.p2.id}/photo`, undefined],
    ] as const) {
      const r = await b.call(m, p, body);
      expect(r.status, `${m} ${p}`).toBe(403);
    }
  });

  it("tidak bisa menyentuh produk booth lain (404)", async () => {
    const { h, s, b } = await owned();
    const other = (
      await h.call("POST", `${s.base}/${s.hanyaNama.id}/products`, {
        name: "Milik Lain",
        priceIdr: 1000,
        termsConfirmed: true,
      })
    ).json.product;
    for (const [m, p] of [
      ["PATCH", `/api/booth/products/${other.id}`],
      ["DELETE", `/api/booth/products/${other.id}`],
      ["PUT", `/api/booth/products/${other.id}/featured`],
    ] as const) {
      expect(
        (await b.call(m, p, m === "PATCH" ? { name: "x" } : undefined)).status,
        `${m} ${p}`,
      ).toBe(404);
    }
  });

  it("foto produk: unggah dan hapus lewat portal", async () => {
    const { b, s } = await owned();
    const up = await b.call(
      "POST",
      `/api/booth/media?kind=product&productId=${s.p2.id}`,
      undefined,
      {
        raw: photoForm([960, 720], [400, 300]),
      },
    );
    expect(up.status).toBe(201);
    expect(up.json.product.keyThumb).toBeTruthy();
    const del = await b.call("DELETE", `/api/booth/products/${s.p2.id}/photo`);
    expect(del.json.product.keyThumb).toBeNull();
  });
});

describe("WhatsApp (A14, B24)", () => {
  it("harus ada persetujuan pemilik; tercatat consent_by = owner; nomor dinormalisasi; hapus tanpa persetujuan", async () => {
    const { h, s, b } = await owned();
    expect((await b.call("PUT", "/api/booth/whatsapp", { number: "0811-222-3333" })).status).toBe(
      400,
    );
    expect(
      (await b.call("PUT", "/api/booth/whatsapp", { number: "abc", consent: true })).status,
    ).toBe(400);

    expect(
      (await b.call("PUT", "/api/booth/whatsapp", { number: "0811-222-3333", consent: true }))
        .status,
    ).toBe(200);
    expect(
      await one(
        h,
        `SELECT whatsapp_e164 n, whatsapp_consent_by by FROM booths WHERE id='${s.lengkap.id}'`,
      ),
    ).toEqual({
      n: "628112223333",
      by: "owner",
    });
    expect((await b.call("PUT", "/api/booth/whatsapp", { number: "" })).status).toBe(200);
    expect(await one(h, `SELECT whatsapp_e164 n FROM booths WHERE id='${s.lengkap.id}'`)).toEqual({
      n: null,
    });
  });
});

describe("notifikasi email ke pemilik (A4)", () => {
  it("disetujui / revisi / ditolak / ditangguhkan: email berisi alasan dan tautan portal", async () => {
    const mail = fakeEmail();
    const { h, s } = await liveHarness({ email: mail.send });
    await setOwnerEmail(h, s.event.id, s.lengkap.id, EMAIL);
    mail.sent.length = 0;
    const patch = (body: object) =>
      h.call("PATCH", `${s.base}/${s.lengkap.id}`, { reason: "uji coba", ...body });

    await patch({ status: "revision", rejectReason: "Foto kurang jelas" });
    await patch({ status: "rejected", rejectReason: "Tidak sesuai tema" });
    await patch({ status: "approved" });
    await patch({ status: "suspended", rejectReason: "Laporan pengunjung" });

    expect(mail.sent.map((m) => m.subject)).toEqual([
      expect.stringContaining("perlu diperbaiki"),
      expect.stringContaining("belum bisa disetujui"),
      expect.stringContaining("disetujui"),
      expect.stringContaining("ditangguhkan"),
    ]);
    expect(mail.sent.every((m) => m.to === EMAIL)).toBe(true);
    expect(mail.sent[0]?.text).toContain("Foto kurang jelas");
    expect(mail.sent[1]?.text).toContain("Tidak sesuai tema");
    expect(mail.sent[0]?.text).toContain("http://localhost/booth");
  });

  it("booth tanpa pemilik: tidak ada email; perubahan non-status: tidak ada email", async () => {
    const mail = fakeEmail();
    const { h, s } = await liveHarness({ email: mail.send });
    await h.call("PATCH", `${s.base}/${s.hanyaNama.id}`, {
      status: "suspended",
      rejectReason: "uji",
    });
    await setOwnerEmail(h, s.event.id, s.lengkap.id, EMAIL);
    mail.sent.length = 0;
    await h.call("PATCH", `${s.base}/${s.lengkap.id}`, { tagline: "baru", reason: "uji coba" });
    expect(mail.sent).toHaveLength(0);
  });

  it("pengiriman gagal TIDAK menggagalkan aksi admin", async () => {
    const { h, s } = await liveHarness({
      email: async () => {
        throw new Error("penyedia mati");
      },
    });
    await setOwnerEmail(h, s.event.id, s.lengkap.id, EMAIL);
    const r = await h.call("PATCH", `${s.base}/${s.lengkap.id}`, {
      status: "suspended",
      rejectReason: "uji",
      reason: "uji coba",
    });
    expect(r.status).toBe(200);
    expect(r.json.booth.status).toBe("suspended");
  });

  it("undangan: terkirim, dijeda (rate_limited), dan butuh email pemilik", async () => {
    const mail = fakeEmail();
    const { h, s } = await liveHarness({ email: mail.send });
    const inv = `${s.base}/${s.lengkap.id}/invite`;
    expect((await h.call("POST", inv)).status).toBe(400); // belum ada pemilik
    await setOwnerEmail(h, s.event.id, s.lengkap.id, EMAIL);
    mail.sent.length = 0;

    const ok = await h.call("POST", inv);
    expect(ok.json).toEqual({ sent: true });
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0]?.text).toContain("/booth");
    expect((await h.call("POST", inv)).status).toBe(429);
    h.clk.t += 61_000;
    expect((await h.call("POST", inv)).status).toBe(200);
  });
});
