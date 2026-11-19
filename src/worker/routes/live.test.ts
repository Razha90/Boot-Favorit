import { CONFIG } from "@shared/config";
import { LiveCore } from "@shared/live-core";
import { describe, expect, it, vi } from "vitest";
import { getDb } from "../lib/db";
import { loadLiveInput } from "../services/live";
import { directVisitor, liveHarness, review, visitorClient } from "../test/visitor";

/** Namespace DO palsu: mencatat panggilan `ingest` dan `fetch`. */
function fakeHub() {
  const ingest = vi.fn(async () => {});
  const fetchHub = vi.fn(async (_req: Request) => new Response("diteruskan"));
  const ns = {
    idFromName: (n: string) => n,
    get: (_id: string) => ({ ingest, fetch: fetchHub }),
  };
  return { ns: ns as unknown as DurableObjectNamespace, ingest, fetchHub };
}
const withHub = (ns: DurableObjectNamespace) => ({ LIVE_HUB: ns }) as unknown as Partial<Env>;

describe("GET /ws", () => {
  const ws = { headers: { Upgrade: "websocket" } };

  it("tanpa Upgrade: 426; tanpa binding DO: galat konfigurasi (bukan diam-diam)", async () => {
    const { h } = await liveHarness();
    const v = visitorClient(h);
    expect((await v.call("GET", "/ws")).status).toBe(426);
    expect((await v.call("GET", "/ws", undefined, ws)).status).toBe(500);
  });

  it("meneruskan ke DO event aktif dengan header buatan SERVER (nilai dari klien ditimpa)", async () => {
    const { h, s } = await liveHarness();
    const hub = fakeHub();
    const r = await visitorClient(h).call("GET", "/ws?screen=1", undefined, {
      headers: { Upgrade: "websocket", "x-event-id": "palsu", "x-live-screen": "0" },
      env: withHub(hub.ns),
    });
    expect(r.status).toBe(200);
    const req = hub.fetchHub.mock.calls[0]?.[0] as Request;
    expect(req.headers.get("x-event-id")).toBe(s.event.id);
    expect(req.headers.get("x-live-screen")).toBe("1");
    expect(Number(req.headers.get("x-event-end") ?? 0)).toBeGreaterThan(0);
  });

  it("tanpa ?screen=1 dianggap penonton biasa", async () => {
    const { h } = await liveHarness();
    const hub = fakeHub();
    await visitorClient(h).call("GET", "/ws", undefined, { ...ws, env: withHub(hub.ns) });
    const forwarded = hub.fetchHub.mock.calls[0]?.[0] as Request;
    expect(forwarded.headers.get("x-live-screen")).toBe("0");
  });

  it("event selesai: 403 event_ended (tidak ada siaran); event disembunyikan: 404", async () => {
    const { h, s } = await liveHarness();
    const hub = fakeHub();
    const call = () =>
      visitorClient(h).call("GET", "/ws", undefined, { ...ws, env: withHub(hub.ns) });
    await s.setEvent({ hiddenFromPublic: 1 });
    expect((await call()).status).toBe(404);
    await s.setEvent({ hiddenFromPublic: 0 });
    h.clk.t = 9_000_000_000_001;
    const ended = await call();
    expect(ended.status).toBe(403);
    expect(ended.json.code).toBe("event_ended");
    expect(hub.fetchHub).not.toHaveBeenCalled();
  });

  it("Layar Besar tetap boleh tersambung setelah event selesai (menerima refresh saat animasi pemenang diputar)", async () => {
    const { h } = await liveHarness();
    const hub = fakeHub();
    h.clk.t = 9_000_000_000_001;
    const r = await visitorClient(h).call("GET", "/ws?screen=1", undefined, {
      ...ws,
      env: withHub(hub.ns),
    });
    expect(r.status).toBe(200);
    expect(hub.fetchHub).toHaveBeenCalledTimes(1);
  });
});

describe("notifikasi ke LiveHub", () => {
  it("review masuk → ingest('review') dengan id event dan waktu selesai", async () => {
    const { h, s } = await liveHarness();
    const hub = fakeHub();
    const v = await directVisitor(h, s.event.id);
    const r = await v.call(
      "POST",
      `/api/booths/${s.lengkap.id}/review`,
      { stars: 5, comment: "Seru" },
      { env: withHub(hub.ns) },
    );
    expect(r.status).toBe(201);
    await vi.waitFor(() => expect(hub.ingest).toHaveBeenCalledTimes(1));
    expect(hub.ingest).toHaveBeenCalledWith(s.event.id, "review", 9_000_000_000_000);
  });

  it("aksi admin yang berhasil → ingest('refresh'); GET dan yang gagal tidak", async () => {
    const { h, s } = await liveHarness();
    const hub = fakeHub();
    const env = withHub(hub.ns);
    await h.call("GET", `/api/admin/e/${s.event.id}/results`, undefined, { extraEnv: env });
    await h.call(
      "PUT",
      `/api/admin/events/${s.event.id}/ranking-mode`,
      { mode: "rahasia" },
      { extraEnv: env },
    ); // 400
    expect(hub.ingest).not.toHaveBeenCalled();
    await h.call(
      "PUT",
      `/api/admin/events/${s.event.id}/ranking-mode`,
      { mode: "hidden" },
      { extraEnv: env },
    );
    await vi.waitFor(() => expect(hub.ingest).toHaveBeenCalledTimes(1));
    expect(hub.ingest).toHaveBeenCalledWith(s.event.id, "refresh", 9_000_000_000_000);
  });

  it("DO gagal: permintaan tetap sukses (siaran hanya pelengkap)", async () => {
    const { h, s } = await liveHarness();
    const bad = {
      idFromName: (n: string) => n,
      get: () => ({
        ingest: async () => {
          throw new Error("DO mati");
        },
      }),
    };
    const v = await directVisitor(h, s.event.id);
    const r = await v.call(
      "POST",
      `/api/booths/${s.lengkap.id}/review`,
      { stars: 4, comment: "Oke" },
      { env: withHub(bad as unknown as DurableObjectNamespace) },
    );
    expect(r.status).toBe(201);
    expect(
      ((await h.t.d1.prepare("SELECT COUNT(*) AS n FROM reviews").first()) as { n: number }).n,
    ).toBe(1);
  });

  it("tanpa binding (bawaan tes/dev tanpa DO): tidak ada efek dan tidak ada galat", async () => {
    const { h, s } = await liveHarness();
    const v = await directVisitor(h, s.event.id);
    expect((await review(v, s.lengkap.id, { stars: 4 })).status).toBe(201);
  });
});

describe("loadLiveInput + LiveCore (data nyata dari D1)", () => {
  it("memuat statistik booth tayang, feed, dan visibilitas; tick pertama memuat booth yang punya ulasan", async () => {
    const { h, s } = await liveHarness();
    for (let i = 0; i < 3; i++) {
      const v = await directVisitor(h, s.event.id, { name: `T${i}` });
      await review(v, s.lengkap.id, { stars: 5, comment: `mantap ${i}` });
    }
    const src = await loadLiveInput(getDb(h.env()), s.event.id, 3, h.clk.now());
    expect(src?.ended).toBe(false);
    expect(src?.live.booths.map((b) => b.id)).not.toContain(s.pending.id); // belum tayang: tidak ikut
    expect(src?.live.feed).toHaveLength(3);
    const core = new LiveCore({
      maxFeedItemsPerTick: CONFIG.live.maxFeedItemsPerTick,
      ranking: {
        priorWeight: CONFIG.ranking.bayesPriorWeight,
        minReviewsToRank: CONFIG.ranking.minReviewsToRank,
      },
    });
    if (!src) throw new Error("sumber live kosong");
    const tick = core.tick(src.live);
    expect(tick?.booths).toEqual([{ id: s.lengkap.id, count: 3, avg: 5 }]);
    expect(tick?.ranks?.[0]?.boothId).toBe(s.lengkap.id);
    expect(tick?.feed).toHaveLength(3);
  });

  it("peringkat/rating tersembunyi di D1 → LiveInput menandainya sehingga tidak ada yang disiarkan", async () => {
    const { h, s } = await liveHarness();
    await s.setEvent({ ratingsMode: "hidden" });
    const src = await loadLiveInput(getDb(h.env()), s.event.id, 0, h.clk.now());
    expect(src?.live).toMatchObject({ ratingsVisible: false, rankingVisible: false });
  });

  it("event selesai → ended; event tidak ada → null", async () => {
    const { h, s } = await liveHarness();
    expect((await loadLiveInput(getDb(h.env()), s.event.id, 0, 9_100_000_000_000))?.ended).toBe(
      true,
    );
    expect(await loadLiveInput(getDb(h.env()), "tidak-ada", 0, 1)).toBeNull();
  });
});
