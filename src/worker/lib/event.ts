import { CONFIG } from "@shared/config";
import { type EventSchedule, type EventState, getEventState } from "@shared/event-state";
import { type EventSettings, eventSettingsSchema } from "@shared/schemas";
import { eq } from "drizzle-orm";
import { type EventRow, events } from "../db/schema";
import type { Db } from "./db";

/** Pengaturan per-event dari settings_json; nilai rusak diabaikan (kembali ke default). */
export function readEventSettings(e: Pick<EventRow, "settingsJson">): EventSettings {
  if (!e.settingsJson) return {};
  try {
    const parsed = eventSettingsSchema.safeParse(JSON.parse(e.settingsJson));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

export function eventSchedule(e: EventRow): EventSchedule {
  return {
    registrationOpenAt: e.registrationOpenAt,
    registrationCloseAt: e.registrationCloseAt,
    eventStartAt: e.eventStartAt,
    eventEndAt: e.eventEndAt,
    resultsPublishedAt: e.resultsPublishedAt,
    allowLateRegistration:
      readEventSettings(e).allowLateRegistration ??
      CONFIG.registration.allowLateRegistrationDefault,
  };
}

export const eventState = (e: EventRow, now: number): EventState =>
  getEventState(eventSchedule(e), now);

export async function findActiveEvent(db: Db): Promise<EventRow | null> {
  const row = await db.select().from(events).where(eq(events.isActive, 1)).get();
  return row ?? null;
}

/** Event yang boleh dilihat publik: aktif, terbit, dan tidak disembunyikan admin (A0). */
export const isPublicEvent = (e: EventRow | null): e is EventRow =>
  e !== null && e.visibility === "published" && e.hiddenFromPublic === 0;
