import { Hono } from "hono";
import type { AppEnv } from "./app-env";
import type { JwksFetcher } from "./lib/access-jwt";
import { baseContext, handleError, notFoundJson } from "./middleware/base";
import { eventWriteGate, loadActiveEvent } from "./middleware/event-gate";
import { createAdminRoutes } from "./routes/admin";
import { eventRoutes } from "./routes/event";
import { goRoutes } from "./routes/go";
import { mediaRoutes } from "./routes/media";
import { pageRoutes } from "./routes/pages";
import { publicRoutes } from "./routes/public";

export interface AppDeps {
  /** Jam (epoch ms). Diganti di tes agar jadwal event bisa dikendalikan. */
  now?: () => number;
  /** Pengambil kunci publik Cloudflare Access. Diganti di tes. */
  getJwks?: JwksFetcher;
}

export function createApp(deps: AppDeps = {}) {
  const app = new Hono<AppEnv>();
  app.use("*", baseContext(deps.now ?? Date.now));
  app.onError(handleError);
  app.notFound(notFoundJson);

  // Tidak butuh database: terdaftar SEBELUM middleware event agar tetap menjawab bila D1 bermasalah.
  app.get("/api/health", (c) => c.json({ ok: true, env: c.env.APP_ENV }));

  // Semua rute API lain: muat event aktif, lalu pintu pembekuan (B17). /api/admin/* dikecualikan di gate.
  app.use("/api/*", loadActiveEvent, eventWriteGate);

  app.route("/", mediaRoutes);
  app.route("/", goRoutes);
  app.route("/", pageRoutes);
  app.route("/", eventRoutes);
  app.route("/", publicRoutes);
  app.route("/", createAdminRoutes({ getJwks: deps.getJwks }));

  // Rute /api/* lain belum ada; jangan jatuh ke SPA fallback.
  app.all("/api/*", notFoundJson);

  return app;
}

export const app = createApp();
export default app;
