// Sesi portal booth (explore.md B7). Token hanya mengidentifikasi; keberadaan booth, event, dan KEPEMILIKAN dicek ulang di D1
// pada setiap permintaan: bila admin melepas/mengganti pemilik, sesi lama ditolak `401 owner_changed`.

import { ApiError } from "@shared/errors";
import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import type { AppContext, AppEnv } from "../app-env";
import { type BoothRow, booths } from "../db/schema";
import { clearBoothCookie, readBoothCookie, verifyBoothToken } from "../lib/booth-session";
import { getDb } from "../lib/db";
import { emailIdentity, safeEqual, sessionSecret } from "../lib/identity";
import { logEvent } from "../lib/logger";

/** Booth dari cookie, atau null bila tidak ada sesi. Melempar `owner_changed` bila pemilik sudah berubah. */
export async function resolveBooth(c: AppContext): Promise<BoothRow | null> {
  const token = readBoothCookie(c);
  const event = c.get("event");
  if (!token || !event) return null;
  const secret = sessionSecret(c.env);
  const claims = await verifyBoothToken(secret, token, c.get("now")());
  // Sesi event lain tidak berlaku: akun booth per-event (A4).
  if (!claims || claims.eid !== event.id) return null;

  const booth = await getDb(c.env).select().from(booths).where(eq(booths.id, claims.sub)).get();
  if (!booth || booth.eventId !== event.id) return null;

  const current = booth.email ? await emailIdentity(secret, booth.email) : null;
  if (!current || !safeEqual(current, claims.eh)) {
    clearBoothCookie(c);
    logEvent(c, {
      eventId: event.id,
      category: "auth",
      action: "booth.owner_invalidated",
      level: "warn",
      actor: { type: "booth", id: booth.id },
    });
    throw new ApiError("owner_changed");
  }
  return booth;
}

export const requireBooth = createMiddleware<AppEnv>(async (c, next) => {
  const booth = await resolveBooth(c);
  if (!booth) throw new ApiError("unauthorized");
  c.set("booth", booth);
  await next();
});

/** Menyunting hanya selama booth belum ditolak/ditangguhkan; yang lain hanya-baca (status tampil di portal). */
export const requireEditableBooth = createMiddleware<AppEnv>(async (c, next) => {
  const status = c.get("booth").status;
  if (status === "rejected" || status === "suspended") throw new ApiError("booth_not_editable");
  await next();
});

/** Kunci pemilik Idempotency-Key untuk rute portal. */
export const boothIdempotencyActor = (c: AppContext) => `booth:${c.get("booth").id}`;
