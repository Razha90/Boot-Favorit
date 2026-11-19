// Identitas pengunjung (explore.md B7, B9): semua dikunci dengan HMAC; email/kode asli tidak pernah disimpan.
import { ApiError } from "@shared/errors";

// Nilai bawaan HANYA untuk pengembangan lokal (APP_ENV=development). Produksi wajib mengisi SESSION_SECRET.
const DEV_SECRET = "dev-only-session-secret-not-for-production";

export function sessionSecret(env: Pick<Env, "SESSION_SECRET" | "APP_ENV">): string {
  if (env.SESSION_SECRET) return env.SESSION_SECRET;
  if (env.APP_ENV === "development") return DEV_SECRET;
  // Gagal tertutup: tanpa rahasia, sesi dan hash identitas tidak boleh dibuat.
  throw new ApiError("internal_error", "session_secret_missing");
}

const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");

export async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
}

/** Perbandingan waktu-konstan untuk dua string heksadesimal (kode OTP, tanda tangan sesi). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const norm = (s: string) => s.trim().toLowerCase();

/** Email dipakai juga oleh login Google: satu orang satu identitas walau berganti penyedia (anti ganda). */
export const emailIdentity = (secret: string, email: string) =>
  hmacHex(secret, `email:${norm(email)}`);
export const ticketIdentity = (secret: string, code: string) =>
  hmacHex(secret, `ticket:${norm(code)}`);
export const anonIdentity = (secret: string, deviceId: string) =>
  hmacHex(secret, `anon:${deviceId}`);
/** Sinyal (bukan pemblokir): IP dan user-agent di-hash sebelum disimpan. */
export const signalHash = (secret: string, value: string | undefined) =>
  value ? hmacHex(secret, `sig:${value}`) : Promise.resolve(null);
