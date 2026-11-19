import { Hono } from "hono";
import type { AppEnv } from "../../app-env";
import type { EmailSender } from "../../lib/email";
import { notifyLive } from "../../lib/live-notify";
import { type RequireAdminOptions, requireAdmin } from "../../middleware/require-admin";
import { createAdminBoothRoutes } from "./booths";
import { adminEventRoutes } from "./events";
import { adminMediaRoutes } from "./media";
import { adminModerationRoutes } from "./moderation";
import { adminProductRoutes } from "./products";
import { adminResultsRoutes } from "./results";

/** Semua /api/admin/*: hanya admin (Cloudflare Access), tidak terkena pembekuan event (B17). */
export function createAdminRoutes(opts: RequireAdminOptions & { email?: EmailSender } = {}) {
  return (
    new Hono<AppEnv>()
      .use("/api/admin/*", requireAdmin({ getJwks: opts.getJwks }))
      // Perubahan admin apa pun yang berhasil → klien live mengambil ulang snapshot (kunci cache sudah berganti, B8/B17).
      .use("/api/admin/*", async (c, next) => {
        await next();
        if (c.req.method !== "GET" && c.res.status < 400) notifyLive(c, "refresh", true);
      })
      .route("/", adminEventRoutes)
      .route("/", createAdminBoothRoutes({ email: opts.email }))
      .route("/", adminMediaRoutes)
      .route("/", adminModerationRoutes)
      .route("/", adminResultsRoutes)
      .route("/", adminProductRoutes)
  );
}
