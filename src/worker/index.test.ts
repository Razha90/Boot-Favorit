import { describe, expect, it } from "vitest";
import { createApp } from "./index";
import { clock, testEnv } from "./test/app";
import { createTestDb } from "./test/d1";
import { insertEvent, TIMES } from "./test/fixtures";

const published = { isActive: 1, visibility: "published" } as const;

function setup(now = 1500) {
  const t = createTestDb();
  const clk = clock(now);
  const app = createApp({ now: clk.now });
  const get = (path: string) => app.request(path, {}, testEnv(t));
  return { t, clk, app, get };
}

describe("aplikasi", () => {
  it("menjawab /api/health tanpa menyentuh database", async () => {
    const app = createApp();
    // Env tanpa DB: health tidak boleh bergantung padanya.
    const res = await app.request("/api/health", {}, { APP_ENV: "development" } as Env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, env: "development" });
  });

  it("menyertakan X-Request-Id di setiap jawaban", async () => {
    const { get } = setup();
    const res = await get("/api/health");
    expect(res.headers.get("X-Request-Id")).toBeTruthy();
  });

  it("rute /api yang belum ada menjawab 404 JSON, bukan SPA", async () => {
    const { get } = setup();
    const res = await get("/api/tidak-ada");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ code: "not_found" });
  });
});

describe("GET /api/event", () => {
  it("tanpa event aktif: event null + serverNow", async () => {
    const { get } = setup(1234);
    const res = await get("/api/event");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ event: null, serverNow: 1234 });
  });

  it("event draft, tidak terbit, atau disembunyikan admin tidak tampil ke publik", async () => {
    for (const over of [
      { isActive: 1, visibility: "draft" },
      { isActive: 1, visibility: "published", hiddenFromPublic: 1 },
    ] as const) {
      const { t, get } = setup();
      await insertEvent(t, over);
      const body = (await (await get("/api/event")).json()) as { event: unknown };
      expect(body.event).toBeNull();
    }
  });

  it("event aktif: nama, jadwal, status terhitung, versi cache, dan kategori ulasan aktif", async () => {
    const { t, get } = setup(1500);
    const e = await insertEvent(t, { ...published, name: "Expo 2026", ratingsMode: "hidden" });
    const cat = (id: string, label: string, position: number, active = 1) => ({
      id,
      eventId: e.id,
      label,
      position,
      active,
      createdAt: 1,
      updatedAt: 1,
    });
    const { reviewCategories } = await import("./db/schema");
    await t.db
      .insert(reviewCategories)
      .values([cat("c2", "Ramah", 2), cat("c1", "Seru", 1), cat("c3", "Lama", 3, 0)]);

    const res = await get("/api/event");
    expect(res.headers.get("Cache-Control")).toMatch(/s-maxage=\d+/);
    const body = (await res.json()) as {
      serverNow: number;
      event: {
        name: string;
        ratingsMode: string;
        schedule: Record<string, unknown>;
        state: { phase: string; registrationButtonVisible: boolean; votingOpen: boolean };
        reviewCategories: { id: string; label: string }[];
        versions: Record<string, number>;
      };
    };
    expect(body.serverNow).toBe(1500);
    expect(body.event.name).toBe("Expo 2026");
    expect(body.event.ratingsMode).toBe("hidden");
    expect(body.event.schedule).toMatchObject(TIMES);
    // Waktu 1500: pendaftaran reguler dibuka, event belum mulai.
    expect(body.event.state).toMatchObject({
      phase: "upcoming",
      registrationButtonVisible: true,
      votingOpen: false,
    });
    expect(body.event.reviewCategories).toEqual([
      { id: "c1", label: "Seru" },
      { id: "c2", label: "Ramah" },
    ]);
    expect(body.event.versions).toEqual({ active: 0, stats: 0, results: 0 });
  });

  it("status mengikuti jam server: event live lalu selesai", async () => {
    const { t, clk, get } = setup(3500);
    await insertEvent(t, published);
    const phase = async () =>
      ((await (await get("/api/event")).json()) as { event: { state: { phase: string } } }).event
        .state.phase;
    expect(await phase()).toBe("live");
    clk.t = 4000;
    expect(await phase()).toBe("ended");
  });

  it("pengaturan allowLateRegistration per-event memengaruhi status pendaftaran", async () => {
    const { t, get } = setup(2500);
    await insertEvent(t, {
      ...published,
      settingsJson: JSON.stringify({ allowLateRegistration: false }),
    });
    const body = (await (await get("/api/event")).json()) as {
      event: { state: { registrationAccepting: boolean } };
    };
    expect(body.event.state.registrationAccepting).toBe(false);
  });

  it("settings_json rusak tidak menjatuhkan endpoint (kembali ke default)", async () => {
    const { t, get } = setup(2500);
    await insertEvent(t, { ...published, settingsJson: "{bukan json" });
    const res = await get("/api/event");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { event: { state: { registrationAccepting: boolean } } };
    expect(body.event.state.registrationAccepting).toBe(true); // default: susulan diizinkan
  });
});
