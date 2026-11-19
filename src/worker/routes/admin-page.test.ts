import { describe, expect, it, vi } from "vitest";
import type { JwksFetcher } from "../lib/access-jwt";
import { ACCESS, claims, createAccessKeys } from "../test/access";
import { adminHarness } from "../test/admin";
import { miniApp } from "../test/app";
import { createAdminPageRoutes } from "./admin-page";

const INDEX = `<!doctype html><html lang="id"><head><title>Panel</title></head><body><div id="root"></div></body></html>`;
const assets = {
  fetch: async () => new Response(INDEX, { headers: { "content-type": "text/html" } }),
} as unknown as Fetcher;

const prodEnv = {
  APP_ENV: "production",
  ACCESS_TEAM_DOMAIN: ACCESS.team,
  ACCESS_AUD: ACCESS.aud,
  ADMIN_EMAILS: "admin@unimed.test",
  ASSETS: assets,
};

async function setup() {
  const keys = await createAccessKeys();
  const getJwks = vi.fn<JwksFetcher>(async () => [keys.jwk]);
  const app = miniApp(() => ACCESS.now);
  app.route("/", createAdminPageRoutes({ getJwks }));
  const get = (path: string, token?: string, env: Record<string, unknown> = {}) =>
    app.request(
      `https://eventunimed.id${path}`,
      { headers: token ? { "Cf-Access-Jwt-Assertion": token } : {} },
      { ...prodEnv, ...env } as unknown as Env,
    );
  return { keys, get };
}

describe("cangkang halaman /admin dijaga di Worker (B31)", () => {
  it("tanpa token: 403 halaman polos; isi aplikasi tidak bocor; tidak pernah di-cache atau diindeks", async () => {
    const { get } = await setup();
    for (const path of ["/admin", "/admin/e/abc/data", "/admin/e/abc/posters"]) {
      const res = await get(path);
      expect(res.status, path).toBe(403);
      const html = await res.text();
      expect(html).toContain("Akses ditolak");
      expect(html).not.toContain('<div id="root">');
      expect(res.headers.get("cache-control")).toBe("private, no-store");
      expect(res.headers.get("x-robots-tag")).toContain("noindex");
      expect(res.headers.get("content-security-policy")).toContain("default-src 'self'");
    }
  });

  it("JWT Access valid dari email admin: 200 dan aplikasi disajikan", async () => {
    const { keys, get } = await setup();
    const res = await get("/admin/e/abc", await keys.sign(claims()));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<div id="root">');
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("email di luar daftar admin, token salah audience/kedaluwarsa/rusak: 403", async () => {
    const { keys, get } = await setup();
    const bad = [
      await keys.sign(claims({ email: "orang@luar.test" })),
      await keys.sign(claims({ aud: ["aud-lain"] })),
      await keys.sign(claims({ exp: Math.floor(ACCESS.now / 1000) - 1 })),
      "bukan.jwt",
    ];
    for (const token of bad) expect((await get("/admin", token)).status).toBe(403);
  });

  it("Access belum dikonfigurasi di produksi: gagal tertutup (403), bukan terbuka", async () => {
    const { keys, get } = await setup();
    const res = await get("/admin", await keys.sign(claims()), {
      ACCESS_TEAM_DOMAIN: undefined,
      ACCESS_AUD: undefined,
    });
    expect(res.status).toBe(403);
  });

  it("bypass dev hanya untuk localhost + APP_ENV=development; host lain tetap ditolak", async () => {
    const h = adminHarness();
    const env = { ...h.env(), ASSETS: assets } as Env;
    const local = await h.app.request("http://localhost/admin", {}, env);
    expect(local.status).toBe(200);
    expect(await local.text()).toContain('<div id="root">');
    // host publik + mode development: bypass TIDAK berlaku
    const remote = await h.app.request("https://eventunimed.id/admin", {}, env);
    expect(remote.status).toBe(403);
    // localhost tetapi bukan development: ditolak
    const prodLocal = await h.app.request("http://localhost/admin/e/x", {}, {
      ...env,
      APP_ENV: "production",
    } as unknown as Env);
    expect(prodLocal.status).toBe(403);
  });

  it("aset tak tersedia untuk admin sah: 404 polos, bukan galat terbuka", async () => {
    const { keys, get } = await setup();
    const broken = { fetch: async () => new Response("x", { status: 500 }) } as unknown as Fetcher;
    const res = await get("/admin", await keys.sign(claims()), { ASSETS: broken });
    expect(res.status).toBe(404);
  });
});
