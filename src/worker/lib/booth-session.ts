// Sesi booth (explore.md B7): cookie HttpOnly bertanda tangan. Klaim memuat eventId (akun per-event) dan `eh` =
// HMAC(email saat login): bila admin melepas/mengganti pemilik, `eh` tidak lagi cocok → `owner_changed`.
// Dua cookie: `booth_session` (sesi portal) dan `booth_register` (bukti email terverifikasi untuk mendaftar).

import { CONFIG } from "@shared/config";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { AppContext } from "../app-env";
import { hmacHex, safeEqual } from "./identity";
import { b64url, isHttps, unb64url } from "./session";

export const BOOTH_COOKIE = "booth_session";
export const REGISTER_COOKIE = "booth_register";

export interface BoothClaims {
  /** id booth */
  sub: string;
  /** id event */
  eid: string;
  /** HMAC(email) saat login */
  eh: string;
  /** kedaluwarsa, detik epoch */
  exp: number;
}

export interface RegisterClaims {
  eid: string;
  eh: string;
  exp: number;
}

// Awalan berbeda per jenis token: token sesi tidak bisa dipakai sebagai bukti pendaftaran (dan sebaliknya).
async function sign(secret: string, prefix: string, claims: object): Promise<string> {
  const payload = b64url(JSON.stringify(claims));
  return `${payload}.${await hmacHex(secret, `${prefix}.${payload}`)}`;
}

async function open(secret: string, prefix: string, token: string): Promise<unknown> {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  if (!safeEqual(sig, await hmacHex(secret, `${prefix}.${payload}`))) return null;
  try {
    return JSON.parse(unb64url(payload));
  } catch {
    return null;
  }
}

const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0;

export async function signBoothToken(
  secret: string,
  o: { boothId: string; eventId: string; emailHash: string },
  nowMs: number,
): Promise<{ token: string; maxAgeSec: number }> {
  const maxAgeSec = CONFIG.auth.sessionDays * 86_400;
  const claims: BoothClaims = {
    sub: o.boothId,
    eid: o.eventId,
    eh: o.emailHash,
    exp: Math.floor(nowMs / 1000) + maxAgeSec,
  };
  return { token: await sign(secret, "booth.v1", claims), maxAgeSec };
}

export async function verifyBoothToken(
  secret: string,
  token: string,
  nowMs: number,
): Promise<BoothClaims | null> {
  const c = (await open(secret, "booth.v1", token)) as Partial<BoothClaims> | null;
  if (!c || !isStr(c.sub) || !isStr(c.eid) || !isStr(c.eh) || typeof c.exp !== "number") {
    return null;
  }
  return c.exp > Math.floor(nowMs / 1000) ? (c as BoothClaims) : null;
}

export async function signRegisterProof(
  secret: string,
  o: { eventId: string; emailHash: string },
  nowMs: number,
): Promise<{ token: string; maxAgeSec: number }> {
  const maxAgeSec = CONFIG.auth.registerProofMinutes * 60;
  const claims: RegisterClaims = {
    eid: o.eventId,
    eh: o.emailHash,
    exp: Math.floor(nowMs / 1000) + maxAgeSec,
  };
  return { token: await sign(secret, "booth.reg.v1", claims), maxAgeSec };
}

export async function verifyRegisterProof(
  secret: string,
  token: string,
  nowMs: number,
): Promise<RegisterClaims | null> {
  const c = (await open(secret, "booth.reg.v1", token)) as Partial<RegisterClaims> | null;
  if (!c || !isStr(c.eid) || !isStr(c.eh) || typeof c.exp !== "number") return null;
  return c.exp > Math.floor(nowMs / 1000) ? (c as RegisterClaims) : null;
}

const cookieOpts = (c: AppContext, maxAge: number) => ({
  httpOnly: true,
  secure: isHttps(c),
  sameSite: "Lax" as const,
  path: "/",
  maxAge,
});

export const setBoothCookie = (c: AppContext, token: string, maxAgeSec: number): void =>
  void setCookie(c, BOOTH_COOKIE, token, cookieOpts(c, maxAgeSec));
export const clearBoothCookie = (c: AppContext): void =>
  void deleteCookie(c, BOOTH_COOKIE, { path: "/" });
export const readBoothCookie = (c: AppContext): string | undefined => getCookie(c, BOOTH_COOKIE);

export const setRegisterCookie = (c: AppContext, token: string, maxAgeSec: number): void =>
  void setCookie(c, REGISTER_COOKIE, token, cookieOpts(c, maxAgeSec));
export const clearRegisterCookie = (c: AppContext): void =>
  void deleteCookie(c, REGISTER_COOKIE, { path: "/" });
export const readRegisterCookie = (c: AppContext): string | undefined =>
  getCookie(c, REGISTER_COOKIE);
