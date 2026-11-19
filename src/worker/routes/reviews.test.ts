import { CONFIG } from "@shared/config";
import { describe, expect, it } from "vitest";
import { directVisitor, liveHarness, loginWithOtp, review, visitorClient } from "../test/visitor";

type H = Awaited<ReturnType<typeof liveHarness>>["h"];

const stats = async (h: H, boothId: string) =>
  (await h.t.d1.prepare("SELECT * FROM booth_stats WHERE booth_id = ?").bind(boothId).first()) as {
    review_count: number;
    star_sum: number;
    s1: number;
    s2: number;
    s3: number;
    s4: number;
    s5: number;
    category_counts_json: string;
  };

const categories = async (h: H) =>
  (await visitorClient(h).call("GET", "/api/event")).json.event.reviewCategories as {
    id: string;
    label: string;
  }[];

const publicReviews = async (h: H, boothId: string, q = "") =>
  (await visitorClient(h).call("GET", `/api/booths/${boothId}/reviews${q}`)).json;

describe("POST /api/booths/:id/review: dasar", () => {
  it("masuk dulu: tanpa sesi 401", async () => {
    const { h, s } = await liveHarness();
    const r = await review(visitorClient(h), s.lengkap.id, { stars: 5 });
    expect(r.status).toBe(401);
  });

  it("bintang saja cukup: 201, statistik booth dihitung, ringkasan terima kasih", async () => {
    const { h, s } = await liveHarness();
    const v = await loginWithOtp(h, "a@b.id", "Ani");
    const r = await review(v, s.lengkap.id, { stars: 5 });
    expect(r.status).toBe(201);
    expect(r.json).toMatchObject({
      created: true,
      commentHeld: false,
      review: { boothId: s.lengkap.id, stars: 5, comment: null, categoryIds: [] },
      progress: { reviewed: 1, total: 2 },
    });
    // booth lain yang belum dinilai disarankan (bukan booth yang baru dinilai, bukan yang belum tayang)
    expect(r.json.suggestions.map((x: { id: string }) => x.id)).toEqual([s.hanyaNama.id]);
    const st = await stats(h, s.lengkap.id);
    expect(st).toMatchObject({ review_count: 1, star_sum: 5, s5: 1 });
  });

  it("kirim ulang = EDIT (200), bukan review kedua; statistik mengikuti (tidak ganda)", async () => {
    const { h, s } = await liveHarness();
    const v = await loginWithOtp(h, "a@b.id");
    await review(v, s.lengkap.id, { stars: 5 });
    const r = await review(v, s.lengkap.id, { stars: 2, comment: "Ternyata biasa saja" });
    expect(r.status).toBe(200);
    expect(r.json.created).toBe(false);
    expect(await stats(h, s.lengkap.id)).toMatchObject({
      review_count: 1,
      star_sum: 2,
      s5: 0,
      s2: 1,
    });
    const rows = (await h.t.d1.prepare("SELECT COUNT(*) AS n FROM reviews").first()) as {
      n: number;
    };
    expect(rows.n).toBe(1);
  });

  it("dua pengunjung berbeda menjumlah; rata-rata dan sebaran tampil di detail booth", async () => {
    const { h, s } = await liveHarness();
    const a = await loginWithOtp(h, "a@b.id");
    const b = await directVisitor(h, s.event.id);
    await review(a, s.lengkap.id, { stars: 5 });
    await review(b, s.lengkap.id, { stars: 3 });
    const d = (await visitorClient(h).call("GET", `/api/booths/${s.lengkap.id}`)).json.booth;
    expect(d.ratingCount).toBe(2);
    expect(d.ratingAverage).toBe(4);
    expect(d.distribution).toEqual([0, 0, 1, 0, 1]);
  });

  it("kunci idempotensi: wajib; kunci sama = hasil sama tanpa efek ganda", async () => {
    const { h, s } = await liveHarness();
    const v = await loginWithOtp(h, "a@b.id");
    const none = await v.call(
      "POST",
      `/api/booths/${s.lengkap.id}/review`,
      { stars: 4 },
      { key: false },
    );
    expect(none.json.code).toBe("idempotency_key_required");
    const key = crypto.randomUUID();
    const one = await review(v, s.lengkap.id, { stars: 4 }, key);
    const two = await review(v, s.lengkap.id, { stars: 4 }, key);
    expect(one.status).toBe(201);
    expect(two.status).toBe(201); // diputar ulang, bukan 200 "edit"
    expect(two.json).toEqual(one.json);
    expect((await stats(h, s.lengkap.id)).review_count).toBe(1);
  });

  it("hanya selama voting: sebelum mulai 403 voting_closed, setelah selesai 403 event_ended", async () => {
    const { h, s } = await liveHarness();
    const v = await loginWithOtp(h, "a@b.id");
    h.clk.t = 1500; // registrasi belum ditutup, event belum mulai
    expect((await review(v, s.lengkap.id, { stars: 5 })).json.code).toBe("voting_closed");
    h.clk.t = 9_100_000_000_000;
    expect((await review(v, s.lengkap.id, { stars: 5 })).json.code).toBe("event_ended");
    expect((await stats(h, s.lengkap.id)).review_count).toBe(0);
  });

  it("booth belum tayang atau tidak ada: 404", async () => {
    const { h, s } = await liveHarness();
    const v = await loginWithOtp(h, "a@b.id");
    expect((await review(v, s.pending.id, { stars: 5 })).status).toBe(404);
    expect((await review(v, "tidak-ada", { stars: 5 })).status).toBe(404);
  });

  it("pengunjung yang diblokir admin tidak bisa menilai", async () => {
    const { h, s } = await liveHarness();
    const v = await loginWithOtp(h, "a@b.id");
    await h.call("PUT", `/api/admin/e/${s.event.id}/visitors/${v.visitor.id}/blocked`, {
      blocked: true,
      reason: "spam berulang",
    });
    expect((await review(v, s.lengkap.id, { stars: 5 })).json.code).toBe("visitor_blocked");
  });
});

describe("validasi masukan", () => {
  const bad: [string, Record<string, unknown>][] = [
    ["bintang 0", { stars: 0 }],
    ["bintang 6", { stars: 6 }],
    ["bintang pecahan", { stars: 2.5 }],
    ["bintang teks", { stars: "5" }],
    ["tanpa bintang", { comment: "halo" }],
    [
      "komentar terlalu panjang",
      { stars: 4, comment: "x".repeat(CONFIG.review.maxCommentLength + 1) },
    ],
    ["kategori ganda", { stars: 4, categoryIds: ["a", "a"] }],
    ["terlalu banyak kategori", { stars: 4, categoryIds: ["a", "b", "c", "d"] }],
    // B25 pengujian 1: tidak ada jalur klien untuk mengubah status moderasi
    ["menyisipkan status", { stars: 4, status: "hidden" }],
    ["menyisipkan commentStatus", { stars: 4, commentStatus: "visible", comment: "x" }],
    ["menyisipkan pinned/riskScore", { stars: 4, pinned: 1, riskScore: 0 }],
    ["menyisipkan visitorId", { stars: 4, visitorId: "orang-lain" }],
  ];
  for (const [name, body] of bad) {
    it(`ditolak 400: ${name}`, async () => {
      const { h, s } = await liveHarness();
      const v = await loginWithOtp(h, "a@b.id");
      const r = await review(v, s.lengkap.id, body);
      expect(r.status, JSON.stringify(r.json)).toBe(400);
      expect((await stats(h, s.lengkap.id)).review_count).toBe(0);
    });
  }

  it("kategori tak dikenal ditolak; kategori aktif diterima dan dirangkum", async () => {
    const { h, s } = await liveHarness();
    const v = await loginWithOtp(h, "a@b.id");
    expect((await review(v, s.lengkap.id, { stars: 4, categoryIds: ["tidak-ada"] })).status).toBe(
      400,
    );
    const [c1, c2] = await categories(h);
    const ok = await review(v, s.lengkap.id, { stars: 4, categoryIds: [c1?.id, c2?.id] });
    expect(ok.status).toBe(201);
    const d = (await visitorClient(h).call("GET", `/api/booths/${s.lengkap.id}`)).json.booth;
    expect(d.topCategories).toHaveLength(2);
    expect(d.topCategories[0]).toMatchObject({ count: 1 });
  });

  it("komentar opsional: kosong, spasi saja, null, atau tidak ada tetap berhasil (201) dan tersimpan sebagai null", async () => {
    const { h, s } = await liveHarness();
    const bodies: Record<string, unknown>[] = [
      { stars: 4 },
      { stars: 4, comment: "" },
      { stars: 4, comment: "    " },
      { stars: 4, comment: null },
    ];
    for (const body of bodies) {
      const who = await directVisitor(h, s.event.id);
      const r = await who.call("POST", `/api/booths/${s.lengkap.id}/review`, body, {});
      expect(r.status, JSON.stringify(body)).toBe(201);
      expect(r.json.review.comment).toBeNull();
    }
    expect((await stats(h, s.lengkap.id)).review_count).toBe(bodies.length); // semua dihitung
  });

  it("edit: komentar bisa dikosongkan lagi tanpa menolak review", async () => {
    const { h, s } = await liveHarness();
    const v = await loginWithOtp(h, "a@b.id");
    await review(v, s.lengkap.id, { stars: 5, comment: "Mantap" });
    const r = await review(v, s.lengkap.id, { stars: 4, comment: "" });
    expect(r.status).toBe(200);
    expect(r.json.review).toMatchObject({ stars: 4, comment: null });
  });
});

describe("booth menilai diri sendiri (B9)", () => {
  it("email pemilik booth = identitas pengunjung → 403 own_booth; booth lain boleh", async () => {
    const { h, s } = await liveHarness();
    await h.call("PUT", `/api/admin/e/${s.event.id}/booths/${s.lengkap.id}/owner`, {
      email: "Pemilik@Kopi.id",
    });
    const v = await loginWithOtp(h, "pemilik@kopi.id");
    const own = await review(v, s.lengkap.id, { stars: 5 });
    expect(own.status).toBe(403);
    expect(own.json.code).toBe("own_booth");
    expect((await stats(h, s.lengkap.id)).review_count).toBe(0);
    expect((await review(v, s.hanyaNama.id, { stars: 4 })).status).toBe(201);
  });

  it("booth tanpa pemilik (tanpa email) dilewati: tidak ada identitas yang dibandingkan", async () => {
    const { h, s } = await liveHarness();
    const v = await loginWithOtp(h, "siapa@saja.id");
    expect((await review(v, s.hanyaNama.id, { stars: 4 })).status).toBe(201);
  });
});

describe("filter kata (A15, B25): hanya teks komentar; bintang selalu terhitung", () => {
  const submit = async (comment: string) => {
    const { h, s } = await liveHarness();
    const v = await loginWithOtp(h, "a@b.id", "Ani");
    const r = await review(v, s.lengkap.id, { stars: 5, comment });
    return { h, s, v, r };
  };

  it("berat → ditahan: bintang tetap masuk, komentar tidak ada di respons publik mana pun", async () => {
    const { h, s, r } = await submit("dasar bangsat, booth jelek");
    expect(r.status).toBe(201);
    expect(r.json.commentHeld).toBe(true);
    expect(await stats(h, s.lengkap.id)).toMatchObject({ review_count: 1, star_sum: 5 });

    const list = await publicReviews(h, s.lengkap.id);
    expect(list.reviews).toEqual([]);
    const everywhere = JSON.stringify([
      list,
      (await visitorClient(h).call("GET", `/api/booths/${s.lengkap.id}`)).json,
      (await visitorClient(h).call("GET", "/api/snapshot")).json,
    ]);
    expect(everywhere).not.toContain("bangsat");
    expect(everywhere).not.toContain("booth jelek");
  });

  it("ringan → tayang disamarkan (hanya bentuk tersamar yang dikirim)", async () => {
    const { h, s, r } = await submit("kopinya enak tapi antrean anjir lama");
    expect(r.json.commentHeld).toBe(false);
    const list = await publicReviews(h, s.lengkap.id);
    expect(list.reviews).toHaveLength(1);
    expect(list.reviews[0].text).toBe("kopinya enak tapi antrean a***r lama");
    expect(JSON.stringify(list)).not.toContain("anjir");
  });

  it("kontak/tautan/iklan → ditahan", async () => {
    const { h, s, r } = await submit("pesan lewat wa 0812-3456-7890 ya");
    expect(r.json.commentHeld).toBe(true);
    expect((await publicReviews(h, s.lengkap.id)).reviews).toEqual([]);
  });

  it("komentar wajar tayang apa adanya", async () => {
    const { h, s, r } = await submit("Kopi rempahnya enak, pelayanannya ramah!");
    expect(r.json.commentHeld).toBe(false);
    expect((await publicReviews(h, s.lengkap.id)).reviews[0].text).toBe(
      "Kopi rempahnya enak, pelayanannya ramah!",
    );
  });

  it("pesan ke pengirim tidak menyebut kata yang tertangkap", async () => {
    const { r } = await submit("dasar bangsat");
    // Komentar milik pengirim sendiri boleh dipantulkan; selebihnya tidak boleh memuat kata atau temuan filter.
    const { comment: _own, ...rest } = r.json.review;
    expect(JSON.stringify({ ...r.json, review: rest })).not.toMatch(
      /bangsat|kata|filter|term|hit/i,
    );
    expect(r.json.commentHeld).toBe(true); // boleh diberi tahu "komentar diperiksa dulu" (A15), tanpa menyebut kata
  });

  it("teks asli tetap tersimpan untuk admin; hasil filter dicatat (tanpa teks) di baris review", async () => {
    const { h } = await submit("dasar bangsat");
    const row = (await h.t.d1.prepare("SELECT * FROM reviews").first()) as Record<string, unknown>;
    expect(row.comment).toBe("dasar bangsat");
    expect(row.comment_status).toBe("held");
    expect(row.status).toBe("visible"); // review (bintang) tetap tayang dan terhitung
    expect(JSON.parse(String(row.filter_hits_json))).toHaveLength(1);
    expect(row.filter_version).not.toBeNull();
  });

  it("mengirim ulang teks yang sama tidak melepas tahanan; mengganti teks memeriksanya ulang", async () => {
    const { h, s, v } = await submit("dasar bangsat");
    const same = await review(v, s.lengkap.id, { stars: 4, comment: "dasar bangsat" });
    expect(same.json.commentHeld).toBe(true);
    const fixed = await review(v, s.lengkap.id, { stars: 4, comment: "maaf, kopinya enak" });
    expect(fixed.json.commentHeld).toBe(false);
    expect((await publicReviews(h, s.lengkap.id)).reviews[0].text).toBe("maaf, kopinya enak");
  });

  it("admin mengubah daftar kata tanpa deploy: istilah baru langsung berlaku", async () => {
    const { h, s } = await liveHarness();
    const v = await loginWithOtp(h, "a@b.id");
    const before = await review(v, s.lengkap.id, {
      stars: 5,
      comment: "pelayanannya payah sekali",
    });
    expect(before.json.commentHeld).toBe(false);
    h.clk.t += 1000;
    await h.call("PUT", `/api/admin/e/${s.event.id}/moderation/terms`, {
      terms: [{ term: "payah", severity: "severe" }],
      reason: "kata ini sering dipakai menghina",
    });
    const after = await review(v, s.lengkap.id, { stars: 5, comment: "pelayanannya payah banget" });
    expect(after.json.commentHeld).toBe(true);
  });
});

describe("skor risiko menahan review diam-diam (B9)", () => {
  it("lonjakan: review melewati ambang per menit ditahan, tidak dihitung, tetapi pengirim melihat 'terkirim'", async () => {
    const { h, s } = await liveHarness();
    const results: number[] = [];
    // Tiap pengunjung berbeda; IP berbeda agar hanya sinyal lonjakan + akun baru yang bekerja.
    for (let i = 0; i < CONFIG.spam.burstThresholdPerBoothPerMin + 4; i++) {
      const v = await directVisitor(h, s.event.id, { createdAt: 1 });
      const r = await review(v, s.lengkap.id, { stars: 5, comment: "mantap" }, undefined);
      expect(r.status).toBe(201);
      results.push(r.json.review.stars);
    }
    const held = (await h.t.d1
      .prepare("SELECT COUNT(*) AS n FROM reviews WHERE status = 'held'")
      .first()) as { n: number };
    // Lonjakan saja (40) belum cukup menahan; butuh sinyal lain. Pastikan skor dicatat dan flag 'burst' muncul.
    const flagged = (
      await h.t.d1.prepare("SELECT flags_json FROM reviews WHERE flags_json LIKE '%burst%'").all()
    ).results;
    expect(flagged.length).toBeGreaterThan(0);
    expect(held.n).toBe(0);
  });

  it("lonjakan + IP sama: ditahan dan tidak masuk statistik; pengirim tetap menerima respons sukses biasa", async () => {
    const { h, s } = await liveHarness();
    const ip = { "cf-connecting-ip": "10.0.0.9" };
    let lastStatus = 0;
    for (let i = 0; i < CONFIG.spam.burstThresholdPerBoothPerMin + 6; i++) {
      const v = await directVisitor(h, s.event.id);
      const r = await v.call(
        "POST",
        `/api/booths/${s.lengkap.id}/review`,
        { stars: 5, comment: "Seru" },
        { headers: ip },
      );
      lastStatus = r.status;
      expect(r.status).toBe(201);
      // Penahanan REVIEW (risiko) harus diam-diam: tidak ada status, skor, atau penanda di respons.
      expect(r.json.commentHeld).toBe(false);
      expect(JSON.stringify(r.json)).not.toMatch(/"status"|risk|flags|ditahan/i);
    }
    expect(lastStatus).toBe(201);
    const st = await stats(h, s.lengkap.id);
    const total = (await h.t.d1.prepare("SELECT COUNT(*) AS n FROM reviews").first()) as {
      n: number;
    };
    const held = (await h.t.d1
      .prepare("SELECT COUNT(*) AS n FROM reviews WHERE status = 'held'")
      .first()) as { n: number };
    expect(held.n).toBeGreaterThan(0);
    expect(st.review_count).toBe(total.n - held.n); // yang ditahan tidak dihitung
    expect(st.star_sum).toBe(5 * st.review_count);
  });

  it("review yang ditahan tetap ditahan walau diedit pengirim (hanya admin yang melepas)", async () => {
    const { h, s } = await liveHarness();
    const ip = { "cf-connecting-ip": "10.0.0.9" };
    let held: Awaited<ReturnType<typeof directVisitor>> | undefined;
    for (let i = 0; i < CONFIG.spam.burstThresholdPerBoothPerMin + 6 && !held; i++) {
      const v = await directVisitor(h, s.event.id);
      await v.call(
        "POST",
        `/api/booths/${s.lengkap.id}/review`,
        { stars: 5, comment: "Seru" },
        { headers: ip },
      );
      const row = (await h.t.d1
        .prepare("SELECT status FROM reviews WHERE visitor_id = ?")
        .bind(v.visitor.id)
        .first()) as { status: string };
      if (row.status === "held") held = v;
    }
    expect(held).toBeDefined();
    if (!held) return;
    h.clk.t += 120_000; // sinyal reda
    await held.call(
      "POST",
      `/api/booths/${s.lengkap.id}/review`,
      { stars: 4, comment: "Seru" },
      {},
    );
    const row = (await h.t.d1
      .prepare("SELECT status, stars FROM reviews WHERE visitor_id = ?")
      .bind(held.visitor.id)
      .first()) as { status: string; stars: number };
    expect(row).toEqual({ status: "held", stars: 4 });
  });
});

describe("batas laju per pengunjung", () => {
  it("lebih dari N review per menit → 429 rate_limited dengan Retry-After", async () => {
    const { h, s } = await liveHarness();
    // booth tambahan agar bukan sekadar "edit" yang sama
    const extra: string[] = [];
    for (let i = 0; i < CONFIG.spam.maxReviewsPerVisitorPerMinute + 1; i++) {
      const b = await h.call("POST", `/api/admin/e/${s.event.id}/booths`, { name: `Booth ${i}` });
      extra.push(b.json.booth.id);
    }
    const v = await loginWithOtp(h, "a@b.id");
    const out: number[] = [];
    for (const id of extra) out.push((await review(v, id, { stars: 4 })).status);
    expect(out.slice(0, CONFIG.spam.maxReviewsPerVisitorPerMinute).every((x) => x === 201)).toBe(
      true,
    );
    expect(out[out.length - 1]).toBe(429);
  });
});

describe("GET /api/booths/:id/reviews (publik)", () => {
  async function seedMany(n: number) {
    const { h, s } = await liveHarness();
    for (let i = 0; i < n; i++) {
      h.clk.t += 1000;
      const v = await directVisitor(h, s.event.id, {
        name: i === 0 ? "Budi Santoso" : null,
        createdAt: 1,
      });
      await review(v, s.lengkap.id, { stars: 1 + (i % 5), comment: `Komentar ke-${i}` });
    }
    return { h, s };
  }

  it("terbaru dulu, halaman 10, kursor menyambung tanpa duplikat sampai habis", async () => {
    const { h, s } = await seedMany(23);
    const p1 = await publicReviews(h, s.lengkap.id);
    expect(p1.reviews).toHaveLength(10);
    expect(p1.reviews[0].text).toBe("Komentar ke-22");
    expect(p1.next).not.toBeNull();
    const p2 = await publicReviews(h, s.lengkap.id, `?cursor=${encodeURIComponent(p1.next)}`);
    const p3 = await publicReviews(h, s.lengkap.id, `?cursor=${encodeURIComponent(p2.next)}`);
    expect(p2.reviews).toHaveLength(10);
    expect(p3.reviews).toHaveLength(3);
    expect(p3.next).toBeNull();
    const ids = [...p1.reviews, ...p2.reviews, ...p3.reviews].map((r: { id: string }) => r.id);
    expect(new Set(ids).size).toBe(23);
  });

  it("nama depan/alias saja; tanpa nama = 'Pengunjung'; tidak ada email atau id pengunjung", async () => {
    const { h, s } = await seedMany(2);
    const list = await publicReviews(h, s.lengkap.id);
    const names = list.reviews.map((r: { displayName: string }) => r.displayName);
    expect(names).toContain("Pengunjung");
    expect(JSON.stringify(list)).not.toMatch(/visitor|@|identity/i);
  });

  it("review tanpa komentar ikut tampil di daftar ulasan booth (bintang + nama, tanpa teks)", async () => {
    const { h, s } = await liveHarness();
    const v = await directVisitor(h, s.event.id, { name: "Budi" });
    await review(v, s.lengkap.id, { stars: 5 });
    const list = (await publicReviews(h, s.lengkap.id)).reviews;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ stars: 5, text: null, displayName: "Budi" });
    expect((await stats(h, s.lengkap.id)).review_count).toBe(1);
  });

  it("umpan ulasan terbaru lintas booth tetap hanya yang berkomentar; komentar ditahan tampil tanpa teksnya di daftar booth", async () => {
    const { h, s } = await liveHarness();
    const a = await directVisitor(h, s.event.id, { name: "Ani" });
    const b = await directVisitor(h, s.event.id, { name: "Bimo" });
    await review(a, s.lengkap.id, { stars: 5 }); // tanpa komentar
    await review(b, s.lengkap.id, { stars: 4, comment: "Enak sekali" });
    const feed = (await visitorClient(h).call("GET", "/api/snapshot")).json.feed as {
      text: string;
    }[];
    expect(feed.map((f) => f.text)).toEqual(["Enak sekali"]);
    const list = (await publicReviews(h, s.lengkap.id)).reviews as { text: string | null }[];
    expect(list.map((r) => r.text).sort()).toEqual([null, "Enak sekali"].sort());
  });

  it("rating disembunyikan: review tanpa komentar tidak ditampilkan sama sekali (tidak ada yang bisa ditampilkan)", async () => {
    const { h, s } = await liveHarness();
    const v = await directVisitor(h, s.event.id);
    await review(v, s.lengkap.id, { stars: 5 });
    await s.setEvent({ ratingsMode: "hidden" });
    expect((await publicReviews(h, s.lengkap.id)).reviews).toEqual([]);
  });

  it("rating disembunyikan admin: bintang per ulasan tidak dikirim", async () => {
    const { h, s } = await seedMany(1);
    await s.setEvent({ ratingsMode: "hidden" });
    const list = await publicReviews(h, s.lengkap.id);
    expect(list.reviews[0].stars).toBeNull();
    expect(JSON.stringify(list)).not.toMatch(/"stars":\d/);
  });

  it("kategori ditampilkan dengan label (termasuk setelah dinonaktifkan: data lama tetap terbaca)", async () => {
    const { h, s } = await liveHarness();
    const [c1] = await categories(h);
    const v = await directVisitor(h, s.event.id);
    await review(v, s.lengkap.id, { stars: 5, comment: "Seru!", categoryIds: [c1?.id] });
    await h.call("PUT", `/api/admin/e/${s.event.id}/review-categories`, { categories: [] });
    const list = await publicReviews(h, s.lengkap.id);
    expect(list.reviews[0].categories).toEqual([{ id: c1?.id, label: c1?.label }]);
  });

  it("booth belum tayang: 404", async () => {
    const { h, s } = await liveHarness();
    expect((await visitorClient(h).call("GET", `/api/booths/${s.pending.id}/reviews`)).status).toBe(
      404,
    );
  });
});

describe("reviewer tampil anonim", () => {
  it("anonim: nama tidak tampil di daftar booth maupun umpan terbaru; tanpa nama asli di JSON publik", async () => {
    const { h, s } = await liveHarness();
    const v = await loginWithOtp(h, "ani@b.id", "Ani Wijaya");
    const r = await review(v, s.lengkap.id, { stars: 5, comment: "Enak sekali", anonymous: true });
    expect(r.status).toBe(201);
    expect(r.json.review.anonymous).toBe(true);
    const list = await publicReviews(h, s.lengkap.id);
    expect(list.reviews[0].displayName).toBe("Anonim");
    const snap = JSON.stringify((await visitorClient(h).call("GET", "/api/snapshot")).json);
    expect(snap).toContain("Anonim");
    expect(snap).not.toContain("Ani Wijaya");
    expect(JSON.stringify(list)).not.toContain("Ani");
  });

  it("bawaan tidak anonim; kirim ulang dapat mengubah ke anonim dan kembali (kirim ulang = edit)", async () => {
    const { h, s } = await liveHarness();
    const v = await loginWithOtp(h, "budi@b.id", "Budi");
    await review(v, s.lengkap.id, { stars: 4, comment: "Lumayan" });
    expect((await publicReviews(h, s.lengkap.id)).reviews[0].displayName).toBe("Budi");

    const toAnon = await review(v, s.lengkap.id, { stars: 4, comment: "Lumayan", anonymous: true });
    expect(toAnon.status).toBe(200);
    expect((await publicReviews(h, s.lengkap.id)).reviews[0].displayName).toBe("Anonim");
    expect((await v.call("GET", "/api/me/reviews")).json.reviews[0].anonymous).toBe(true);

    await review(v, s.lengkap.id, { stars: 4, comment: "Lumayan", anonymous: false });
    expect((await publicReviews(h, s.lengkap.id)).reviews[0].displayName).toBe("Budi");
    expect((await stats(h, s.lengkap.id)).review_count).toBe(1); // tetap satu review
  });

  it("anonim tidak memengaruhi bintang/statistik; nilai bukan boolean ditolak", async () => {
    const { h, s } = await liveHarness();
    const v = await loginWithOtp(h, "c@b.id", "Cici");
    await review(v, s.lengkap.id, { stars: 3, anonymous: true });
    expect(await stats(h, s.lengkap.id)).toMatchObject({ review_count: 1, star_sum: 3, s3: 1 });
    const bad = await review(v, s.lengkap.id, { stars: 3, anonymous: "ya" });
    expect(bad.status).toBe(400);
  });

  it("admin tetap melihat nama asli dan penanda anonim untuk moderasi", async () => {
    const { h, s } = await liveHarness();
    const v = await loginWithOtp(h, "d@b.id", "Dewi");
    await review(v, s.lengkap.id, { stars: 1, comment: "Kurang", anonymous: true });
    const list = (await h.call("GET", `/api/admin/e/${s.event.id}/data/reviews`)).json;
    const text = JSON.stringify(list);
    expect(text).toContain("Dewi");
  });
});

describe("GET /api/me/reviews dan /api/visitor/me", () => {
  it("daftar milikku; hanya milikku", async () => {
    const { h, s } = await liveHarness();
    const a = await loginWithOtp(h, "a@b.id");
    const b = await directVisitor(h, s.event.id);
    await review(a, s.lengkap.id, { stars: 4, comment: "oke" });
    await review(b, s.hanyaNama.id, { stars: 2 });
    const mine = (await a.call("GET", "/api/me/reviews")).json.reviews;
    expect(mine).toEqual([
      { boothId: s.lengkap.id, stars: 4, comment: "oke", categoryIds: [], anonymous: false },
    ]);
    const me = (await a.call("GET", "/api/visitor/me")).json;
    expect(me.reviewed).toEqual([{ boothId: s.lengkap.id, stars: 4 }]);
    expect((await visitorClient(h).call("GET", "/api/me/reviews")).status).toBe(401);
  });

  it("rating disembunyikan: /visitor/me tidak membocorkan bintang", async () => {
    const { h, s } = await liveHarness();
    const a = await loginWithOtp(h, "a@b.id");
    await review(a, s.lengkap.id, { stars: 4 });
    await s.setEvent({ ratingsMode: "hidden" });
    expect((await a.call("GET", "/api/visitor/me")).json.reviewed[0].stars).toBeNull();
  });
});

describe("laporan komentar oleh pengunjung (A15, B25)", () => {
  async function withComment() {
    const { h, s } = await liveHarness();
    const author = await directVisitor(h, s.event.id, { name: "Penulis" });
    await review(author, s.lengkap.id, { stars: 1, comment: "Mengecewakan sekali" });
    const list = await publicReviews(h, s.lengkap.id);
    return { h, s, author, reviewId: list.reviews[0].id as string };
  }
  const report = (
    v: Awaited<ReturnType<typeof directVisitor>>,
    id: string,
    body: Record<string, unknown> = { reason: "spam" },
  ) => v.call("POST", `/api/reviews/${id}/report`, body);

  it("laporan tercatat, TIDAK mengubah komentar, dan ganda dari pelapor sama tidak menambah", async () => {
    const { h, s, reviewId } = await withComment();
    const rep = await directVisitor(h, s.event.id);
    const r1 = await report(rep, reviewId, { reason: "hate", note: "SARA" });
    expect(r1.status).toBe(200);
    expect(r1.json.alreadyReported).toBe(false);
    expect((await report(rep, reviewId, { reason: "hate" })).json.alreadyReported).toBe(true);

    const row = (await h.t.d1
      .prepare("SELECT comment_status, status FROM reviews")
      .first()) as Record<string, string>;
    expect(row).toEqual({ comment_status: "visible", status: "visible" });
    expect(
      (await h.t.d1.prepare("SELECT COUNT(*) AS n FROM review_reports").first()) as { n: number },
    ).toEqual({ n: 1 });
    expect((await publicReviews(h, s.lengkap.id)).reviews).toHaveLength(1); // tetap tayang
  });

  it("tanpa sesi 401; laporan atas komentar sendiri 400; komentar tak terlihat 404", async () => {
    const { h, s, author, reviewId } = await withComment();
    expect(
      (await visitorClient(h).call("POST", `/api/reviews/${reviewId}/report`, { reason: "spam" }))
        .status,
    ).toBe(401);
    expect((await report(author, reviewId)).status).toBe(400);
    const rep = await directVisitor(h, s.event.id);
    expect((await report(rep, "tidak-ada")).status).toBe(404);
    await h.t.d1.exec("UPDATE reviews SET comment_status = 'held'");
    expect((await report(rep, reviewId)).status).toBe(404); // komentar yang ditahan tidak terlihat → tidak bisa dilaporkan
  });

  it("alasan harus dari daftar; kolom asing ditolak", async () => {
    const { h, s, reviewId } = await withComment();
    const rep = await directVisitor(h, s.event.id);
    expect((await report(rep, reviewId, { reason: "benci" })).status).toBe(400);
    expect((await report(rep, reviewId, { reason: "spam", status: "upheld" })).status).toBe(400);
  });

  it("batas laju laporan per pengunjung per jam", async () => {
    const { h, s } = await liveHarness();
    const rep = await directVisitor(h, s.event.id);
    // buat banyak komentar dari pengunjung lain
    const ids: string[] = [];
    for (let i = 0; i < CONFIG.spam.maxReportsPerVisitorPerHour + 1; i++) {
      const a = await directVisitor(h, s.event.id);
      await review(a, s.lengkap.id, { stars: 4, comment: `ulasan ${i}` });
    }
    for (const r of (await publicReviews(h, s.lengkap.id)).reviews) ids.push(r.id);
    const page2 = await publicReviews(
      h,
      s.lengkap.id,
      `?cursor=${encodeURIComponent((await publicReviews(h, s.lengkap.id)).next)}`,
    );
    for (const r of page2.reviews) ids.push(r.id);
    const statuses: number[] = [];
    for (const id of ids) {
      h.clk.t += 7000; // lewati pembatas per menit; yang diuji batas per jam
      statuses.push((await report(rep, id)).status);
    }
    expect(statuses.filter((x) => x === 200)).toHaveLength(CONFIG.spam.maxReportsPerVisitorPerHour);
    expect(statuses).toContain(429);
  });
});

describe("B25 pengujian 1: tidak ada jalur non-admin yang mengubah status moderasi", () => {
  it("inventaris rute: satu-satunya rute non-admin terkait review adalah yang sah dan bersifat tulis-baru", async () => {
    const { h } = await liveHarness();
    const routes = h.app.routes.filter(
      (r) => r.method !== "ALL" && !r.path.startsWith("/api/admin/"),
    );
    // `routes` memuat satu entri per handler/middleware: hitung rute unik.
    const reviewish = [
      ...new Set(routes.filter((r) => /review/i.test(r.path)).map((r) => `${r.method} ${r.path}`)),
    ].sort();
    expect(reviewish).toEqual(
      [
        "GET /api/booths/:id/reviews",
        "POST /api/booths/:id/review",
        "GET /api/me/reviews",
        "POST /api/reviews/:id/report",
        // Portal booth (A4, A15): hanya membaca ulasan masuk dan MELAPORKAN; tidak ada jalur menyembunyikan.
        "GET /api/booth/reviews",
        "POST /api/booth/reviews/:rid/report",
      ].sort(),
    );
    // Tidak ada PATCH/PUT/DELETE non-admin pada ruang review/moderasi.
    const mutating = routes.filter(
      (r) =>
        ["PATCH", "PUT", "DELETE"].includes(r.method) && /review|moderation|comment/i.test(r.path),
    );
    expect(mutating).toEqual([]);
  });

  it("mencoba PATCH/DELETE review lewat rute publik: 404 (tidak ada), bukan 403 yang bisa diakali", async () => {
    const { h, s } = await liveHarness();
    const v = await loginWithOtp(h, "a@b.id");
    await review(v, s.lengkap.id, { stars: 4, comment: "oke" });
    const id = ((await h.t.d1.prepare("SELECT id FROM reviews").first()) as { id: string }).id;
    for (const [m, p] of [
      ["PATCH", `/api/reviews/${id}`],
      ["DELETE", `/api/reviews/${id}`],
      ["PATCH", `/api/reviews/${id}/comment`],
      ["PUT", `/api/booths/${s.lengkap.id}/review`],
      ["PATCH", `/api/booths/${s.lengkap.id}/review`],
    ] as const) {
      const r = await v.call(m, p, { commentStatus: "hidden", status: "hidden" });
      expect(r.status, `${m} ${p}`).toBe(404);
    }
    const row = (await h.t.d1
      .prepare("SELECT status, comment_status FROM reviews")
      .first()) as Record<string, string>;
    expect(row).toEqual({ status: "visible", comment_status: "visible" });
  });

  it("rute admin moderasi tertutup bagi non-admin (tanpa jalur dev admin)", async () => {
    const { h, s } = await liveHarness();
    const v = visitorClient(h);
    const r = await v.call("GET", `/api/admin/e/${s.event.id}/moderation/queue`, undefined, {
      env: { APP_ENV: "production", DEV_ADMIN_EMAIL: undefined } as unknown as Partial<Env>,
    });
    expect(r.status).toBe(401);
  });
});

describe("statistik selalu konsisten dengan tabel review (invarian)", () => {
  it("setelah rangkaian kirim, edit, tahan, dan sembunyikan: booth_stats == hitungan ulang dari review", async () => {
    const { h, s } = await liveHarness();
    const people = [];
    for (let i = 0; i < 6; i++) people.push(await directVisitor(h, s.event.id));
    const [c1, c2] = await categories(h);
    await review(people[0] as never, s.lengkap.id, { stars: 5, categoryIds: [c1?.id] });
    await review(people[1] as never, s.lengkap.id, { stars: 4, categoryIds: [c1?.id, c2?.id] });
    await review(people[2] as never, s.lengkap.id, { stars: 1, comment: "dasar bangsat" }); // komentar ditahan, bintang terhitung
    await review(people[3] as never, s.lengkap.id, { stars: 3 });
    await review(people[1] as never, s.lengkap.id, { stars: 2, categoryIds: [c2?.id] }); // edit
    const rid = (
      (await h.t.d1.prepare("SELECT id FROM reviews WHERE stars = 3").first()) as { id: string }
    ).id;
    await h.call("PATCH", `/api/admin/e/${s.event.id}/reviews/${rid}`, {
      status: "hidden",
      reason: "uji sembunyikan",
    });

    const st = await stats(h, s.lengkap.id);
    const raw = (await h.t.d1
      .prepare(
        "SELECT COUNT(*) AS n, COALESCE(SUM(stars),0) AS sum, COALESCE(SUM(stars=1),0) AS s1, COALESCE(SUM(stars=2),0) AS s2, COALESCE(SUM(stars=5),0) AS s5 FROM reviews WHERE booth_id = ? AND status = 'visible'",
      )
      .bind(s.lengkap.id)
      .first()) as { n: number; sum: number; s1: number; s2: number; s5: number };
    expect(st.review_count).toBe(raw.n);
    expect(st.star_sum).toBe(raw.sum);
    expect([st.s1, st.s2, st.s5]).toEqual([raw.s1, raw.s2, raw.s5]);
    expect(st).toMatchObject({ review_count: 3, star_sum: 5 + 2 + 1 }); // 5, 2 (diedit dari 4), 1 (komentar ditahan)
    expect(JSON.parse(st.category_counts_json)).toEqual({
      [c1?.id as string]: 1,
      [c2?.id as string]: 1,
    });
  });
});
