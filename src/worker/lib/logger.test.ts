import { ApiError } from "@shared/errors";
import { afterEach, describe, expect, it, vi } from "vitest";
import { miniApp } from "../test/app";
import { logEvent } from "./logger";

afterEach(() => vi.restoreAllMocks());

function setup() {
  const points: AnalyticsEngineDataPoint[] = [];
  const env = {
    APP_ENV: "development",
    LOG: { writeDataPoint: (p: AnalyticsEngineDataPoint) => points.push(p) },
  } as unknown as Env;
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  return { points, env, log };
}

describe("logEvent", () => {
  it("menulis ke Workers Logs (JSON) dan Analytics Engine dengan pemetaan kolom tetap", async () => {
    const { points, env, log } = setup();
    const app = miniApp(() => 0);
    app.get("/x", (c) => {
      logEvent(c, {
        eventId: "ev1",
        category: "booth",
        action: "booth.rejected",
        actor: { type: "admin", id: "adm1" },
        target: { type: "booth", id: "b1" },
        msg: "foto tidak pantas",
        meta: { risk: 3 },
        num: { latencyMs: 12, risk: 3 },
      });
      return c.text("ok");
    });
    const res = await app.request("/x", { headers: { "cf-ray": "ray-1" } }, env);
    const requestId = res.headers.get("X-Request-Id");
    expect(requestId).toBe("ray-1");

    const printed = JSON.parse(String(log.mock.calls[0]?.[0]));
    expect(printed).toMatchObject({ action: "booth.rejected", level: "info", requestId: "ray-1" });

    expect(points).toHaveLength(1);
    expect(points[0]).toEqual({
      indexes: ["ev1"],
      blobs: [
        "booth",
        "booth.rejected",
        "info",
        "admin",
        "adm1",
        "booth",
        "b1",
        "foto tidak pantas",
        '{"risk":3}',
        "ray-1",
      ],
      doubles: [12, 3],
    });
  });

  it("memotong pesan (200) dan meta (2000 karakter)", async () => {
    const { points, env } = setup();
    const app = miniApp(() => 0);
    app.get("/x", (c) => {
      logEvent(c, {
        eventId: "ev1",
        category: "system",
        action: "system.error",
        level: "error",
        msg: "m".repeat(500),
        meta: { big: "z".repeat(5000) },
      });
      return c.text("ok");
    });
    await app.request("/x", {}, env);
    const blobs = points[0]?.blobs as string[];
    expect(blobs[7]).toHaveLength(200);
    expect(blobs[8]).toHaveLength(2000);
  });

  it("tetap bekerja tanpa binding LOG (mis. di dev/tes)", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const app = miniApp(() => 0);
    app.get("/x", (c) => {
      logEvent(c, { eventId: "ev1", category: "system", action: "system.error" });
      return c.text("ok");
    });
    const res = await app.request("/x", {}, { APP_ENV: "development" } as Env);
    expect(res.status).toBe(200);
    expect(log).toHaveBeenCalledOnce();
  });
});

describe("penanganan galat", () => {
  it("ApiError menjadi { code } dengan status yang sesuai", async () => {
    const app = miniApp(() => 0);
    app.get("/x", () => {
      throw new ApiError("registration_closed");
    });
    const res = await app.request("/x", {}, { APP_ENV: "development" } as Env);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ code: "registration_closed" });
  });

  it("galat tak dikenal menjadi 500 internal_error tanpa membocorkan pesan, dan dicatat", async () => {
    const { points, env } = setup();
    const app = miniApp(() => 0);
    app.get("/x", () => {
      throw new Error("SELECT * FROM rahasia gagal");
    });
    const res = await app.request("/x", {}, env);
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ code: "internal_error" });
    expect(text).not.toContain("rahasia");
    expect(points[0]?.blobs?.[1]).toBe("system.error");
  });

  it("ZodError menjadi 400 validation_error dengan rincian", async () => {
    const { z } = await import("zod");
    const app = miniApp(() => 0);
    app.get("/x", () => {
      z.object({ a: z.string() }).parse({});
      return new Response("tak sampai");
    });
    const res = await app.request("/x", {}, { APP_ENV: "development" } as Env);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string; details: unknown[] };
    expect(body.code).toBe("validation_error");
    expect(body.details.length).toBeGreaterThan(0);
  });
});
