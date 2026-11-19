import { Hono } from "hono";
import type { AppEnv } from "./app-env";
import type { JwksFetcher } from "./lib/access-jwt";
import type { LogFetcher } from "./lib/analytics-logs";
import type { EmailSender } from "./lib/email";
import type { GoogleKeyFetcher } from "./lib/google";
import type { TurnstileVerifier } from "./lib/turnstile";
import { baseContext, handleError, notFoundJson } from "./middleware/base";
import { eventWriteGate, loadActiveEvent } from "./middleware/event-gate";
import { csrfOriginGuard, securityHeaders } from "./middleware/security";
import { createAdminRoutes } from "./routes/admin";
import { createBoothAuthRoutes } from "./routes/booth/auth";
import { boothPortalRoutes } from "./routes/booth/portal";
import { eventRoutes } from "./routes/event";
import { goRoutes } from "./routes/go";
import { liveRoutes } from "./routes/live";
import { mediaRoutes } from "./routes/media";
import { pageRoutes } from "./routes/pages";
import { publicRoutes } from "./routes/public";
import { createReviewRoutes } from "./routes/reviews";
import { createVisitorRoutes } from "./routes/visitor";

export interface AppDeps {
  /** Jam (epoch ms). Diganti di tes agar jadwal event bisa dikendalikan. */
  now?: () => number;
  /** Pengambil kunci publik Cloudflare Access. Diganti di tes. */
  getJwks?: JwksFetcher;
  /** Verifikator Turnstile, pengirim email, dan pengambil kunci Google. Diganti di tes. */
  turnstile?: TurnstileVerifier;
  email?: EmailSender;
  googleKeys?: GoogleKeyFetcher;
  /** Pemanggil SQL API Analytics Engine untuk halaman Log. Diganti di tes. */
  logFetcher?: LogFetcher;
}

export function createApp(deps: AppDeps = {}) {
  const app = new Hono<AppEnv>();
  app.use("*", baseContext(deps.now ?? Date.now), securityHeaders);
  app.onError(handleError);
  app.notFound(notFoundJson);

  // Tidak butuh database: terdaftar SEBELUM middleware event agar tetap menjawab bila D1 bermasalah.
  app.get("/api/health", (c) => c.json({ ok: true, env: c.env.APP_ENV }));

  // Semua rute API lain: pemeriksa CSRF Origin, muat event aktif, lalu pintu pembekuan (B17). /api/admin/* dikecualikan di gate.
  app.use("/api/*", csrfOriginGuard, loadActiveEvent, eventWriteGate);
  app.use("/ws", loadActiveEvent); // WebSocket bukan /api/*, tetapi tetap butuh event aktif

  app.route("/", mediaRoutes);
  app.route("/", goRoutes);
  app.route("/", pageRoutes);
  app.route("/", eventRoutes);
  app.route("/", publicRoutes);
  app.route("/", liveRoutes);
  app.route(
    "/",
    createVisitorRoutes({
      turnstile: deps.turnstile,
      email: deps.email,
      googleKeys: deps.googleKeys,
    }),
  );
  app.route("/", createReviewRoutes({ turnstile: deps.turnstile }));
  // Urutan penting: rute auth booth (tanpa sesi) SEBELUM portal, yang memasang requireBooth untuk semua /api/booth/*.
  app.route("/", createBoothAuthRoutes({ turnstile: deps.turnstile, email: deps.email }));
  app.route("/", boothPortalRoutes);
  app.route(
    "/",
    createAdminRoutes({ getJwks: deps.getJwks, email: deps.email, logFetcher: deps.logFetcher }),
  );

  // Rute /api/* lain belum ada; jangan jatuh ke SPA fallback.
  app.all("/api/*", notFoundJson);

  return app;
}

export const app = createApp();
export default app;

// Kelas Durable Object harus diekspor dari entri Worker.
export { LiveHub } from "./live/hub";
