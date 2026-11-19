// Pengamanan HTTP & CSRF (explore.md B11): header keamanan, CSP untuk HTML, dan pemeriksa Origin pada mutasi.
import { ApiError } from "@shared/errors";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../app-env";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const DEFAULT_MEDIA_ORIGIN = "https://media.eventunimed.id";

function mediaOriginOf(env: Pick<Env, "MEDIA_BASE_URL">): string {
  if (!env.MEDIA_BASE_URL) return DEFAULT_MEDIA_ORIGIN;
  try {
    return new URL(env.MEDIA_BASE_URL).origin;
  } catch {
    return DEFAULT_MEDIA_ORIGIN;
  }
}

export const SECURITY_HEADERS: ReadonlyArray<[string, string]> = [
  ["X-Content-Type-Options", "nosniff"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  ["X-Frame-Options", "DENY"],
  ["Permissions-Policy", "camera=(), microphone=(), geolocation=()"],
];

/**
 * Content-Security-Policy ketat untuk halaman HTML (produksi tanpa `'unsafe-inline'` di script-src;
 * di mode Vite dev saja `'unsafe-inline'` diizinkan untuk preamble React Fast Refresh).
 */
export function buildCsp(env: Pick<Env, "APP_ENV" | "MEDIA_BASE_URL">): string {
  const media = mediaOriginOf(env);
  const imgSrc = [
    "'self'",
    "data:",
    "blob:",
    DEFAULT_MEDIA_ORIGIN,
    ...(media !== DEFAULT_MEDIA_ORIGIN ? [media] : []),
  ].join(" ");
  const devScript = env.APP_ENV === "development" ? " 'unsafe-inline'" : "";
  const wsProto = env.APP_ENV === "development" ? " ws: wss:" : " wss:";
  return [
    "default-src 'self'",
    `script-src 'self'${devScript} https://challenges.cloudflare.com https://accounts.google.com/gsi/client https://static.cloudflareinsights.com`,
    "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
    `img-src ${imgSrc}`,
    "font-src 'self'",
    `connect-src 'self'${wsProto} https://challenges.cloudflare.com https://accounts.google.com https://cloudflareinsights.com`,
    "frame-src https://challenges.cloudflare.com https://accounts.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join("; ");
}

/** Header keamanan standar untuk semua respons Worker (termasuk Response mentah dari pages/media; lewati 101 WebSocket). */
export const securityHeaders = createMiddleware<AppEnv>(async (c, next) => {
  await next();
  if (!c.res || c.res.status === 101) return;
  try {
    for (const [k, v] of SECURITY_HEADERS) {
      if (!c.res.headers.has(k)) c.res.headers.set(k, v);
    }
  } catch {
    const headers = new Headers(c.res.headers);
    for (const [k, v] of SECURITY_HEADERS) {
      if (!headers.has(k)) headers.set(k, v);
    }
    c.res = new Response(c.res.body, {
      status: c.res.status,
      statusText: c.res.statusText,
      headers,
    });
  }
});

/**
 * Perlindungan CSRF lapis kedua (melengkapi SameSite=Lax, B11): tolak permintaan mutasi lintas origin
 * berdasarkan header `Sec-Fetch-Site` dan `Origin` yang dikirim browser.
 */
export const csrfOriginGuard = createMiddleware<AppEnv>(async (c, next) => {
  if (!MUTATING.has(c.req.method)) return next();

  const fetchSite = c.req.header("sec-fetch-site");
  if (fetchSite === "cross-site") throw new ApiError("forbidden", "csrf_cross_site");

  const origin = c.req.header("origin");
  if (origin !== undefined) {
    const expected = new URL(c.req.url).origin;
    if (origin !== expected) throw new ApiError("forbidden", "csrf_origin_mismatch");
  }
  await next();
});
