import { CONFIG } from "@shared/config";
import { afterEach, describe, expect, it, vi } from "vitest";
import { directVisitor, liveHarness, review, visitorClient } from "../../test/visitor";

type Fx = Awaited<ReturnType<typeof liveHarness>>;
const E = (fx: Fx) => `/api/admin/events/${fx.s.event.id}`;
const snap = async (fx: Fx) => (await visitorClient(fx.h).call("GET", "/api/snapshot")).json;
const results = async (fx: Fx) => (await visitorClient(fx.h).call("GET", "/api/results")).json;
const REASON = "alasan uji";

afterEach(() => vi.unstubAllGlobals());

/** n review dari pengunjung berbeda. */
async function rate(fx: Fx, boothId: string, stars: number, n: number, comment?: string) {
  for (let i = 0; i < n; i++) {
    const v = await directVisitor(fx.h, fx.s.event.id, { name: `Tamu${i}` });
    const r = await review(v, boothId, {
      stars,
      ...(comment ? { comment: `${comment} ${i}` } : {}),
    });
    expect(r.status).toBe(201);
    fx.h.clk.t += 100;
  }
}

/** Event berakhir: jendela dipendekkan lalu jam dimajukan. */
async function endEvent(fx: Fx) {
  await fx.h.t.d1.exec("UPDATE events SET event_end_at = 10000");
  fx.h.clk.t = 20_000;
}

describe("peringkat di snapshot", () => {
  it("memuat peringkat Bayesian; booth di bawah ambang ulasan tidak diperingkat", async () => {
    const fx = await liveHarness();
    await rate(fx, fx.s.lengkap.id, 5, CONFIG.ranking.minReviewsToRank);
    await rate(fx, fx.s.hanyaNama.id, 3, CONFIG.ranking.minReviewsToRank - 1);
    const s = await snap(fx);
    expect(s.ranking.map((r: { boothId: string }) => r.boothId)).toEqual([fx.s.lengkap.id]);
    expect(s.ranking[0]).toMatchObject({
      rank: 1,
      average: 5,
      reviewCount: CONFIG.ranking.minReviewsToRank,
    });
    expect(s.ranking[0].score).toBeGreaterThan(0);
  });

  it("ranking_mode 'hidden': peringkat TIDAK dikirim sama sekali (null), rating tetap", async () => {
    const fx = await liveHarness();
    await rate(fx, fx.s.lengkap.id, 5, 3);
    await fx.h.call("PUT", `${E(fx)}/ranking-mode`, { mode: "hidden" });
    const s = await snap(fx);
    expect(s.ranking).toBeNull();
    expect(JSON.stringify(s)).not.toContain('"score"');
    expect(s.booths.find((b: { id: string }) => b.id === fx.s.lengkap.id).ratingAverage).toBe(5);
  });

  it("ratings_mode 'hidden': tidak ada rating, jumlah, skor, atau peringkat di mana pun di snapshot", async () => {
    const fx = await liveHarness();
    await rate(fx, fx.s.lengkap.id, 5, 3, "Mantap sekali");
    await fx.h.call("PUT", `${E(fx)}/ratings-mode`, { mode: "hidden" });
    const s = await snap(fx);
    expect(s.ratingsHidden).toBe(true);
    expect(s.ranking).toBeNull();
    expect(s.stats).toMatchObject({ reviewCount: 0, average: null });
    expect(s.feed[0].stars).toBeNull(); // ulasan tetap tampil, bintangnya tidak
    expect(JSON.stringify(s)).not.toMatch(/"score"|"ratingAverage":\d|"ratingCount":[1-9]/);
  });

  it("on_results: tersembunyi sampai diumumkan, lalu tampil", async () => {
    const fx = await liveHarness();
    await rate(fx, fx.s.lengkap.id, 5, 3);
    await fx.h.call("PUT", `${E(fx)}/ratings-mode`, { mode: "on_results" });
    await fx.h.call("PUT", `${E(fx)}/ranking-mode`, { mode: "on_results" });
    expect((await snap(fx)).ranking).toBeNull();
    await endEvent(fx);
    expect((await fx.h.call("POST", `${E(fx)}/publish-results`)).status).toBe(200);
    const s = await snap(fx);
    expect(s.ranking).toHaveLength(1);
    expect(s.ratingsHidden).toBe(false);
  });

  it("peringkat 'visible' ditolak (400) selagi rating 'hidden'; kolom asing dan mode tak dikenal ditolak", async () => {
    const fx = await liveHarness();
    await fx.h.call("PUT", `${E(fx)}/ratings-mode`, { mode: "hidden" });
    expect(
      (await fx.h.call("PUT", `${E(fx)}/ranking-mode`, { mode: "visible" })).json.message,
    ).toBe("ratings_hidden");
    expect((await fx.h.call("PUT", `${E(fx)}/ranking-mode`, { mode: "hidden" })).status).toBe(200);
    expect((await fx.h.call("PUT", `${E(fx)}/ranking-mode`, { mode: "rahasia" })).status).toBe(400);
    expect((await fx.h.call("PUT", `${E(fx)}/ranking-mode`, { mode: "hidden", x: 1 })).status).toBe(
      400,
    );
  });

  it("mengubah mode menaikkan stats_version (kunci cache berganti) dan memerlukan kunci idempotensi", async () => {
    const fx = await liveHarness();
    const v = async () =>
      ((await fx.h.t.d1.prepare("SELECT stats_version AS v FROM events").first()) as { v: number })
        .v;
    const before = await v();
    await fx.h.call("PUT", `${E(fx)}/ratings-mode`, { mode: "hidden" });
    expect(await v()).toBe(before + 1);
    const noKey = await fx.h.call(
      "PUT",
      `${E(fx)}/ratings-mode`,
      { mode: "visible" },
      { key: false },
    );
    expect(noKey.json.code).toBe("idempotency_key_required");
  });
});

describe("ulasan terbaru (feed)", () => {
  it("terbaru dulu, maksimal 5; komentar ditahan/disembunyikan dan booth belum tayang tidak ada", async () => {
    const fx = await liveHarness();
    for (let i = 0; i < 7; i++) await rate(fx, fx.s.lengkap.id, 4, 1, `ulasan nomor ${i}`);
    await rate(fx, fx.s.hanyaNama.id, 1, 1, "dasar bangsat");
    const s = await snap(fx);
    expect(s.feed).toHaveLength(5);
    expect(s.feed[0].text).toBe("ulasan nomor 6 0");
    expect(s.feed.map((f: { text: string }) => f.text)).not.toContain("dasar bangsat");
    expect(JSON.stringify(s)).not.toContain("bangsat");
    expect(s.feed[0]).toMatchObject({
      boothId: fx.s.lengkap.id,
      boothName: "Kopi Rempah",
      displayName: "Tamu0",
    });
  });

  it("komentar panjang dipotong ±140 huruf; yang disamarkan tampil tersamar", async () => {
    const fx = await liveHarness();
    await rate(fx, fx.s.lengkap.id, 4, 1, "x".repeat(270)); // batas komentar 280 huruf
    await rate(fx, fx.s.lengkap.id, 4, 1, "antrean anjir lama");
    const s = await snap(fx);
    expect(s.feed[0].text).toBe("antrean a***r lama 0");
    expect(s.feed[1].text.length).toBeLessThanOrEqual(140);
    expect(s.feed[1].text.endsWith("…")).toBe(true);
  });

  it("tanpa ulasan: daftar kosong (bukan galat)", async () => {
    const fx = await liveHarness();
    expect((await snap(fx)).feed).toEqual([]);
  });
});

describe("umumkan hasil, perbarui, dan reveal", () => {
  it("belum selesai: 409; setelah selesai: hasil dibekukan untuk SELURUH booth; rating+peringkat jadi tampil", async () => {
    const fx = await liveHarness();
    await rate(fx, fx.s.lengkap.id, 5, 3, "Mantap");
    await rate(fx, fx.s.hanyaNama.id, 2, 1);
    await fx.h.call("PUT", `${E(fx)}/ratings-mode`, { mode: "hidden" });

    expect((await fx.h.call("POST", `${E(fx)}/publish-results`)).json.message).toBe(
      "event_not_ended",
    );
    expect((await results(fx)).published).toBe(false);
    expect((await results(fx)).results).toBeNull();

    await endEvent(fx);
    const pub = await fx.h.call("POST", `${E(fx)}/publish-results`);
    expect(pub.status).toBe(200);
    expect(pub.json.booths).toBe(2);

    const r = await results(fx);
    expect(r).toMatchObject({ published: true, version: 1 });
    expect(
      r.results.map((x: { boothId: string; rank: number | null }) => [x.boothId, x.rank]),
    ).toEqual([
      [fx.s.lengkap.id, 1],
      [fx.s.hanyaNama.id, null], // belum cukup ulasan, tetap tercantum
    ]);
    expect(r.results[0]).toMatchObject({ average: 5, reviewCount: 3, name: "Kopi Rempah" });
    const row = (await fx.h.t.d1
      .prepare("SELECT ratings_mode, ranking_mode FROM events")
      .first()) as Record<string, string>;
    expect(row).toEqual({ ratings_mode: "visible", ranking_mode: "visible" });
    expect((await snap(fx)).ranking).toHaveLength(1);
  });

  it("diumumkan dua kali ditolak; perbarui sebelum diumumkan ditolak", async () => {
    const fx = await liveHarness();
    await endEvent(fx);
    expect((await fx.h.call("POST", `${E(fx)}/refresh-results`)).json.message).toBe(
      "results_not_published",
    );
    await fx.h.call("POST", `${E(fx)}/publish-results`);
    expect((await fx.h.call("POST", `${E(fx)}/publish-results`)).json.message).toBe(
      "already_published",
    );
  });

  it("hasil DIBEKUKAN: menyunting review sesudahnya tidak mengubahnya; admin diberi tanda 'berbeda' sampai diperbarui", async () => {
    const fx = await liveHarness();
    await rate(fx, fx.s.lengkap.id, 5, 3);
    await endEvent(fx);
    await fx.h.call("POST", `${E(fx)}/publish-results`);
    const rid = (
      (await fx.h.t.d1.prepare("SELECT id FROM reviews LIMIT 1").first()) as { id: string }
    ).id;
    await fx.h.call("PATCH", `/api/admin/e/${fx.s.event.id}/reviews/${rid}`, {
      stars: 1,
      reason: REASON,
    });

    expect((await results(fx)).results[0]).toMatchObject({ average: 5 }); // beku
    const admin = (await fx.h.call("GET", `/api/admin/e/${fx.s.event.id}/results`)).json;
    expect(admin.differs).toBe(true);
    expect(admin.live[0].average).toBeCloseTo(11 / 3, 5);

    expect((await fx.h.call("POST", `${E(fx)}/refresh-results`)).status).toBe(200);
    const after = await results(fx);
    expect(after.version).toBe(2);
    expect(after.results[0].average).toBeCloseTo(11 / 3, 5);
    expect((await fx.h.call("GET", `/api/admin/e/${fx.s.event.id}/results`)).json.differs).toBe(
      false,
    );
  });

  it("reveal: butuh hasil diumumkan; menaikkan seq, mengisi waktu dan target; mode rating/peringkat tidak berubah", async () => {
    const fx = await liveHarness();
    await endEvent(fx);
    expect((await fx.h.call("POST", `${E(fx)}/reveal`, { target: "screen" })).json.message).toBe(
      "results_not_published",
    );
    await fx.h.call("POST", `${E(fx)}/publish-results`);
    expect((await snap(fx)).reveal).toBeNull();

    fx.h.clk.t = 30_000;
    expect((await fx.h.call("POST", `${E(fx)}/reveal`, { target: "everyone" })).status).toBe(200);
    expect((await snap(fx)).reveal).toEqual({ seq: 1, startedAt: 30_000, target: "everyone" });
    fx.h.clk.t = 31_000;
    await fx.h.call("POST", `${E(fx)}/reveal`, { target: "screen" });
    expect((await snap(fx)).reveal).toEqual({ seq: 2, startedAt: 31_000, target: "screen" });
    expect((await fx.h.call("POST", `${E(fx)}/reveal`, { target: "semua" })).status).toBe(400);
  });

  it("aksi admin tercatat di log (tanpa isi hasil)", async () => {
    const fx = await liveHarness();
    await endEvent(fx);
    const logs: string[] = [];
    const orig = console.log;
    console.log = (...a: unknown[]) => void logs.push(a.map(String).join(" "));
    try {
      await fx.h.call("POST", `${E(fx)}/publish-results`);
      await fx.h.call("POST", `${E(fx)}/reveal`, { target: "screen" });
    } finally {
      console.log = orig;
    }
    expect(logs.some((l) => l.includes("admin.results_published"))).toBe(true);
    expect(logs.some((l) => l.includes("admin.reveal_played"))).toBe(true);
  });

  it("endpoint hasil tertutup bagi non-admin", async () => {
    const fx = await liveHarness();
    const r = await visitorClient(fx.h).call("POST", `${E(fx)}/publish-results`, undefined, {
      env: { APP_ENV: "production", DEV_ADMIN_EMAIL: undefined } as unknown as Partial<Env>,
    });
    expect(r.status).toBe(401);
  });
});

describe("Cache API pada rute publik", () => {
  function install() {
    const store = new Map<string, Response>();
    vi.stubGlobal("caches", {
      default: {
        match: async (r: Request) => store.get(r.url)?.clone(),
        put: async (r: Request, res: Response) => void store.set(r.url, res.clone()),
      },
    });
    return store;
  }

  it("snapshot dilayani dari cache selama versi sama; perubahan admin (stats_version) langsung terlihat", async () => {
    const fx = await liveHarness();
    install();
    await rate(fx, fx.s.lengkap.id, 5, 1);
    const first = await visitorClient(fx.h).call("GET", "/api/snapshot");
    expect(first.res.headers.get("x-cache")).toBe("MISS");

    await rate(fx, fx.s.lengkap.id, 1, 1); // review baru TIDAK menaikkan stats_version → tampil setelah TTL
    const cached = await visitorClient(fx.h).call("GET", "/api/snapshot");
    expect(cached.res.headers.get("x-cache")).toBe("HIT");
    expect(cached.json.stats.reviewCount).toBe(1);

    await fx.h.call("PUT", `${E(fx)}/ratings-mode`, { mode: "visible" }); // aksi admin → kunci berganti
    const fresh = await visitorClient(fx.h).call("GET", "/api/snapshot");
    expect(fresh.res.headers.get("x-cache")).toBe("MISS");
    expect(fresh.json.stats.reviewCount).toBe(2);
  });

  it("ETag: polling tanpa perubahan mendapat 304; TTL sesuai fase (live 5 dtk, selesai 60 dtk)", async () => {
    const fx = await liveHarness();
    install();
    const a = await visitorClient(fx.h).call("GET", "/api/snapshot");
    expect(a.res.headers.get("cache-control")).toBe(
      `public, s-maxage=${CONFIG.live.snapshotTtlSec}`,
    );
    const etag = a.res.headers.get("etag") ?? "";
    const b = await visitorClient(fx.h).call("GET", "/api/snapshot", undefined, {
      headers: { "If-None-Match": etag },
    });
    expect(b.status).toBe(304);
    await endEvent(fx);
    const c = await visitorClient(fx.h).call("GET", "/api/snapshot");
    expect(c.res.headers.get("cache-control")).toBe(
      `public, s-maxage=${CONFIG.live.snapshotTtlSecAfterEnd}`,
    );
  });

  it("data yang disembunyikan tidak pernah masuk cache: snapshot di-cache SETELAH dipangkas", async () => {
    const fx = await liveHarness();
    const store = install();
    await rate(fx, fx.s.lengkap.id, 5, 3);
    await fx.h.call("PUT", `${E(fx)}/ratings-mode`, { mode: "hidden" });
    await visitorClient(fx.h).call("GET", "/api/snapshot");
    const body = await [...store.values()][0]?.text();
    expect(body).toContain('"ranking":null');
    expect(body).not.toMatch(/"score"/);
  });

  it("booth tidak ada (404) tidak di-cache", async () => {
    const fx = await liveHarness();
    const store = install();
    expect((await visitorClient(fx.h).call("GET", "/api/booths/tidak-ada")).status).toBe(404);
    expect(store.size).toBe(0);
  });
});
