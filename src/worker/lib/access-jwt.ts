// Verifikasi JWT Cloudflare Access (explore.md B7): header Cf-Access-Jwt-Assertion, RS256.
// Kunci publik diambil dari https://<tim>.cloudflareaccess.com/cdn-cgi/access/certs.

export interface AccessJwk extends JsonWebKey {
  kid: string;
}

export interface AccessPayload {
  email: string;
  iss: string;
  aud: string[];
  exp: number;
  nbf?: number;
  sub?: string;
}

export class AccessAuthError extends Error {}

const b64urlToBytes = (s: string): Uint8Array<ArrayBuffer> => {
  const padded = s
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(s.length / 4) * 4, "=");
  const bin = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const parseJson = <T>(s: string): T => {
  try {
    return JSON.parse(new TextDecoder().decode(b64urlToBytes(s))) as T;
  } catch {
    throw new AccessAuthError("jwt_malformed");
  }
};

export interface VerifyOptions {
  keys: readonly AccessJwk[];
  audience: string;
  issuer: string;
  /** epoch ms */
  now: number;
}

/** Mengembalikan payload bila tanda tangan, issuer, audience, dan waktu valid; selain itu melempar AccessAuthError. */
export async function verifyAccessJwt(token: string, o: VerifyOptions): Promise<AccessPayload> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new AccessAuthError("jwt_malformed");
  const [h, p, s] = parts as [string, string, string];

  const header = parseJson<{ alg?: string; kid?: string }>(h);
  if (header.alg !== "RS256") throw new AccessAuthError("jwt_alg");
  const jwk = o.keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new AccessAuthError("jwt_unknown_kid");

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    b64urlToBytes(s),
    new TextEncoder().encode(`${h}.${p}`),
  );
  if (!ok) throw new AccessAuthError("jwt_signature");

  const payload = parseJson<Partial<AccessPayload>>(p);
  const aud = Array.isArray(payload.aud) ? payload.aud : payload.aud ? [String(payload.aud)] : [];
  const nowSec = Math.floor(o.now / 1000);
  if (payload.iss !== o.issuer) throw new AccessAuthError("jwt_issuer");
  if (!aud.includes(o.audience)) throw new AccessAuthError("jwt_audience");
  if (typeof payload.exp !== "number" || payload.exp <= nowSec) {
    throw new AccessAuthError("jwt_expired");
  }
  if (typeof payload.nbf === "number" && payload.nbf > nowSec) {
    throw new AccessAuthError("jwt_not_yet_valid");
  }
  if (typeof payload.email !== "string" || payload.email === "") {
    throw new AccessAuthError("jwt_no_email");
  }
  return { ...payload, email: payload.email.toLowerCase(), aud } as AccessPayload;
}

// ---------- Pengambilan kunci publik (di-cache per isolate) ----------

const JWKS_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { keys: AccessJwk[]; fetchedAt: number }>();

export type JwksFetcher = (
  teamDomain: string,
  forceRefresh: boolean,
  now: number,
) => Promise<AccessJwk[]>;

export const fetchAccessJwks: JwksFetcher = async (teamDomain, forceRefresh, now) => {
  const cached = cache.get(teamDomain);
  if (cached && !forceRefresh && now - cached.fetchedAt < JWKS_TTL_MS) return cached.keys;
  const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new AccessAuthError("jwks_unavailable");
  const body = (await res.json()) as { keys?: AccessJwk[] };
  const keys = body.keys ?? [];
  cache.set(teamDomain, { keys, fetchedAt: now });
  return keys;
};
