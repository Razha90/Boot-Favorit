// Login Google (explore.md B7): ID token dari Google Identity Services diverifikasi di Worker (RS256, kunci publik
// Google). Memakai ulang verifikator JWT Access. Hanya email yang TERVERIFIKASI Google yang diterima.

import { ApiError } from "@shared/errors";
import { AccessAuthError, type AccessJwk, verifyAccessJwt } from "./access-jwt";

const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"] as const;
const TTL_MS = 60 * 60 * 1000;

export type GoogleKeyFetcher = (forceRefresh: boolean, now: number) => Promise<AccessJwk[]>;

let cache: { keys: AccessJwk[]; fetchedAt: number } | null = null;
export const fetchGoogleKeys: GoogleKeyFetcher = async (forceRefresh, now) => {
  if (cache && !forceRefresh && now - cache.fetchedAt < TTL_MS) return cache.keys;
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new AccessAuthError("jwks_unavailable");
  const keys = ((await res.json()) as { keys?: AccessJwk[] }).keys ?? [];
  cache = { keys, fetchedAt: now };
  return keys;
};

export interface GoogleIdentity {
  email: string;
  name: string | null;
}

export async function verifyGoogleCredential(
  credential: string,
  o: { clientId: string; now: number; getKeys: GoogleKeyFetcher },
): Promise<GoogleIdentity> {
  const attempt = async (force: boolean) => {
    const keys = await o.getKeys(force, o.now);
    let last: unknown = new AccessAuthError("jwt_issuer");
    for (const issuer of ISSUERS) {
      try {
        return await verifyAccessJwt(credential, {
          keys,
          audience: o.clientId,
          issuer,
          now: o.now,
        });
      } catch (e) {
        last = e;
        if (!(e instanceof AccessAuthError) || e.message !== "jwt_issuer") throw e;
      }
    }
    throw last;
  };

  let payload: Awaited<ReturnType<typeof attempt>>;
  try {
    try {
      payload = await attempt(false);
    } catch (e) {
      // Kunci Google berganti (rotasi): ambil ulang sekali.
      if (e instanceof AccessAuthError && e.message === "jwt_unknown_kid")
        payload = await attempt(true);
      else throw e;
    }
  } catch {
    throw new ApiError("login_failed");
  }

  const extra = payload as unknown as { email_verified?: unknown; name?: unknown };
  if (extra.email_verified !== true) throw new ApiError("login_failed");
  return { email: payload.email, name: typeof extra.name === "string" ? extra.name : null };
}

/** Nama depan saja (A5: tampil "alias/nama depan", bukan email). */
export const firstName = (name: string | null): string | null => {
  const f = name?.trim().split(/\s+/)[0];
  return f ? f.slice(0, 30) : null;
};
