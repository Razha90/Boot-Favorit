// Jadwal event ditegakkan di API, bukan hanya di tampilan (explore.md B17).
// Pembekuan setelah event selesai ada di SATU pintu (eventWriteGate) supaya tidak ada rute baru yang terlupa.

import { ApiError } from "@shared/errors";
import { createMiddleware } from "hono/factory";
import { routePath } from "hono/route";
import type { AppEnv } from "../app-env";
import { getDb } from "../lib/db";
import { eventState, findActiveEvent } from "../lib/event";
import { logEvent } from "../lib/logger";

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const ADMIN_PREFIX = "/api/admin/";

/**
 * Rute tulis yang BOLEH berjalan setelah event selesai, agar portal booth bisa dibuka hanya-baca.
 * Menambah baris di sini harus eksplisit dan terlihat di code review (dijaga tes penelusuran rute).
 */
export const FROZEN_ALLOWLIST: ReadonlySet<string> = new Set([
  "POST /api/booth/otp/request",
  "POST /api/booth/otp/verify",
  "POST /api/booth/logout",
]);

/** Muat event aktif ke konteks (tidak gagal bila belum ada; rute yang butuh event memakai requireEvent). */
export const loadActiveEvent = createMiddleware<AppEnv>(async (c, next) => {
  c.set("event", await findActiveEvent(getDb(c.env)));
  await next();
});

export const requireEvent = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get("event")) throw new ApiError("no_active_event");
  await next();
});

/** Default-deny: semua POST/PUT/PATCH/DELETE non-admin ditolak 403 event_ended setelah event selesai. */
export const eventWriteGate = createMiddleware<AppEnv>(async (c, next) => {
  if (READ_METHODS.has(c.req.method)) return next();
  if (c.req.path.startsWith(ADMIN_PREFIX)) return next(); // admin tidak pernah dibekukan

  const event = c.get("event");
  if (!event) throw new ApiError("no_active_event");

  const route = `${c.req.method} ${routePath(c, -1)}`;
  if (FROZEN_ALLOWLIST.has(route)) return next();

  if (eventState(event, c.get("now")()).frozen) {
    logEvent(c, {
      eventId: event.id,
      category: "system",
      action: "event.write_blocked_ended",
      level: "warn",
      meta: { route },
    });
    throw new ApiError("event_ended");
  }
  await next();
});

/** Pendaftaran booth: reguler atau susulan via link, sampai event selesai. */
export const requireRegistrationAccepting = createMiddleware<AppEnv>(async (c, next) => {
  const event = c.get("event");
  if (!event) throw new ApiError("no_active_event");
  const state = eventState(event, c.get("now")());
  if (state.frozen) throw new ApiError("event_ended");
  if (!state.registrationAccepting) throw new ApiError("registration_closed");
  await next();
});

/** Submit review: hanya selama event berlangsung. */
export const requireVotingOpen = createMiddleware<AppEnv>(async (c, next) => {
  const event = c.get("event");
  if (!event) throw new ApiError("no_active_event");
  const state = eventState(event, c.get("now")());
  if (state.frozen) throw new ApiError("event_ended");
  if (!state.votingOpen) throw new ApiError("voting_closed");
  await next();
});
