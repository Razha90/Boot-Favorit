// Sesi pengunjung pada rute pengunjung (explore.md B7). `loadVisitor` tidak pernah menolak; `requireVisitor` menolak 401.
// Token hanya mengidentifikasi; keberadaan, event, dan status blokir SELALU dicek ulang di D1.

import { ApiError } from "@shared/errors";
import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import type { AppContext, AppEnv } from "../app-env";
import { visitors } from "../db/schema";
import { getDb } from "../lib/db";
import { sessionSecret } from "../lib/identity";
import { readVisitorCookie, verifyVisitorToken } from "../lib/session";

export const loadVisitor = createMiddleware<AppEnv>(async (c, next) => {
  c.set("visitor", null);
  const token = readVisitorCookie(c);
  const event = c.get("event");
  if (token && event) {
    const claims = await verifyVisitorToken(sessionSecret(c.env), token, c.get("now")());
    // Sesi event lain (atau event sebelumnya) tidak berlaku: akun pengunjung per-event (A4).
    if (claims && claims.eid === event.id) {
      const v = await getDb(c.env).select().from(visitors).where(eq(visitors.id, claims.sub)).get();
      if (v && v.eventId === event.id) c.set("visitor", v);
    }
  }
  await next();
});

export const requireVisitor = createMiddleware<AppEnv>(async (c, next) => {
  const v = c.get("visitor");
  if (!v) throw new ApiError("unauthorized");
  if (v.blocked === 1) throw new ApiError("visitor_blocked");
  await next();
});

/** Kunci pemilik Idempotency-Key untuk rute pengunjung. */
export const visitorIdempotencyActor = (c: AppContext) =>
  `visitor:${c.get("visitor")?.id ?? "anon"}`;
