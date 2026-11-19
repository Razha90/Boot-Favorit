// GET /ws: upgrade WebSocket ke LiveHub (explore.md B8, B10). Hanya klien yang benar-benar butuh live yang memanggil
// ini; bila gagal atau penuh, klien tetap memakai polling snapshot (degradasi halus).

import { ApiError } from "@shared/errors";
import { Hono } from "hono";
import type { AppEnv } from "../app-env";
import { eventState, isPublicEvent } from "../lib/event";

export const liveRoutes = new Hono<AppEnv>().get("/ws", async (c): Promise<Response> => {
  const event = c.get("event");
  if (!isPublicEvent(event)) throw new ApiError("not_found", "event");
  if (c.req.header("upgrade")?.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket", { status: 426 });
  }
  // Setelah event selesai penonton biasa memakai snapshot beku dengan polling jarang. Hanya Layar Besar yang tetap
  // boleh tersambung (menerima `refresh` saat admin memutar animasi pemenang).
  const screen = c.req.query("screen") === "1";
  if (!screen && eventState(event, c.get("now")()).frozen) throw new ApiError("event_ended");
  const ns = c.env.LIVE_HUB;
  if (!ns) throw new ApiError("internal_error", "live_not_configured");

  // Header dibuat SERVER; nilai dari klien dengan nama yang sama ditimpa.
  const headers = new Headers(c.req.raw.headers);
  headers.set("x-event-id", event.id);
  headers.set("x-event-end", String(event.eventEndAt));
  headers.set("x-live-screen", screen ? "1" : "0");
  return ns.get(ns.idFromName(event.id)).fetch(new Request(c.req.raw, { headers }));
});
