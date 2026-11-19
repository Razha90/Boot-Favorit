// Email ke pemilik booth (undangan, keputusan admin). Dipakai rute booth admin dan simpan massal Data Grid.
import type { AppContext } from "../app-env";
import { type BoothMailKind, boothMail } from "./booth-mail";
import { deliver, type EmailSender } from "./email";
import { logEvent } from "./logger";

/** Kirim email ke pemilik booth. Gagal kirim TIDAK menggagalkan aksi admin (dicatat di log). */
export async function mailOwner(
  c: AppContext,
  sender: EmailSender | undefined,
  kind: BoothMailKind,
  o: { to: string | null; eventId: string; boothName: string; reason?: string | null },
): Promise<boolean> {
  if (!o.to) return false;
  const event = c.get("event");
  try {
    const sent = await deliver(
      c,
      sender,
      boothMail(kind, {
        to: o.to,
        eventName: event?.name ?? "",
        boothName: o.boothName,
        reason: o.reason,
        origin: new URL(c.req.url).origin,
      }),
    );
    if (sent)
      logEvent(c, { eventId: o.eventId, category: "system", action: "email.sent", meta: { kind } });
    return sent;
  } catch {
    logEvent(c, {
      eventId: o.eventId,
      category: "system",
      action: "email.failed",
      level: "warn",
      meta: { kind },
    });
    return false;
  }
}
