// Pembantu tes pengunjung: klien dengan "cookie jar" di atas adminHarness (admin tetap lewat jalur dev localhost).
import type { AppDeps } from "../index";
import type { EmailMessage } from "../lib/email";
import { hmacHex, sessionSecret } from "../lib/identity";
import { signVisitorToken } from "../lib/session";
import type { Deps } from "../services/visitors";
import { adminHarness, type TestJson } from "./admin";
import { seedPublic } from "./seed";

export const LIVE = 3500; // event berlangsung (TIMES: mulai 3000, selesai 4000)

export interface VisitorCallOptions {
  key?: string | false;
  headers?: Record<string, string>;
  /** Env khusus panggilan ini (mis. APP_ENV produksi) tanpa merusak penyemaian lewat jalur dev admin. */
  env?: Partial<Env>;
}

/** Env "produksi": bukan development, jadi bypass dev (Turnstile, devCode, email) tidak berlaku. */
export const PROD_ENV = {
  APP_ENV: "production",
  SESSION_SECRET: "rahasia-uji",
} as unknown as Partial<Env>;

/** Satu "browser" dengan cookie sendiri. */
export function visitorClient(h: ReturnType<typeof adminHarness>) {
  const jar = new Map<string, string>();
  async function call(method: string, path: string, body?: unknown, o: VisitorCallOptions = {}) {
    const headers: Record<string, string> = { ...o.headers };
    if (body !== undefined) headers["content-type"] = "application/json";
    if (method !== "GET" && o.key !== false)
      headers["Idempotency-Key"] = o.key ?? crypto.randomUUID();
    if (jar.size > 0) headers.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await h.app.request(
      `http://localhost${path}`,
      { method, headers, body: body === undefined ? undefined : JSON.stringify(body) },
      { ...h.env(), ...o.env } as Env,
    );
    for (const sc of res.headers.getSetCookie()) {
      const [pair = ""] = sc.split(";");
      const eq = pair.indexOf("=");
      const name = pair.slice(0, eq);
      const value = pair.slice(eq + 1);
      if (/max-age=0/i.test(sc) || value === "") jar.delete(name);
      else jar.set(name, value);
    }
    const text = await res.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = text;
    }
    return { res, status: res.status, json: json as TestJson };
  }
  return { call, jar };
}

export type VisitorClient = ReturnType<typeof visitorClient>;

/** Masuk lewat OTP (mode bawaan, Turnstile lolos di dev). Mengembalikan klien yang sudah bersesi. */
export async function loginWithOtp(
  h: ReturnType<typeof adminHarness>,
  email: string,
  name?: string,
) {
  const v = visitorClient(h);
  const req = await v.call("POST", "/api/visitor/otp/request", { email }, { key: false });
  if (req.status !== 200)
    throw new Error(`otp request gagal: ${req.status} ${JSON.stringify(req.json)}`);
  const ver = await v.call(
    "POST",
    "/api/visitor/otp/verify",
    { email, code: req.json.devCode, ...(name ? { displayName: name } : {}) },
    { key: false },
  );
  if (ver.status !== 200)
    throw new Error(`otp verify gagal: ${ver.status} ${JSON.stringify(ver.json)}`);
  return { ...v, visitor: ver.json.visitor as { id: string; displayName: string | null } };
}

/** Pengirim email palsu: menyimpan pesan terakhir per alamat. */
export function fakeEmail() {
  const sent: EmailMessage[] = [];
  return { sent, send: async (m: EmailMessage) => void sent.push(m) };
}

export const depsFor = (h: ReturnType<typeof adminHarness>): Deps => ({
  now: h.clk.now(),
  newId: () => crypto.randomUUID(),
});

/** Event aktif + booth (lengkap, hanya-nama, belum tayang) dan jam diatur ke "berlangsung". */
export async function liveHarness(deps: AppDeps = {}, extraEnv: Partial<Env> = {}) {
  const h = adminHarness(1500, extraEnv, deps);
  const s = await seedPublic(h);
  // Jendela event dipanjangkan: tes memajukan jam berjam-jam/berhari-hari tanpa menabrak "event selesai".
  await h.t.d1.exec("UPDATE events SET event_end_at = 9000000000000");
  h.clk.t = LIVE;
  return { h, s };
}

/**
 * Pengunjung dibuat langsung di DB dengan cookie sesi yang sah (tanpa melalui OTP), untuk skenario berskala
 * (lonjakan, pola sabotase) yang akan terbentur pembatas laju login.
 */
export async function directVisitor(
  h: ReturnType<typeof adminHarness>,
  eventId: string,
  o: { name?: string | null; createdAt?: number; identity?: string } = {},
) {
  const id = crypto.randomUUID();
  const secret = sessionSecret({ APP_ENV: "development" } as Env);
  const identity = o.identity ?? (await hmacHex(secret, `direct:${id}`));
  const created = o.createdAt ?? 1;
  await h.t.d1
    .prepare(
      "INSERT INTO visitors (id, event_id, provider, identity_hash, display_name, blocked, created_at, updated_at) VALUES (?, ?, 'email', ?, ?, 0, ?, ?)",
    )
    .bind(id, eventId, identity, o.name ?? null, created, created)
    .run();
  const v = visitorClient(h);
  const { token } = await signVisitorToken(secret, id, eventId, h.clk.now());
  v.jar.set("visitor_session", token);
  return { ...v, visitor: { id } };
}

/** Kirim review (kunci idempotensi baru) dan kembalikan respons. */
export const review = (
  v: Pick<ReturnType<typeof visitorClient>, "call">,
  boothId: string,
  body: Record<string, unknown>,
  key?: string,
) => v.call("POST", `/api/booths/${boothId}/review`, body, key ? { key } : {});
