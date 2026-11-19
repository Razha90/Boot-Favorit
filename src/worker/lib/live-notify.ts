// Memberi tahu LiveHub bahwa data berubah (explore.md B8). Tidak pernah menggagalkan permintaan: siaran hanyalah
// pelengkap; data yang benar tetap ada di D1 dan di snapshot. Tanpa binding (tes, atau DO belum dipasang) tidak ada efek.

import type { AppContext } from "../app-env";
import type { LiveKind } from "../live/hub";
import { getDb } from "./db";
import { findActiveEvent } from "./event";
import { logEvent } from "./logger";

/**
 * `fresh` = muat ulang event dari D1 (dipakai setelah aksi admin: jadwal/mode mungkin baru berubah, sedangkan event
 * di konteks dimuat SEBELUM perubahan). DO memakai `eventEndAt` terbaru untuk menutup koneksi tepat waktu.
 */
export function notifyLive(c: AppContext, kind: LiveKind, fresh = false): void {
  const ns = c.env.LIVE_HUB;
  const ctxEvent = c.get("event");
  if (!ns || !ctxEvent) return;
  const task = Promise.resolve()
    .then(async () => {
      const event = fresh ? ((await findActiveEvent(getDb(c.env))) ?? ctxEvent) : ctxEvent;
      await ns.get(ns.idFromName(event.id)).ingest(event.id, kind, event.eventEndAt);
    })
    .catch((e: unknown) =>
      logEvent(c, {
        eventId: ctxEvent.id,
        category: "system",
        action: "system.error",
        level: "warn",
        msg: `live_notify_failed: ${e instanceof Error ? e.message : String(e)}`,
      }),
    );
  try {
    c.executionCtx.waitUntil(task);
  } catch {
    // tanpa ExecutionContext (tes): biarkan berjalan di latar
    void task;
  }
}
