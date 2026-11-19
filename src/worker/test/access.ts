// Pembantu tes: membuat pasangan kunci RSA dan JWT Access palsu yang ditandatangani sungguhan.
import type { AccessJwk } from "../lib/access-jwt";

const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes instanceof Uint8Array ? bytes : bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const b64urlJson = (v: unknown) => b64url(new TextEncoder().encode(JSON.stringify(v)));

export async function createAccessKeys(kid = "kid-1") {
  const pair = (await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const jwk = { ...(await crypto.subtle.exportKey("jwk", pair.publicKey)), kid } as AccessJwk;

  async function sign(
    claims: Record<string, unknown>,
    header: Record<string, unknown> = { alg: "RS256", kid },
  ) {
    const signingInput = `${b64urlJson(header)}.${b64urlJson(claims)}`;
    const sig = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      pair.privateKey,
      new TextEncoder().encode(signingInput),
    );
    return `${signingInput}.${b64url(sig)}`;
  }
  return { jwk, sign };
}

export const ACCESS = {
  team: "lppm.cloudflareaccess.com",
  aud: "aud-tag-123",
  now: 1_800_000_000_000,
} as const;

export const claims = (over: Record<string, unknown> = {}) => ({
  iss: `https://${ACCESS.team}`,
  aud: [ACCESS.aud],
  email: "admin@unimed.test",
  exp: Math.floor(ACCESS.now / 1000) + 600,
  ...over,
});
