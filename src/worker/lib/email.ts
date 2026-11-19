// Pengiriman email lewat abstraksi `EmailSender`. Penyedia bawaan: Resend (HTTP), aktif bila RESEND_API_KEY dan
// EMAIL_FROM terisi (keputusan terbuka 5: penyedia sementara, mudah diganti karena hanya satu fungsi).
// Tanpa penyedia: di dev lokal kode OTP dikembalikan ke pemanggil (`devCode`) dan tidak ada email dikirim;
// di produksi tanpa penyedia, permintaan GAGAL (bukan diam-diam "terkirim").

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

/** Pengirim Resend, atau undefined bila belum dikonfigurasi. `fetcher` diganti di tes. */
export function resendSender(
  env: Pick<Env, "RESEND_API_KEY" | "EMAIL_FROM">,
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
  const send = sender ?? resendSender(c.env);
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
