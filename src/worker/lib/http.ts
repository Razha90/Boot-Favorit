import { ApiError } from "@shared/errors";
import type { LogEvent } from "@shared/log-events";
import type { z } from "zod";
import type { AppContext } from "../app-env";
import { sha256Hex } from "./hash";
import { logEvent } from "./logger";

/** Baca dan validasi badan JSON. JSON rusak atau tidak sesuai skema → 400 validation_error. */
export async function parseBody<S extends z.ZodType>(
  c: AppContext,
  schema: S,
): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new ApiError("validation_error", "invalid_json");
  }
  return schema.parse(raw);
}

/** Ketergantungan layanan: jam dan pembuat id, diambil dari konteks (jam bisa diganti di tes). */
export const serviceDeps = (c: AppContext) => ({
  now: c.get("now")(),
  newId: () => crypto.randomUUID(),
});

/** Pelaku admin untuk log. Email tidak ditulis ke log (B13): hanya hash singkat. */
export async function adminActor(c: AppContext) {
  const email = c.get("admin").email;
  return { type: "admin" as const, id: (await sha256Hex(email)).slice(0, 12) };
}

/** Kunci pemilik Idempotency-Key untuk rute admin. */
export const adminIdempotencyActor = (c: AppContext) => `admin:${c.get("admin").email}`;

export async function logAdmin(
  c: AppContext,
  eventId: string,
  e: Omit<LogEvent, "eventId" | "category" | "actor">,
): Promise<void> {
  logEvent(c, { ...e, eventId, category: "admin", actor: await adminActor(c) });
}
