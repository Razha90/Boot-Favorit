// Pengiriman email lewat abstraksi (penyedia dipilih nanti: keputusan terbuka 5, dikerjakan di Tahap 8).
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

/** Mengembalikan true bila email benar-benar dikirim, false bila dilewati (hanya dev lokal). */
export async function deliver(
  c: AppContext,
  sender: EmailSender | undefined,
  m: EmailMessage,
): Promise<boolean> {
  if (sender) {
    await sender(m);
    return true;
  }
  if (isLocalDev(c)) {
    logEvent(c, { eventId: c.get("event")?.id ?? "-", category: "system", action: "email.skipped" });
    return false;
  }
  throw new ApiError("internal_error", "email_not_configured");
}
