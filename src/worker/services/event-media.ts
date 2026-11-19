// Gambar milik event: logo kecil (kaki halaman), gambar pratinjau tautan (OG), dan kolase hero 0–3 foto
// suasana acara (explore.md A12 butir 3, B6). Semuanya OPSIONAL: tanpa gambar, komponen menyesuaikan (A16).

import { ApiError } from "@shared/errors";
import { eq, sql } from "drizzle-orm";
import { events } from "../db/schema";
import { type Db, runBatch } from "../lib/db";
import { type Deps, getEventOrThrow } from "./events";
import { deleteKeys, type ImagePair, storeEventPair, thumbKeyOf } from "./media";
import { eventMedia } from "./public";

export type EventMediaKind = "logo" | "og" | "hero";
export const MAX_HERO = 3;

/** Jenis gambar event memakai batas ukuran: logo → logo; OG dan hero → foto (B15). */
export const limitKindOf = (k: EventMediaKind) =>
  (k === "logo" ? "logo" : "photo") as "logo" | "photo";

const both = (key: string | null) => (key ? [key, thumbKeyOf(key)] : []);

async function save(db: Db, eventId: string, set: Partial<typeof events.$inferInsert>, d: Deps) {
  await runBatch(db, [
    db
      .update(events)
      .set({ ...set, statsVersion: sql`${events.statsVersion} + 1`, updatedAt: d.now })
      .where(eq(events.id, eventId)),
  ]);
}

export async function setEventMedia(
  db: Db,
  bucket: R2Bucket,
  eventId: string,
  kind: EventMediaKind,
  slot: number,
  pair: ImagePair,
  d: Deps,
) {
  const event = await getEventOrThrow(db, eventId);
  const media = eventMedia(event);
  if (kind === "hero" && (!Number.isInteger(slot) || slot < 0 || slot >= MAX_HERO)) {
    throw new ApiError("validation_error", "hero_slot");
  }
  const keys = await storeEventPair(bucket, eventId, pair, d.newId());

  try {
    if (kind === "logo") await save(db, eventId, { logoKey: keys.fullKey }, d);
    else if (kind === "og") await save(db, eventId, { ogImageKey: keys.fullKey }, d);
    else {
      // Isi slot bila ada; slot di luar daftar menambah di akhir (daftar tetap rapat, tanpa lubang).
      const next = [...media.heroKeys];
      const target = Math.min(slot, next.length);
      const replaced = next[target];
      next[target] = keys.fullKey;
      await save(db, eventId, { heroKeysJson: JSON.stringify(next) }, d);
      await deleteKeys(bucket, both(replaced ?? null));
      return eventMedia({ ...event, heroKeysJson: JSON.stringify(next) });
    }
  } catch (err) {
    await deleteKeys(bucket, [keys.fullKey, keys.thumbKey]);
    throw err;
  }
  await deleteKeys(bucket, both(kind === "logo" ? media.logoKey : media.ogImageKey));
  return eventMedia({
    ...event,
    logoKey: kind === "logo" ? keys.fullKey : media.logoKey,
    ogImageKey: kind === "og" ? keys.fullKey : media.ogImageKey,
  });
}

export async function removeEventMedia(
  db: Db,
  bucket: R2Bucket,
  eventId: string,
  kind: EventMediaKind,
  slot: number,
  d: Deps,
) {
  const event = await getEventOrThrow(db, eventId);
  const media = eventMedia(event);
  if (kind === "logo") {
    await save(db, eventId, { logoKey: null }, d);
    await deleteKeys(bucket, both(media.logoKey));
    return { ...media, logoKey: null };
  }
  if (kind === "og") {
    await save(db, eventId, { ogImageKey: null }, d);
    await deleteKeys(bucket, both(media.ogImageKey));
    return { ...media, ogImageKey: null };
  }
  const removed = media.heroKeys[slot];
  if (removed === undefined) return media;
  const next = media.heroKeys.filter((_, i) => i !== slot);
  await save(db, eventId, { heroKeysJson: JSON.stringify(next) }, d);
  await deleteKeys(bucket, both(removed));
  return { ...media, heroKeys: next };
}
