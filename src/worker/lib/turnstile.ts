// Cloudflare Turnstile (explore.md A6, B9): token diverifikasi di Worker lewat siteverify. Gagal tertutup:
// di produksi tanpa kunci rahasia, pemeriksaan TIDAK dilewati (kesalahan konfigurasi, bukan izin lolos).

import { ApiError } from "@shared/errors";
import type { AppContext } from "../app-env";
import { logEvent } from "./logger";

export interface TurnstileCheck {
  token: string;
  secret: string;
  ip?: string;
}
/** Diganti di tes; bawaan memanggil siteverify. */
export type TurnstileVerifier = (c: TurnstileCheck) => Promise<boolean>;

export const siteverify: TurnstileVerifier = async ({ token, secret, ip }) => {
  const body = new FormData();
  body.set("secret", secret);
  body.set("response", token);
  if (ip) body.set("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
    if (!res.ok) return false;
    return ((await res.json()) as { success?: boolean }).success === true;
  } catch {
    return false;
  }
};

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Pengembangan lokal: APP_ENV=development DAN host localhost (pertahanan berlapis, sama seperti admin). */
export const isLocalDev = (c: AppContext): boolean =>
  c.env.APP_ENV === "development" && LOCAL_HOSTS.has(new URL(c.req.url).hostname);

export async function assertHuman(
  c: AppContext,
  token: string | undefined,
  verify: TurnstileVerifier = siteverify,
): Promise<void> {
  const secret = c.env.TURNSTILE_SECRET;
  if (!secret) {
    if (isLocalDev(c)) return; // dev lokal tanpa kunci: lolos
    throw new ApiError("internal_error", "turnstile_not_configured");
  }
  const ok = token
    ? await verify({ token, secret, ip: c.req.header("cf-connecting-ip") })
    : false;
  if (!ok) {
    logEvent(c, {
      eventId: c.get("event")?.id ?? "-",
      category: "spam",
      action: "spam.turnstile_failed",
      level: "warn",
    });
    throw new ApiError("turnstile_failed");
  }
}
