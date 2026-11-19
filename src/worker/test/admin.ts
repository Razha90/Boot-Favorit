// Aplikasi lengkap + DB uji + klien admin (lewat jalur dev localhost) untuk tes rute /api/admin/*.
import { type AppDeps, createApp } from "../index";
import { clock, testEnv } from "./app";
import { createTestDb } from "./d1";
import { FakeR2 } from "./r2";

// biome-ignore lint/suspicious/noExplicitAny: JSON respons pada tes bertipe dinamis
export type TestJson = any;

export interface CallOptions {
  /** Kunci idempotensi. Bawaan: UUID baru. `false` = tanpa header. */
  key?: string | false;
  headers?: Record<string, string>;
  /** Badan mentah (mis. FormData); menimpa `body` JSON. */
  raw?: BodyInit;
  extraEnv?: Partial<Env>;
}

export function adminHarness(start = 1500, extraEnv: Partial<Env> = {}, deps: AppDeps = {}) {
  const t = createTestDb();
  const clk = clock(start);
  const app = createApp({ now: clk.now, ...deps });
  const r2 = new FakeR2();
  const env = () =>
    testEnv(t, {
      APP_ENV: "development",
      DEV_ADMIN_EMAIL: "admin@unimed.test",
      MEDIA: r2.asBucket(),
      ...extraEnv,
    });

  async function call(method: string, path: string, body?: unknown, o: CallOptions = {}) {
    const headers: Record<string, string> = { ...o.headers };
    if (body !== undefined && o.raw === undefined) headers["content-type"] = "application/json";
    if (o.key !== false && method !== "GET")
      headers["Idempotency-Key"] = o.key ?? crypto.randomUUID();
    const res = await app.request(
      `http://localhost${path}`,
      {
        method,
        headers,
        body: o.raw ?? (body === undefined ? undefined : JSON.stringify(body)),
      },
      { ...env(), ...o.extraEnv } as Env,
    );
    const text = await res.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = text;
    }
    return { res, status: res.status, json: json as TestJson, headers: res.headers };
  }

  return { t, clk, app, call, env, r2 };
}
