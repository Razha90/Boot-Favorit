import * as schema from "../db/schema";
import type { TestDb } from "./d1";

// Garis waktu uji (epoch ms): daftar ditutup 2000, event mulai 3000, selesai 4000.
export const TIMES = {
  registrationOpenAt: 1000,
  registrationCloseAt: 2000,
  eventStartAt: 3000,
  eventEndAt: 4000,
} as const;

let counter = 0;
const next = () => ++counter;

export const eventValues = (
  over: Partial<typeof schema.events.$inferInsert> = {},
): typeof schema.events.$inferInsert => ({
  id: `event-${next()}`,
  slug: `acara-${next()}`,
  name: "Penilaian Booth Terfavorit LPPM Expo Tahun 2026",
  ...TIMES,
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

export const boothValues = (
  eventId: string,
  over: Partial<typeof schema.booths.$inferInsert> = {},
): typeof schema.booths.$inferInsert => ({
  id: `booth-${next()}`,
  eventId,
  name: "Kopi Rempah",
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

export const visitorValues = (
  eventId: string,
  over: Partial<typeof schema.visitors.$inferInsert> = {},
): typeof schema.visitors.$inferInsert => ({
  id: `visitor-${next()}`,
  eventId,
  provider: "email",
  identityHash: `hash-${next()}`,
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

export async function insertEvent(
  { db }: TestDb,
  over: Partial<typeof schema.events.$inferInsert> = {},
) {
  const values = eventValues(over);
  await db.insert(schema.events).values(values);
  return values;
}

export async function insertBooth(
  { db }: TestDb,
  eventId: string,
  over: Partial<typeof schema.booths.$inferInsert> = {},
) {
  const values = boothValues(eventId, over);
  await db.insert(schema.booths).values(values);
  return values;
}
