// Pengiriman email lewat abstraksi `EmailSender`. Jalur utama: native Cloudflare Email Sending (binding
// `send_email` `EMAIL` + `EMAIL_FROM`), dengan cadangan HTTP Resend bila `RESEND_API_KEY` terisi.
// Tanpa penyedia (`EMAIL_FROM` kosong): di dev lokal kode OTP dikembalikan (`devCode`) dan tidak ada email
// dikirim; di produksi permintaan GAGAL (tidak diam-diam "terkirim").

import { ApiError } from "@shared/errors";
import type { AppContext } from "../app-env";
import { logEvent } from "./logger";
import { isLocalDev } from "./turnstile";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}
export type EmailSender = (m: EmailMessage) => Promise<void>;

/** Ubah `"Nama <alamat@domain>"` atau `"alamat@domain"` ke format `EmailMessageBuilder.from`. */
export function parseSenderAddress(raw: string): string | { name: string; email: string } {
  const m = /^\s*(.+?)\s*<([^<>]+)>\s*$/.exec(raw);
  if (!m?.[1] || !m[2]) return raw.trim();
  const name = m[1].replace(/^["']|["']$/g, "").trim();
  return name ? { name, email: m[2].trim() } : m[2].trim();
}

/**
 * Pengirim native Cloudflare Email Sending (tab Workers, binding `EMAIL`), aktif bila `env.EMAIL` dan
 * `EMAIL_FROM` terisi (mis. `"LPPM Expo UNIMED <noreply@mail.eventunimed.id>"`).
 */
export function cloudflareEmailSender(
  env: Partial<Pick<Env, "EMAIL" | "EMAIL_FROM">>,
): EmailSender | undefined {
  const { EMAIL: binding, EMAIL_FROM: from } = env;
  if (!binding || !from) return undefined;
  const sender = parseSenderAddress(from);
  return async (m) => {
    try {
      await binding.send({ from: sender, to: m.to, subject: m.subject, text: m.text });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new ApiError("internal_error", `email_provider_cf:${detail.slice(0, 80)}`);
    }
  };
}

/** Pengirim cadangan Resend, atau undefined bila belum dikonfigurasi. `fetcher` diganti di tes. */
export function resendSender(
  env: Partial<Pick<Env, "RESEND_API_KEY" | "EMAIL_FROM">>,
  fetcher: typeof fetch = fetch,
): EmailSender | undefined {
  const { RESEND_API_KEY: key, EMAIL_FROM: from } = env;
  if (!key || !from) return undefined;
  return async (m) => {
    const res = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [m.to], subject: m.subject, text: m.text }),
    });
    if (!res.ok) throw new ApiError("internal_error", `email_provider_${res.status}`);
  };
}

/** Mengembalikan true bila email benar-benar dikirim, false bila dilewati (hanya dev lokal). */
export async function deliver(
  c: AppContext,
  sender: EmailSender | undefined,
  m: EmailMessage,
): Promise<boolean> {
  const send =
    sender ??
    (c.env.RESEND_API_KEY ? resendSender(c.env) : undefined) ??
    cloudflareEmailSender(c.env);
  if (send) {
    await send(m);
    return true;
  }
  if (isLocalDev(c)) {
    logEvent(c, {
      eventId: c.get("event")?.id ?? "-",
      category: "system",
      action: "email.skipped",
    });
    return false;
  }
  throw new ApiError("internal_error", "email_not_configured");
}
