import { describe, expect, it } from "vitest";
import { createApp } from "../index";
import { clock, miniApp, testEnv } from "../test/app";
import { createTestDb } from "../test/d1";
import { insertEvent } from "../test/fixtures";
import {
  eventWriteGate,
  FROZEN_ALLOWLIST,
  loadActiveEvent,
  requireRegistrationAccepting,
  requireVotingOpen,
} from "./event-gate";

// Garis waktu fixture: daftar buka 1000, tutup 2000, event mulai 3000, selesai 4000.
const BEFORE_OPEN = 500;
const REGULAR = 1500;
const LATE = 2500;
const LIVE = 3500;
const ENDED = 4000;

const published = { isActive: 1, visibility: "published" } as const;

function gated() {
  const t = createTestDb();
  const clk = clock(REGULAR);
  const app = miniApp(clk.now);
  app.use("/api/*", loadActiveEvent, eventWriteGate);
  const ok = (c: { json: (b: unknown) => Response }) => c.json({ ok: true });
  app.get("/api/things", ok);
  app.post("/api/reviews", ok);
  app.put("/api/booth/me", ok);
  app.post("/api/booth/otp/request", ok);
  app.post("/api/booth/otp/verify", ok);
  app.post("/api/booth/logout", ok);
  app.post("/api/admin/events", ok);
  app.delete("/api/admin/e/1/reviews/2", ok);
  const call = (method: string, path: string) => app.request(path, { method }, testEnv(t));
  return { t, clk, call };
}

describe("eventWriteGate", () => {
  it("tanpa event aktif: aksi tulis ditolak no_active_event, baca tetap boleh", async () => {
    const { call } = gated();
    const res = await call("POST", "/api/reviews");
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ code: "no_active_event" });
    expect((await call("GET", "/api/things")).status).toBe(200);
  });

  it("sebelum dan selama event: aksi tulis lolos gerbang", async () => {
    const { t, clk, call } = gated();
    await insertEvent(t, published);
    for (const time of [BEFORE_OPEN, REGULAR, LATE, LIVE]) {
      clk.t = time;
      expect((await call("POST", "/api/reviews")).status, `t=${time}`).toBe(200);
      expect((await call("PUT", "/api/booth/me")).status, `t=${time}`).toBe(200);
    }
  });

  it("event selesai: semua aksi tulis non-admin ditolak 403 event_ended", async () => {
    const { t, clk, call } = gated();
    await insertEvent(t, published);
    clk.t = ENDED;
    for (const [method, path] of [
      ["POST", "/api/reviews"],
      ["PUT", "/api/booth/me"],
    ] as const) {
      const res = await call(method, path);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ code: "event_ended" });
    }
  });

  it("event selesai: membaca tetap boleh", async () => {
    const { t, clk, call } = gated();
    await insertEvent(t, published);
    clk.t = ENDED;
    expect((await call("GET", "/api/things")).status).toBe(200);
  });

  it("event selesai: hanya allowlist eksplisit (login OTP booth, logout) yang lolos", async () => {
    const { t, clk, call } = gated();
    await insertEvent(t, published);
    clk.t = ENDED;
    for (const route of FROZEN_ALLOWLIST) {
      const [method, path] = route.split(" ") as [string, string];
      expect((await call(method, path)).status, route).toBe(200);
    }
  });

  it("admin tidak pernah dibekukan", async () => {
    const { t, clk, call } = gated();
    await insertEvent(t, published);
    clk.t = ENDED;
    expect((await call("POST", "/api/admin/events")).status).toBe(200);
    expect((await call("DELETE", "/api/admin/e/1/reviews/2")).status).toBe(200);
  });

  it("membuka kembali event (memundurkan eventEnd) mengaktifkan lagi aksi tulis", async () => {
    const { t, clk, call } = gated();
    const e = await insertEvent(t, published);
    clk.t = ENDED + 500;
    expect((await call("POST", "/api/reviews")).status).toBe(403);
    const { events } = await import("../db/schema");
    const { eq } = await import("drizzle-orm");
    await t.db.update(events).set({ eventEndAt: 9000 }).where(eq(events.id, e.id));
    expect((await call("POST", "/api/reviews")).status).toBe(200);
  });
});

describe("requireRegistrationAccepting", () => {
  function app() {
    const t = createTestDb();
    const clk = clock(REGULAR);
    const a = miniApp(clk.now);
    a.use("*", loadActiveEvent);
    a.post("/register", requireRegistrationAccepting, (c) => c.json({ ok: true }));
    return {
      t,
      clk,
      post: () => a.request("/register", { method: "POST" }, testEnv(t)),
    };
  }

  it("reguler dan susulan diterima; sebelum dibuka ditolak; selesai ditolak", async () => {
    const { t, clk, post } = app();
    await insertEvent(t, published);
    const code = async (time: number) => {
      clk.t = time;
      const res = await post();
      return res.status === 200 ? "ok" : ((await res.json()) as { code: string }).code;
    };
    expect(await code(BEFORE_OPEN)).toBe("registration_closed");
    expect(await code(REGULAR)).toBe("ok");
    expect(await code(LATE)).toBe("ok"); // susulan via link
    expect(await code(LIVE)).toBe("ok");
    expect(await code(ENDED)).toBe("event_ended");
  });

  it("susulan dimatikan admin: ditolak registration_closed setelah penutupan", async () => {
    const { t, clk, post } = app();
    await insertEvent(t, {
      ...published,
      settingsJson: JSON.stringify({ allowLateRegistration: false }),
    });
    clk.t = LATE;
    const res = await post();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ code: "registration_closed" });
  });
});

describe("requireVotingOpen", () => {
  it("review hanya dibuka selama event berlangsung", async () => {
    const t = createTestDb();
    const clk = clock(REGULAR);
    const a = miniApp(clk.now);
    a.use("*", loadActiveEvent);
    a.post("/review", requireVotingOpen, (c) => c.json({ ok: true }));
    await insertEvent(t, published);
    const code = async (time: number) => {
      clk.t = time;
      const res = await a.request("/review", { method: "POST" }, testEnv(t));
      return res.status === 200 ? "ok" : ((await res.json()) as { code: string }).code;
    };
    expect(await code(REGULAR)).toBe("voting_closed");
    expect(await code(LIVE)).toBe("ok");
    expect(await code(ENDED)).toBe("event_ended");
  });
});

describe("penelusuran semua rute tulis (B17: default-deny)", () => {
  // Rute baru yang lupa dilindungi akan menggagalkan tes ini, tanpa perlu menulis tes baru.
  const real = createApp();

  type RouteInfo = { method: string; path: string };
  const routes: RouteInfo[] = (real.routes as RouteInfo[])
    .filter((r) => r.path.startsWith("/api/") && !r.path.startsWith("/api/admin/"))
    .filter((r) => r.method !== "GET")
    .map((r) => ({ method: r.method === "ALL" ? "POST" : r.method, path: r.path }));
  const unique = [...new Map(routes.map((r) => [`${r.method} ${r.path}`, r])).values()];

  it("menemukan rute untuk ditelusuri", () => {
    expect(unique.length).toBeGreaterThan(0);
  });

  it("setelah event selesai, setiap rute tulis non-admin menjawab 403 event_ended kecuali allowlist", async () => {
    const t = createTestDb();
    await insertEvent(t, published);
    const app = createApp({ now: () => ENDED + 1 });
    for (const r of unique) {
      const path = r.path.replace(/:[A-Za-z]+/g, "x").replace(/\*/g, "probe");
      const res = await app.request(path, { method: r.method }, testEnv(t));
      if (FROZEN_ALLOWLIST.has(`${r.method} ${r.path}`)) {
        expect(res.status, `${r.method} ${r.path} (allowlist)`).not.toBe(403);
      } else {
        expect(res.status, `${r.method} ${r.path}`).toBe(403);
        expect(await res.json()).toEqual({ code: "event_ended" });
      }
    }
  });

  it("allowlist hanya berisi rute booth yang disetujui", () => {
    expect([...FROZEN_ALLOWLIST].sort()).toEqual([
      "POST /api/booth/logout",
      "POST /api/booth/otp/request",
      "POST /api/booth/otp/verify",
    ]);
  });
});
