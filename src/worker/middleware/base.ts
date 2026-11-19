import { ApiError, type ErrorCode } from "@shared/errors";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";
import type { AppEnv } from "../app-env";
import { logEvent } from "../lib/logger";

/** Pasang id permintaan dan jam; id dikembalikan di header agar mudah dilacak di log. */
export const baseContext = (now: () => number) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const requestId = c.req.header("cf-ray") ?? crypto.randomUUID();
    c.set("requestId", requestId);
    c.set("now", now);
    c.set("event", null);
    c.header("X-Request-Id", requestId);
    await next();
  });

const body = (code: ErrorCode, extra?: Record<string, unknown>) => ({ code, ...extra });

/** Semua galat menjadi JSON { code }; galat tak dikenal tidak membocorkan pesan internal. */
export const handleError = (err: Error, c: Parameters<typeof logEvent>[0]) => {
  if (err instanceof ApiError) {
    return c.json(err.toBody(), err.status as ContentfulStatusCode);
  }
  if (err instanceof ZodError) {
    return c.json(body("validation_error", { details: err.issues }), 400);
  }
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  logEvent(c, {
    eventId: c.get("event")?.id ?? "-",
    category: "system",
    action: "system.error",
    level: "error",
    msg: err.message,
    meta: { name: err.name },
  });
  return c.json(body("internal_error"), 500);
};

export const notFoundJson = (c: Parameters<typeof logEvent>[0]) => c.json(body("not_found"), 404);
