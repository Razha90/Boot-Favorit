// Sesi pengunjung (explore.md B7): token bertanda tangan HMAC di cookie HttpOnly. Klaim memuat eventId sehingga
// sesi tidak berlaku di event lain. Status blokir dan keberadaan pengunjung selalu dicek di D1 (bukan dari token).

import { CONFIG } from "@shared/config";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { AppContext } from "../app-env";
import { hmacHex, safeEqual } from "./identity";

export const VISITOR_COOKIE = "visitor_session";

export interface VisitorClaims {
  /** id pengunjung */
  sub: string;
  /** id event */
  eid: string;
  /** kedaluwarsa, detik epoch */
  exp: number;
}

export const b64url = (s: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(s)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

export const unb64url = (s: string) => {
  const padded = s
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(s.length / 4) * 4, "=");
  return new TextDecoder().decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)));
};

export async function signVisitorToken(
  secret: string,
  visitorId: string,
  eventId: string,
  nowMs: number,
): Promise<{ token: string; maxAgeSec: number }> {
  const maxAgeSec = CONFIG.auth.sessionDays * 86_400;
  const claims: VisitorClaims = {
    sub: visitorId,
    eid: eventId,
    exp: Math.floor(nowMs / 1000) + maxAgeSec,
  };
  const payload = b64url(JSON.stringify(claims));
  return { token: `${payload}.${await hmacHex(secret, `v1.${payload}`)}`, maxAgeSec };
}

export async function verifyVisitorToken(
  secret: string,
  token: string,
  nowMs: number,
): Promise<VisitorClaims | null> {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  if (!safeEqual(sig, await hmacHex(secret, `v1.${payload}`))) return null;
  try {
    const c = JSON.parse(unb64url(payload)) as Partial<VisitorClaims>;
    if (typeof c.sub !== "string" || typeof c.eid !== "string" || typeof c.exp !== "number") {
      return null;
    }
    return c.exp > Math.floor(nowMs / 1000) ? (c as VisitorClaims) : null;
  } catch {
    return null;
  }
}

export const isHttps = (c: AppContext) => new URL(c.req.url).protocol === "https:";

export function setVisitorCookie(c: AppContext, token: string, maxAgeSec: number): void {
  setCookie(c, VISITOR_COOKIE, token, {
    httpOnly: true,
    secure: isHttps(c),
    sameSite: "Lax",
    path: "/",
    maxAge: maxAgeSec,
  });
}

export const clearVisitorCookie = (c: AppContext): void =>
  void deleteCookie(c, VISITOR_COOKIE, { path: "/" });

export const readVisitorCookie = (c: AppContext): string | undefined =>
  getCookie(c, VISITOR_COOKIE);
