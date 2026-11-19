import { describe, expect, it } from "vitest";
import { createApp } from "../index";
import type { TestJson } from "../test/admin";
import { testEnv } from "../test/app";
import { createTestDb } from "../test/d1";
import { buildCsp } from "./security";

function htmlAssets(): Fetcher {
  return {
    fetch: async () =>
      new Response("<!doctype html><html><head><title>App</title></head><body></body></html>", {
        headers: { "content-type": "text/html" },
      }),
  } as unknown as Fetcher;
}

describe("Pengerasan keamanan HTTP & CSRF (B11)", () => {
  it("header keamanan terpasang pada API dan halaman HTML", async () => {
    const t = createTestDb();
    const env = testEnv(t, {
      ASSETS: htmlAssets(),
      APP_ENV: "production" as unknown as "development",
    });
    const app = createApp();

    const api = await app.request("/api/health", {}, env);
    expect(api.headers.get("x-content-type-options")).toBe("nosniff");
    expect(api.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(api.headers.get("x-frame-options")).toBe("DENY");
    expect(api.headers.get("permissions-policy")).toContain("camera=()");

    const page = await app.request("https://eventunimed.id/", {}, env);
    expect(page.status).toBe(200);
    expect(page.headers.get("x-content-type-options")).toBe("nosniff");
    expect(page.headers.get("x-frame-options")).toBe("DENY");
    const csp = page.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("script-src 'self' https://challenges.cloudflare.com");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("CSP produksi tanpa unsafe-inline dan menyertakan MEDIA_BASE_URL kustom", () => {
    const prod = buildCsp({
      APP_ENV: "production" as unknown as "development",
      MEDIA_BASE_URL: "https://cdn.contoh.id/subpath",
    });
    expect(prod).toContain(
      "img-src 'self' data: blob: https://media.eventunimed.id https://cdn.contoh.id",
    );
    expect(prod).not.toContain("ws:");

    const dev = buildCsp({ APP_ENV: "development", MEDIA_BASE_URL: undefined });
    expect(dev).toContain("script-src 'self' 'unsafe-inline'");
    expect(dev).toContain("ws: wss:");
  });

  it("CSRF guard menolak mutasi lintas origin (Origin / Sec-Fetch-Site) dengan 403", async () => {
    const t = createTestDb();
    const env = testEnv(t, { APP_ENV: "development", DEV_ADMIN_EMAIL: "adm@localhost.test" });
    const app = createApp();

    // Origin berbeda
    const badOrigin = await app.request(
      "http://localhost/api/admin/events",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example",
        },
        body: "{}",
      },
      env,
    );
    expect(badOrigin.status).toBe(403);
    expect(((await badOrigin.json()) as TestJson).code).toBe("forbidden");

    // Sec-Fetch-Site: cross-site
    const crossSite = await app.request(
      "http://localhost/api/admin/events",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "sec-fetch-site": "cross-site",
        },
        body: "{}",
      },
      env,
    );
    expect(crossSite.status).toBe(403);
    expect(((await crossSite.json()) as TestJson).code).toBe("forbidden");

    // GET lintas-situs tetap boleh (navigasi / tautan luar)
    const getCross = await app.request(
      "http://localhost/api/event",
      { headers: { "sec-fetch-site": "cross-site" } },
      env,
    );
    expect(getCross.status).toBe(200);

    // Same-origin tidak diblokir oleh CSRF guard (sampai ke validasi biasa = 400)
    const sameOrigin = await app.request(
      "http://localhost/api/admin/events",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
          "sec-fetch-site": "same-origin",
        },
        body: "{}",
      },
      env,
    );
    expect(sameOrigin.status).toBe(400);
  });

  it("admin gagal tertutup di produksi walau memakai host localhost dan DEV_ADMIN_EMAIL", async () => {
    const t = createTestDb();
    const env = testEnv(t, {
      APP_ENV: "production" as unknown as "development",
      DEV_ADMIN_EMAIL: "adm@localhost.test",
    });
    const app = createApp();
    const res = await app.request("http://localhost/api/admin/events", {}, env);
    expect(res.status).toBe(401);
  });
});
