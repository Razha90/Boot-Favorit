import { describe, expect, it, vi } from "vitest";
import type { JwksFetcher } from "../lib/access-jwt";
import { ACCESS, claims, createAccessKeys } from "../test/access";
import { miniApp } from "../test/app";
import { requireAdmin } from "./require-admin";

const baseEnv = {
  APP_ENV: "production",
  ACCESS_TEAM_DOMAIN: ACCESS.team,
  ACCESS_AUD: ACCESS.aud,
  ADMIN_EMAILS: "Admin@Unimed.test, lain@unimed.test",
};

async function setup(extra: Record<string, unknown> = {}) {
  const keys = await createAccessKeys();
  const other = await createAccessKeys(); // kunci lain dengan kid sama: tanda tangan tidak cocok
  const getJwks = vi.fn<JwksFetcher>(async () => [keys.jwk]);
  const app = miniApp(() => ACCESS.now);
  app.get("/api/admin/ping", requireAdmin({ getJwks }), (c) => c.json({ admin: c.get("admin") }));

  const call = (token?: string, url = "https://app.test/api/admin/ping", env = {}) =>
    app.request(url, { headers: token ? { "Cf-Access-Jwt-Assertion": token } : {} }, {
      ...baseEnv,
      ...extra,
      ...env,
    } as unknown as Env);
  return { keys, other, getJwks, call };
}

const code = async (res: Response) => ((await res.json()) as { code: string }).code;

describe("requireAdmin: JWT Cloudflare Access", () => {
  it("menerima JWT valid dari email dalam daftar admin (tanpa membedakan huruf besar-kecil)", async () => {
    const { keys, call } = await setup();
    const res = await call(await keys.sign(claims()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ admin: { email: "admin@unimed.test" } });
  });

  it("menolak tanpa token", async () => {
    const { call } = await setup();
    const res = await call();
    expect(res.status).toBe(401);
    expect(await code(res)).toBe("unauthorized");
  });

  it("menolak email yang tidak ada di daftar admin", async () => {
    const { keys, call } = await setup();
    const res = await call(await keys.sign(claims({ email: "orang@luar.test" })));
    expect(res.status).toBe(401);
  });

  it("menolak audience, issuer, atau masa berlaku yang salah", async () => {
    const { keys, call } = await setup();
    for (const over of [
      { aud: ["aud-lain"] },
      { iss: "https://tim-lain.cloudflareaccess.com" },
      { exp: Math.floor(ACCESS.now / 1000) - 1 },
      { nbf: Math.floor(ACCESS.now / 1000) + 3600 },
    ]) {
      const res = await call(await keys.sign(claims(over)));
      expect(res.status, JSON.stringify(over)).toBe(401);
    }
  });

  it("menolak tanda tangan yang tidak cocok dan token yang rusak", async () => {
    const { other, call } = await setup();
    expect((await call(await other.sign(claims()))).status).toBe(401);
    expect((await call("bukan.jwt")).status).toBe(401);
    expect((await call("a.b.c")).status).toBe(401);
  });

  it("menolak algoritma selain RS256 (mis. none)", async () => {
    const { keys, call } = await setup();
    const token = await keys.sign(claims(), { alg: "none", kid: "kid-1" });
    expect((await call(token)).status).toBe(401);
  });

  it("gagal tertutup bila Access belum dikonfigurasi", async () => {
    const { keys, call } = await setup();
    const token = await keys.sign(claims());
    const res = await call(token, undefined, {
      ACCESS_TEAM_DOMAIN: undefined,
      ACCESS_AUD: undefined,
    });
    expect(res.status).toBe(401);
  });

  it("daftar admin kosong menolak semua orang", async () => {
    const { keys, call } = await setup();
    const res = await call(await keys.sign(claims()), undefined, { ADMIN_EMAILS: "" });
    expect(res.status).toBe(401);
  });

  it("kid tidak dikenal: kunci diambil ulang sekali (rotasi kunci Access)", async () => {
    const stale = await createAccessKeys("kid-lama");
    const fresh = await createAccessKeys("kid-baru");
    const getJwks = vi.fn<JwksFetcher>(async (_t, force) => (force ? [fresh.jwk] : [stale.jwk]));
    const app = miniApp(() => ACCESS.now);
    app.get("/api/admin/ping", requireAdmin({ getJwks }), (c) => c.json({ ok: true }));
    const res = await app.request(
      "https://app.test/api/admin/ping",
      {
        headers: {
          "Cf-Access-Jwt-Assertion": await fresh.sign(claims(), { alg: "RS256", kid: "kid-baru" }),
        },
      },
      baseEnv as unknown as Env,
    );
    expect(res.status).toBe(200);
    expect(getJwks).toHaveBeenCalledTimes(2);
  });
});

describe("requireAdmin: jalur pengembangan lokal", () => {
  const dev = { APP_ENV: "development", DEV_ADMIN_EMAIL: "Dev@Localhost" };

  it("aktif hanya bila APP_ENV=development, DEV_ADMIN_EMAIL ada, dan host localhost", async () => {
    const { call } = await setup();
    const res = await call(undefined, "http://localhost:5173/api/admin/ping", dev);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ admin: { email: "dev@localhost" } });
    expect((await call(undefined, "http://127.0.0.1:5173/api/admin/ping", dev)).status).toBe(200);
  });

  it("TIDAK aktif di host publik walau APP_ENV=development", async () => {
    const { call } = await setup();
    const res = await call(undefined, "https://eventunimed.id/api/admin/ping", dev);
    expect(res.status).toBe(401);
  });

  it("TIDAK aktif bila APP_ENV bukan development walau di localhost", async () => {
    const { call } = await setup();
    const res = await call(undefined, "http://localhost:5173/api/admin/ping", {
      ...dev,
      APP_ENV: "production",
    });
    expect(res.status).toBe(401);
  });

  it("TIDAK aktif tanpa DEV_ADMIN_EMAIL", async () => {
    const { call } = await setup();
    const res = await call(undefined, "http://localhost:5173/api/admin/ping", {
      APP_ENV: "development",
    });
    expect(res.status).toBe(401);
  });
});
