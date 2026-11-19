import { CONFIG } from "@shared/config";
import { rankBooths } from "@shared/scoring";
import { describe, expect, it } from "vitest";
import { directVisitor, liveHarness, review, visitorClient } from "../../test/visitor";

type Fx = Awaited<ReturnType<typeof liveHarness>>;
const REASON = "alasan pengujian";

async function make(fx: Fx, boothId: string, body: Record<string, unknown>) {
  const v = await directVisitor(fx.h, fx.s.event.id, { name: "Tamu" });
  const r = await review(v, boothId, body);
  const row = (await fx.h.t.d1
    .prepare("SELECT id FROM reviews WHERE visitor_id = ? AND booth_id = ?")
    .bind(v.visitor.id, boothId)
    .first()) as { id: string };
  return { v, r, id: row.id };
}
const E = (fx: Fx) => `/api/admin/e/${fx.s.event.id}`;
const row = async (fx: Fx, id: string) =>
  (await fx.h.t.d1.prepare("SELECT * FROM reviews WHERE id = ?").bind(id).first()) as Record<
    string,
    unknown
  >;
const stat = async (fx: Fx, boothId: string) =>
  (await fx.h.t.d1
    .prepare("SELECT * FROM booth_stats WHERE booth_id = ?")
    .bind(boothId)
    .first()) as Record<string, number>;
const reporter = (fx: Fx) => directVisitor(fx.h, fx.s.event.id);
const publicList = async (fx: Fx, boothId: string) =>
  (await visitorClient(fx.h).call("GET", `/api/booths/${boothId}/reviews`)).json.reviews as {
    id: string;
    text: string;
  }[];

describe("antrean moderasi", () => {
  it("laporan dikelompokkan per komentar; SARA di atas spam; lebih banyak pelapor lebih atas", async () => {
    const fx = await liveHarness();
    const a = await make(fx, fx.s.lengkap.id, { stars: 4, comment: "komentar A" });
    const b = await make(fx, fx.s.lengkap.id, { stars: 4, comment: "komentar B" });
    const c = await make(fx, fx.s.lengkap.id, { stars: 4, comment: "komentar C" });
    const rep = async (id: string, reason: string) =>
      (await reporter(fx)).call("POST", `/api/reviews/${id}/report`, { reason });
    await rep(a.id, "spam");
    await rep(b.id, "hate");
    await rep(c.id, "spam");
    await rep(c.id, "spam"); // dua pelapor

    const q = (await fx.h.call("GET", `${E(fx)}/moderation/queue`)).json;
    expect(q.reports.map((g: { review: { id: string } }) => g.review.id)).toEqual([
      b.id,
      c.id,
      a.id,
    ]);
    expect(q.reports[0].priority).toBeLessThan(q.reports[2].priority);
    expect(q.reports[1].reports).toHaveLength(2);
    expect(q.reports[0].suspiciousReporter).toBe(false);
  });

  it("komentar ditahan filter muncul di `held` (tanpa laporan) dengan teks asli untuk admin", async () => {
    const fx = await liveHarness();
    const x = await make(fx, fx.s.lengkap.id, { stars: 5, comment: "dasar bangsat" });
    const q = (await fx.h.call("GET", `${E(fx)}/moderation/queue`)).json;
    expect(q.held).toHaveLength(1);
    expect(q.held[0]).toMatchObject({
      id: x.id,
      comment: "dasar bangsat",
      commentStatus: "held",
      filterHits: 1,
    });
  });

  it("penanda 'pelaporan mencurigakan': booth yang melaporkan hampir semua ulasan rendah tanpa temuan filter", async () => {
    const fx = await liveHarness();
    const ids: string[] = [];
    for (let i = 0; i < CONFIG.moderation.suspiciousReportMin; i++) {
      ids.push((await make(fx, fx.s.hanyaNama.id, { stars: 1, comment: `kurang bagus ${i}` })).id);
    }
    for (const id of ids) {
      await fx.h.t.d1
        .prepare(
          "INSERT INTO review_reports (id, event_id, review_id, reporter_role, reporter_booth_id, reason, created_at) VALUES (?, ?, ?, 'booth', ?, 'other', 1)",
        )
        .bind(crypto.randomUUID(), fx.s.event.id, id, fx.s.hanyaNama.id)
        .run();
    }
    const q = (await fx.h.call("GET", `${E(fx)}/moderation/queue`)).json;
    expect(q.reports).toHaveLength(ids.length);
    expect(q.reports.every((g: { suspiciousReporter: boolean }) => g.suspiciousReporter)).toBe(
      true,
    );
  });

  it("laporan booth tidak menyembunyikan apa pun sampai admin memutuskan", async () => {
    const fx = await liveHarness();
    const x = await make(fx, fx.s.lengkap.id, { stars: 1, comment: "kurang bagus" });
    await fx.h.t.d1
      .prepare(
        "INSERT INTO review_reports (id, event_id, review_id, reporter_role, reporter_booth_id, reason, created_at) VALUES (?, ?, ?, 'booth', ?, 'other', 1)",
      )
      .bind(crypto.randomUUID(), fx.s.event.id, x.id, fx.s.lengkap.id)
      .run();
    expect((await publicList(fx, fx.s.lengkap.id)).map((r) => r.id)).toEqual([x.id]);
    expect((await row(fx, x.id)).comment_status).toBe("visible");
  });
});

describe("keputusan laporan", () => {
  async function reported(
    fx: Fx,
    over: Record<string, unknown> = { stars: 1, comment: "Mengecewakan" },
  ) {
    const x = await make(fx, fx.s.lengkap.id, over);
    const p = await reporter(fx);
    await p.call("POST", `/api/reviews/${x.id}/report`, { reason: "profanity" });
    const r2 = (await fx.h.t.d1
      .prepare("SELECT id FROM review_reports WHERE review_id = ?")
      .bind(x.id)
      .first()) as { id: string };
    return { ...x, reportId: r2.id };
  }

  it("upheld + hide_comment: komentar hilang dari publik, BINTANG tetap terhitung, nilai asli tersimpan", async () => {
    const fx = await liveHarness();
    const x = await reported(fx);
    const r = await fx.h.call("POST", `${E(fx)}/moderation/reports/${x.reportId}`, {
      decision: "upheld",
      action: "hide_comment",
      reason: REASON,
    });
    expect(r.status).toBe(200);
    expect(r.json.review).toMatchObject({
      commentStatus: "hidden",
      status: "visible",
      originalComment: "Mengecewakan",
    });
    expect(await publicList(fx, fx.s.lengkap.id)).toEqual([]);
    expect(await stat(fx, fx.s.lengkap.id)).toMatchObject({ review_count: 1, star_sum: 1 });
    const rep = (await fx.h.t.d1.prepare("SELECT * FROM review_reports").first()) as Record<
      string,
      unknown
    >;
    expect(rep).toMatchObject({ status: "upheld", decision_reason: REASON });
    expect(rep.decided_by).toBeTruthy();
    // keluar dari antrean
    expect((await fx.h.call("GET", `${E(fx)}/moderation/queue`)).json.reports).toEqual([]);
  });

  it("hide_review: seluruh review keluar dari statistik dan peringkat berubah", async () => {
    const fx = await liveHarness();
    const x = await reported(fx, { stars: 5, comment: "Mantap" });
    expect((await stat(fx, fx.s.lengkap.id)).review_count).toBe(1);
    await fx.h.call("POST", `${E(fx)}/moderation/reports/${x.reportId}`, {
      decision: "upheld",
      action: "hide_review",
      reason: REASON,
    });
    expect(await stat(fx, fx.s.lengkap.id)).toMatchObject({ review_count: 0, star_sum: 0, s5: 0 });
  });

  it("dismissed + kunci: tidak muncul lagi di antrean walau dilaporkan ulang", async () => {
    const fx = await liveHarness();
    const x = await reported(fx);
    await fx.h.call("POST", `${E(fx)}/moderation/reports/${x.reportId}`, {
      decision: "dismissed",
      lock: true,
      reason: REASON,
    });
    expect(await publicList(fx, fx.s.lengkap.id)).toHaveLength(1);
    const again = await reporter(fx);
    await again.call("POST", `/api/reviews/${x.id}/report`, { reason: "spam" });
    expect((await fx.h.call("GET", `${E(fx)}/moderation/queue`)).json.reports).toEqual([]);
  });

  it("keputusan berlaku untuk semua laporan terbuka pada komentar yang sama", async () => {
    const fx = await liveHarness();
    const x = await reported(fx);
    await (await reporter(fx)).call("POST", `/api/reviews/${x.id}/report`, { reason: "spam" });
    await fx.h.call("POST", `${E(fx)}/moderation/reports/${x.reportId}`, {
      decision: "dismissed",
      reason: REASON,
    });
    const open = (await fx.h.t.d1
      .prepare("SELECT COUNT(*) AS n FROM review_reports WHERE status = 'open'")
      .first()) as { n: number };
    expect(open.n).toBe(0);
  });

  it("alasan wajib (min. panjang) dan kolom asing ditolak; laporan tak dikenal 404", async () => {
    const fx = await liveHarness();
    const x = await reported(fx);
    const url = `${E(fx)}/moderation/reports/${x.reportId}`;
    expect((await fx.h.call("POST", url, { decision: "upheld" })).status).toBe(400);
    expect((await fx.h.call("POST", url, { decision: "upheld", reason: "x" })).status).toBe(400);
    expect(
      (await fx.h.call("POST", url, { decision: "upheld", reason: REASON, status: "hidden" }))
        .status,
    ).toBe(400);
    expect(
      (
        await fx.h.call("POST", `${E(fx)}/moderation/reports/tidak-ada`, {
          decision: "upheld",
          reason: REASON,
        })
      ).status,
    ).toBe(404);
    expect((await row(fx, x.id)).comment_status).toBe("visible"); // penolakan tidak mengubah apa pun
  });

  it("log keputusan memuat tindakan, bukan isi komentar", async () => {
    const fx = await liveHarness();
    const x = await reported(fx, { stars: 1, comment: "rahasia komentar" });
    const logs: string[] = [];
    const orig = console.log;
    console.log = (...a: unknown[]) => void logs.push(a.map(String).join(" "));
    try {
      await fx.h.call("POST", `${E(fx)}/moderation/reports/${x.reportId}`, {
        decision: "upheld",
        action: "hide_comment",
        reason: REASON,
      });
    } finally {
      console.log = orig;
    }
    const line = logs.find((l) => l.includes("moderation.report_decided")) ?? "";
    expect(line).toContain("hide_comment");
    expect(line).not.toContain("rahasia komentar");
  });
});

describe("status komentar, sunting, pulihkan, hapus", () => {
  it("PATCH comment: hidden/visible/held; 'masked' hanya bila ada bentuk tersamar; tanpa komentar ditolak", async () => {
    const fx = await liveHarness();
    const x = await make(fx, fx.s.lengkap.id, { stars: 3, comment: "komentar biasa" });
    const url = `${E(fx)}/reviews/${x.id}/comment`;
    expect(
      (await fx.h.call("PATCH", url, { commentStatus: "hidden", reason: REASON })).json.review
        .commentStatus,
    ).toBe("hidden");
    expect(await publicList(fx, fx.s.lengkap.id)).toEqual([]);
    expect(
      (await fx.h.call("PATCH", url, { commentStatus: "masked", reason: REASON })).json.code,
    ).toBe("validation_error");
    const back = await fx.h.call("PATCH", url, {
      commentStatus: "visible",
      lock: true,
      reason: REASON,
    });
    expect(back.json.review).toMatchObject({ commentStatus: "visible", commentLocked: true });
    expect(await publicList(fx, fx.s.lengkap.id)).toHaveLength(1);

    const star = await make(fx, fx.s.hanyaNama.id, { stars: 4 });
    expect(
      (
        await fx.h.call("PATCH", `${E(fx)}/reviews/${star.id}/comment`, {
          commentStatus: "hidden",
          reason: REASON,
        })
      ).json.code,
    ).toBe("validation_error");
  });

  it("menyunting bintang/komentar: nilai ASLI tersimpan sekali dan tidak pernah ditimpa; statistik mengikuti", async () => {
    const fx = await liveHarness();
    const x = await make(fx, fx.s.lengkap.id, { stars: 1, comment: "dasar bangsat" });
    expect((await row(fx, x.id)).comment_status).toBe("held");
    const first = await fx.h.call("PATCH", `${E(fx)}/reviews/${x.id}`, {
      stars: 3,
      comment: "Kurang ramah",
      reason: REASON,
    });
    expect(first.json.review).toMatchObject({
      stars: 3,
      comment: "Kurang ramah",
      commentStatus: "visible",
      originalStars: 1,
      originalComment: "dasar bangsat",
    });
    await fx.h.call("PATCH", `${E(fx)}/reviews/${x.id}`, { stars: 4, reason: REASON });
    const r = await row(fx, x.id);
    expect(r).toMatchObject({
      stars: 4,
      original_stars: 1,
      original_comment: "dasar bangsat",
      moderation_reason: REASON,
    });
    expect(await stat(fx, fx.s.lengkap.id)).toMatchObject({
      review_count: 1,
      star_sum: 4,
      s4: 1,
      s1: 0,
    });
    expect((await publicList(fx, fx.s.lengkap.id))[0]?.text).toBe("Kurang ramah"); // teks hasil sunting admin tayang apa adanya
  });

  it("status review: hidden mengeluarkan dari statistik; restore mengembalikan dan mengunci", async () => {
    const fx = await liveHarness();
    const x = await make(fx, fx.s.lengkap.id, { stars: 5, comment: "Mantap" });
    await fx.h.call("PATCH", `${E(fx)}/reviews/${x.id}`, { status: "hidden", reason: REASON });
    expect(await stat(fx, fx.s.lengkap.id)).toMatchObject({ review_count: 0, star_sum: 0 });
    expect(await publicList(fx, fx.s.lengkap.id)).toEqual([]);

    const r = await fx.h.call("POST", `${E(fx)}/reviews/${x.id}/restore`, { reason: REASON });
    expect(r.json.review).toMatchObject({
      status: "visible",
      commentStatus: "visible",
      commentLocked: true,
    });
    expect(await stat(fx, fx.s.lengkap.id)).toMatchObject({ review_count: 1, star_sum: 5 });
  });

  it("pengunjung tidak bisa melepas review yang disembunyikan admin dengan mengirim ulang", async () => {
    const fx = await liveHarness();
    const x = await make(fx, fx.s.lengkap.id, { stars: 5, comment: "Mantap" });
    await fx.h.call("PATCH", `${E(fx)}/reviews/${x.id}`, { status: "hidden", reason: REASON });
    await review(x.v, fx.s.lengkap.id, { stars: 5, comment: "Mantap lagi" });
    expect((await row(fx, x.id)).status).toBe("hidden");
    expect((await stat(fx, fx.s.lengkap.id)).review_count).toBe(0);
  });

  it("DELETE: alasan wajib; menghapus review + laporan; statistik dihitung ulang; id tak dikenal 404", async () => {
    const fx = await liveHarness();
    const x = await make(fx, fx.s.lengkap.id, { stars: 2, comment: "Biasa" });
    await (await reporter(fx)).call("POST", `/api/reviews/${x.id}/report`, { reason: "spam" });
    expect((await fx.h.call("DELETE", `${E(fx)}/reviews/${x.id}`)).status).toBe(400);
    const ok = await fx.h.call(
      "DELETE",
      `${E(fx)}/reviews/${x.id}?reason=${encodeURIComponent(REASON)}`,
    );
    expect(ok.status).toBe(200);
    expect(await row(fx, x.id)).toBeNull();
    expect(await stat(fx, fx.s.lengkap.id)).toMatchObject({ review_count: 0, star_sum: 0 });
    expect(
      (await fx.h.t.d1.prepare("SELECT COUNT(*) AS n FROM review_reports").first()) as {
        n: number;
      },
    ).toEqual({ n: 0 });
    expect(
      (await fx.h.call("DELETE", `${E(fx)}/reviews/tidak-ada?reason=${encodeURIComponent(REASON)}`))
        .status,
    ).toBe(404);
  });

  it("setiap perubahan admin menaikkan stats_version (cache snapshot berganti) dan hanya event ini", async () => {
    const fx = await liveHarness();
    const x = await make(fx, fx.s.lengkap.id, { stars: 5 });
    const v0 = (
      (await fx.h.t.d1
        .prepare("SELECT stats_version AS v FROM events WHERE id = ?")
        .bind(fx.s.event.id)
        .first()) as { v: number }
    ).v;
    await fx.h.call("PATCH", `${E(fx)}/reviews/${x.id}`, { stars: 4, reason: REASON });
    const v1 = (
      (await fx.h.t.d1
        .prepare("SELECT stats_version AS v FROM events WHERE id = ?")
        .bind(fx.s.event.id)
        .first()) as { v: number }
    ).v;
    expect(v1).toBe(v0 + 1);
  });

  it("admin tetap bisa memoderasi SETELAH event selesai (hanya admin yang boleh mengubah)", async () => {
    const fx = await liveHarness();
    const x = await make(fx, fx.s.lengkap.id, { stars: 5, comment: "Mantap" });
    fx.h.clk.t = 9_100_000_000_000;
    const r = await fx.h.call("PATCH", `${E(fx)}/reviews/${x.id}/comment`, {
      commentStatus: "hidden",
      reason: REASON,
    });
    expect(r.status).toBe(200);
  });

  it("review dari event lain tidak bisa disentuh lewat event ini", async () => {
    const fx = await liveHarness();
    const x = await make(fx, fx.s.lengkap.id, { stars: 5, comment: "Mantap" });
    const other = (
      await fx.h.call("POST", "/api/admin/events", {
        name: "Acara Lain",
        registrationCloseAt: 2000,
        eventStartAt: 3000,
        eventEndAt: 4000,
        registrationOpenAt: 1000,
      })
    ).json.event.id;
    const r = await fx.h.call("PATCH", `/api/admin/e/${other}/reviews/${x.id}`, {
      stars: 1,
      reason: REASON,
    });
    expect(r.status).toBe(404);
  });
});

describe("daftar review admin", () => {
  it("memuat SEMUA status dengan filter booth/bintang/status/komentar", async () => {
    const fx = await liveHarness();
    const a = await make(fx, fx.s.lengkap.id, { stars: 5, comment: "Mantap" });
    await make(fx, fx.s.lengkap.id, { stars: 1, comment: "dasar bangsat" });
    await make(fx, fx.s.hanyaNama.id, { stars: 3 });
    await fx.h.call("PATCH", `${E(fx)}/reviews/${a.id}`, { status: "hidden", reason: REASON });
    const all = (await fx.h.call("GET", `${E(fx)}/reviews`)).json.reviews;
    expect(all).toHaveLength(3);
    expect((await fx.h.call("GET", `${E(fx)}/reviews?status=hidden`)).json.reviews).toHaveLength(1);
    expect(
      (await fx.h.call("GET", `${E(fx)}/reviews?commentStatus=held`)).json.reviews,
    ).toHaveLength(1);
    expect(
      (await fx.h.call("GET", `${E(fx)}/reviews?boothId=${fx.s.hanyaNama.id}`)).json.reviews,
    ).toHaveLength(1);
    expect((await fx.h.call("GET", `${E(fx)}/reviews?stars=5`)).json.reviews).toHaveLength(1);
    expect((await fx.h.call("GET", `${E(fx)}/reviews?stars=9`)).status).toBe(400);
    expect(all[0].boothName).toBeTruthy();
  });
});

describe("daftar kata (A15, B25)", () => {
  it("dimuat dari daftar awal; admin menambah, menonaktifkan, dan mengecualikan tanpa deploy", async () => {
    const fx = await liveHarness();
    const list = (await fx.h.call("GET", `${E(fx)}/moderation/terms`)).json.terms as {
      term: string;
      kind: string;
      enabled: boolean;
      source: string;
    }[];
    expect(list.length).toBeGreaterThan(30);
    expect(list.some((t) => t.kind === "allow")).toBe(true);
    expect(list.every((t) => t.source === "starter")).toBe(true);

    const test = (text: string) => fx.h.call("POST", `${E(fx)}/moderation/test`, { text });
    expect((await test("tempat ini payah")).json.status).toBe("visible");
    await fx.h.call("PUT", `${E(fx)}/moderation/terms`, {
      terms: [{ term: "payah", severity: "mild" }],
      reason: REASON,
    });
    const masked = (await test("tempat ini payah")).json;
    expect(masked).toMatchObject({
      status: "masked",
      masked: "tempat ini p***h",
      matched: ["payah"],
    });

    // pengecualian menang atas blokir
    await fx.h.call("PUT", `${E(fx)}/moderation/terms`, {
      terms: [{ term: "payah", severity: "mild", kind: "allow" }],
      reason: REASON,
    });
    expect((await test("tempat ini payah")).json.status).toBe("visible");

    // nonaktifkan istilah bawaan
    await fx.h.call("PUT", `${E(fx)}/moderation/terms`, {
      terms: [{ term: "anjir", severity: "mild", enabled: false }],
      reason: REASON,
    });
    expect((await test("anjir")).json.status).toBe("visible");
  });

  it("'uji kalimat' melaporkan kontak dan istilah yang tertangkap (hanya untuk admin)", async () => {
    const fx = await liveHarness();
    const r = (
      await fx.h.call("POST", `${E(fx)}/moderation/test`, {
        text: "hubungi 081234567890 dasar bangsat",
      })
    ).json;
    expect(r).toMatchObject({ status: "held", contact: true });
    expect(r.matched).toContain("bangsat");
  });

  it("validasi: istilah terlalu pendek/panjang, kolom asing, alasan wajib", async () => {
    const fx = await liveHarness();
    const put = (body: unknown) => fx.h.call("PUT", `${E(fx)}/moderation/terms`, body);
    expect((await put({ terms: [{ term: "a", severity: "mild" }], reason: REASON })).status).toBe(
      400,
    );
    expect(
      (await put({ terms: [{ term: "x".repeat(41), severity: "mild" }], reason: REASON })).status,
    ).toBe(400);
    expect(
      (await put({ terms: [{ term: "oke", severity: "berat" }], reason: REASON })).status,
    ).toBe(400);
    expect(
      (await put({ terms: [{ term: "oke", severity: "mild", ekstra: 1 }], reason: REASON })).status,
    ).toBe(400);
    expect((await put({ terms: [{ term: "oke", severity: "mild" }] })).status).toBe(400);
  });

  it("log perubahan daftar memuat jumlah dan alasan, TIDAK memuat kata", async () => {
    const fx = await liveHarness();
    const logs: string[] = [];
    const orig = console.log;
    console.log = (...a: unknown[]) => void logs.push(a.map(String).join(" "));
    try {
      await fx.h.call("PUT", `${E(fx)}/moderation/terms`, {
        terms: [{ term: "katarahasia", severity: "mild" }],
        reason: REASON,
      });
    } finally {
      console.log = orig;
    }
    const line = logs.find((l) => l.includes("moderation.terms_changed")) ?? "";
    expect(line).toContain('"count":1');
    expect(line).not.toContain("katarahasia");
  });

  it("daftar per event: event lain mulai dari daftar awal sendiri", async () => {
    const fx = await liveHarness();
    await fx.h.call("PUT", `${E(fx)}/moderation/terms`, {
      terms: [{ term: "khusus", severity: "mild" }],
      reason: REASON,
    });
    const other = (
      await fx.h.call("POST", "/api/admin/events", {
        name: "Acara Lain",
        registrationOpenAt: 1000,
        registrationCloseAt: 2000,
        eventStartAt: 3000,
        eventEndAt: 4000,
      })
    ).json.event.id;
    const t = (await fx.h.call("GET", `/api/admin/e/${other}/moderation/terms`)).json.terms as {
      term: string;
    }[];
    expect(t.some((x) => x.term === "khusus")).toBe(false);
  });
});

describe("peringkat konsisten dengan review (Tahap 6: selesai bila)", () => {
  it("review masuk mengubah peringkat; yang ditahan/disembunyikan tidak; di bawah ambang tidak diperingkat", async () => {
    const fx = await liveHarness();
    const A = fx.s.lengkap.id;
    const B = fx.s.hanyaNama.id;

    const ranks = async () => {
      const rows = (
        await fx.h.t.d1
          .prepare("SELECT booth_id, review_count, star_sum, last_review_at FROM booth_stats")
          .all()
      ).results as {
        booth_id: string;
        review_count: number;
        star_sum: number;
        last_review_at: number | null;
      }[];
      return rankBooths(
        rows.map((r) => ({
          boothId: r.booth_id,
          reviewCount: r.review_count,
          starSum: r.star_sum,
          lastReviewAt: r.last_review_at,
        })),
        {
          priorWeight: CONFIG.ranking.bayesPriorWeight,
          minReviewsToRank: CONFIG.ranking.minReviewsToRank,
        },
      ).map((r) => r.boothId);
    };

    expect(await ranks()).toEqual([]); // belum ada review
    const ids: Record<string, string[]> = { A: [], B: [] };
    for (let i = 0; i < CONFIG.ranking.minReviewsToRank; i++) {
      ids.A?.push((await make(fx, A, { stars: 5 })).id);
      ids.B?.push((await make(fx, B, { stars: 3 })).id);
      fx.h.clk.t += 1000;
    }
    expect(await ranks()).toEqual([A, B]);

    // Menyembunyikan satu review A menurunkannya di bawah ambang: A keluar dari peringkat.
    await fx.h.call("PATCH", `${E(fx)}/reviews/${ids.A?.[0]}`, {
      status: "hidden",
      reason: REASON,
    });
    expect(await ranks()).toEqual([B]);
    await fx.h.call("POST", `${E(fx)}/reviews/${ids.A?.[0]}/restore`, { reason: REASON });
    expect(await ranks()).toEqual([A, B]);

    // Menyunting bintang A menjadi rendah membalik urutan.
    for (const id of ids.A ?? [])
      await fx.h.call("PATCH", `${E(fx)}/reviews/${id}`, { stars: 1, reason: REASON });
    expect(await ranks()).toEqual([B, A]);
  });
});
