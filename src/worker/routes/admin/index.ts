import { Hono } from "hono";
import type { AppEnv } from "../../app-env";
import { type RequireAdminOptions, requireAdmin } from "../../middleware/require-admin";
import { adminBoothRoutes } from "./booths";
import { adminEventRoutes } from "./events";
import { adminMediaRoutes } from "./media";
import { adminModerationRoutes } from "./moderation";
import { adminProductRoutes } from "./products";

/** Semua /api/admin/*: hanya admin (Cloudflare Access), tidak terkena pembekuan event (B17). */
export function createAdminRoutes(opts: RequireAdminOptions = {}) {
  return new Hono<AppEnv>()
    .use("/api/admin/*", requireAdmin(opts))
    .route("/", adminEventRoutes)
    .route("/", adminBoothRoutes)
    .route("/", adminMediaRoutes)
    .route("/", adminModerationRoutes)
    .route("/", adminProductRoutes);
}
