import { Hono } from "hono";
import type { AppEnv } from "../app-env";
import { baseContext, handleError } from "../middleware/base";
import type { TestDb } from "./d1";

export const testEnv = (t: TestDb, extra: Partial<Env> = {}): Env =>
  ({ APP_ENV: "development", DB: t.d1, ...extra }) as Env;

/** Jam yang bisa dimajukan tes. */
export function clock(start = 0) {
  const c = { t: start, now: () => c.t };
  return c;
}

/** Aplikasi mini dengan konteks dasar + penanganan galat yang sama seperti aplikasi asli. */
export function miniApp(now: () => number) {
  const app = new Hono<AppEnv>();
  app.use("*", baseContext(now));
  app.onError(handleError);
  return app;
}
