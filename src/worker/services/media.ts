// Gambar booth (explore.md B15). Client mengonversi ke WebP; server TIDAK mengonversi, hanya menolak yang
// tidak sesuai: tipe, magic bytes, dimensi, dan ukuran. Satu permintaan membawa dua ukuran (full + thumb).

import type { PhotoView } from "@shared/api-types";
import { CONFIG } from "@shared/config";
import { ApiError } from "@shared/errors";
import { parseWebp } from "@shared/webp";
import { and, asc, eq, sql } from "drizzle-orm";
import { boothPhotos, booths, events } from "../db/schema";
import { type Db, runBatch } from "../lib/db";
import { getBoothRow } from "./booths";
import type { Deps } from "./events";

export type MediaKind = "photo" | "logo" | "product";
export type ImageSize = "full" | "thumb";

export interface ImageFile {
  bytes: Uint8Array;
  type: string;
}
export interface ImagePair {
  full: ImageFile;
  thumb: ImageFile;
}

/** Batas isi permintaan unggah (dua berkas + sedikit overhead multipart). */
export const maxUploadBytes = (kind: MediaKind) =>
  CONFIG.media[kind].maxBytesFull + CONFIG.media[kind].maxBytesThumb + 16 * 1024;

export function validateImage(file: ImageFile, size: ImageSize, kind: MediaKind): void {
  const limits = CONFIG.media[kind];
  const maxBytes = size === "full" ? limits.maxBytesFull : limits.maxBytesThumb;
  const maxPx = size === "full" ? limits.fullPx : limits.thumbPx;

  if (file.type !== "image/webp") throw new ApiError("invalid_image", "not_webp");
  if (file.bytes.length > maxBytes) throw new ApiError("payload_too_large", `${size}_too_big`);
  const info = parseWebp(file.bytes);
  if (!info) throw new ApiError("invalid_image", "not_webp");
  // Mencegah gambar raksasa (bom dekompresi) walau byte-nya kecil.
  if (info.width > maxPx || info.height > maxPx) {
    throw new ApiError("invalid_image", `${size}_dimensions`);
  }
}

/** Ambil dan validasi pasangan `full` + `thumb` dari form multipart. */
export async function readImagePair(form: FormData, kind: MediaKind): Promise<ImagePair> {
  const get = async (name: ImageSize): Promise<ImageFile> => {
    const v = form.get(name);
    if (!(v instanceof Blob)) throw new ApiError("invalid_image", `missing_${name}`);
    return { bytes: new Uint8Array(await v.arrayBuffer()), type: v.type };
  };
  const pair = { full: await get("full"), thumb: await get("thumb") };
  validateImage(pair.full, "full", kind);
  validateImage(pair.thumb, "thumb", kind);
  return pair;
}

/** Baca badan permintaan dengan batas ukuran yang ditegakkan SAAT membaca (bukan hanya header). */
export async function readLimitedBody(req: Request, maxBytes: number): Promise<ArrayBuffer> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new ApiError("payload_too_large");
  if (!req.body) return new ArrayBuffer(0);

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel();
      throw new ApiError("payload_too_large");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out.buffer;
}

export async function readUploadForm(req: Request, kind: MediaKind): Promise<ImagePair> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    throw new ApiError("invalid_image", "multipart_required");
  }
  const body = await readLimitedBody(req, maxUploadBytes(kind));
  let form: FormData;
  try {
    form = await new Response(body, { headers: { "content-type": contentType } }).formData();
  } catch {
    throw new ApiError("invalid_image", "bad_form");
  }
  return readImagePair(form, kind);
}

// ---------- R2 ----------

export interface StoredPair {
  fullKey: string;
  thumbKey: string;
}

const putOptions = {
  httpMetadata: { contentType: "image/webp", cacheControl: "public, max-age=31536000, immutable" },
};

/** Kunci objek acak (tidak bisa ditebak); basis data hanya menyimpan kunci (B15). */
export const mediaKeys = (eventId: string, boothId: string, uid: string): StoredPair => ({
  fullKey: `events/${eventId}/booths/${boothId}/${uid}-full.webp`,
  thumbKey: `events/${eventId}/booths/${boothId}/${uid}-thumb.webp`,
});

export const thumbKeyOf = (fullKey: string) => fullKey.replace(/-full\.webp$/, "-thumb.webp");

async function putPair(bucket: R2Bucket, keys: StoredPair, pair: ImagePair): Promise<StoredPair> {
  await bucket.put(keys.fullKey, pair.full.bytes, putOptions);
  try {
    await bucket.put(keys.thumbKey, pair.thumb.bytes, putOptions);
  } catch (err) {
    await deleteKeys(bucket, [keys.fullKey]);
    throw err;
  }
  return keys;
}

export const storePair = (
  bucket: R2Bucket,
  eventId: string,
  boothId: string,
  pair: ImagePair,
  uid: string,
): Promise<StoredPair> => putPair(bucket, mediaKeys(eventId, boothId, uid), pair);

/** Gambar milik EVENT (logo, OG, kolase hero): events/{eventId}/event/{uid}-{full|thumb}.webp */
export const storeEventPair = (
  bucket: R2Bucket,
  eventId: string,
  pair: ImagePair,
  uid: string,
): Promise<StoredPair> =>
  putPair(
    bucket,
    {
      fullKey: `events/${eventId}/event/${uid}-full.webp`,
      thumbKey: `events/${eventId}/event/${uid}-thumb.webp`,
    },
    pair,
  );

/** Hapus objek bila ada; gagal menghapus hanya meninggalkan objek yatim (tidak merusak data). */
export async function deleteKeys(
  bucket: R2Bucket,
  keys: (string | null | undefined)[],
): Promise<void> {
  const real = keys.filter((k): k is string => !!k);
  if (real.length === 0) return;
  try {
    await bucket.delete(real);
  } catch {
    // objek yatim dibersihkan nanti; tidak boleh menggagalkan aksi pengguna
  }
}

// ---------- Foto galeri booth ----------

export const listBoothPhotos = (db: Db, boothId: string): Promise<PhotoView[]> =>
  db
    .select({
      id: boothPhotos.id,
      keyFull: boothPhotos.keyFull,
      keyThumb: boothPhotos.keyThumb,
      position: boothPhotos.position,
    })
    .from(boothPhotos)
    .where(eq(boothPhotos.boothId, boothId))
    .orderBy(asc(boothPhotos.position));

const touch = (db: Db, eventId: string, boothId: string, now: number) => [
  db.update(booths).set({ updatedAt: now }).where(eq(booths.id, boothId)),
  db
    .update(events)
    .set({ statsVersion: sql`${events.statsVersion} + 1`, updatedAt: now })
    .where(eq(events.id, eventId)),
];

export async function addBoothPhoto(
  db: Db,
  bucket: R2Bucket,
  eventId: string,
  boothId: string,
  pair: ImagePair,
  d: Deps,
): Promise<PhotoView> {
  await getBoothRow(db, eventId, boothId);
  const existing = await listBoothPhotos(db, boothId);
  if (existing.length >= CONFIG.media.maxPhotosPerBooth) throw new ApiError("photo_limit");

  const keys = await storePair(bucket, eventId, boothId, pair, d.newId());
  const photo = {
    id: d.newId(),
    eventId,
    boothId,
    keyFull: keys.fullKey,
    keyThumb: keys.thumbKey,
    // Foto pertama = sampul (posisi 0); lainnya menyusul.
    position: existing.length === 0 ? 0 : Math.max(...existing.map((p) => p.position)) + 1,
    createdAt: d.now,
  };
  try {
    await runBatch(db, [
      db.insert(boothPhotos).values(photo),
      ...touch(db, eventId, boothId, d.now),
    ]);
  } catch (err) {
    await deleteKeys(bucket, [keys.fullKey, keys.thumbKey]);
    throw err;
  }
  return {
    id: photo.id,
    keyFull: photo.keyFull,
    keyThumb: photo.keyThumb,
    position: photo.position,
  };
}

/** Beri nomor ulang 0..n-1 sesuai urutan. Dua fase (nilai sementara negatif) karena UNIQUE(booth_id, position). */
async function renumber(db: Db, boothId: string, orderedIds: string[]) {
  await runBatch(db, [
    ...orderedIds.map((id, i) =>
      db
        .update(boothPhotos)
        .set({ position: -(i + 1) })
        .where(and(eq(boothPhotos.id, id), eq(boothPhotos.boothId, boothId))),
    ),
    ...orderedIds.map((id, i) =>
      db
        .update(boothPhotos)
        .set({ position: i })
        .where(and(eq(boothPhotos.id, id), eq(boothPhotos.boothId, boothId))),
    ),
  ]);
}

export async function deleteBoothPhoto(
  db: Db,
  bucket: R2Bucket,
  eventId: string,
  boothId: string,
  photoId: string,
  d: Deps,
): Promise<PhotoView[]> {
  await getBoothRow(db, eventId, boothId);
  const all = await listBoothPhotos(db, boothId);
  const target = all.find((p) => p.id === photoId);
  if (!target) throw new ApiError("not_found", "photo");

  await runBatch(db, [
    db
      .delete(boothPhotos)
      .where(and(eq(boothPhotos.id, photoId), eq(boothPhotos.boothId, boothId))),
    ...touch(db, eventId, boothId, d.now),
  ]);
  await renumber(
    db,
    boothId,
    all.filter((p) => p.id !== photoId).map((p) => p.id),
  );
  await deleteKeys(bucket, [target.keyFull, target.keyThumb]);
  return listBoothPhotos(db, boothId);
}

/** Urutan baru: daftar id lengkap; yang pertama menjadi sampul. */
export async function reorderBoothPhotos(
  db: Db,
  eventId: string,
  boothId: string,
  ids: string[],
  d: Deps,
): Promise<PhotoView[]> {
  await getBoothRow(db, eventId, boothId);
  const all = await listBoothPhotos(db, boothId);
  const same =
    ids.length === all.length &&
    new Set(ids).size === ids.length &&
    ids.every((id) => all.some((p) => p.id === id));
  if (!same) throw new ApiError("validation_error", "photo_order_mismatch");
  await renumber(db, boothId, ids);
  await runBatch(db, touch(db, eventId, boothId, d.now));
  return listBoothPhotos(db, boothId);
}

// ---------- Logo ----------

export async function setBoothLogo(
  db: Db,
  bucket: R2Bucket,
  eventId: string,
  boothId: string,
  pair: ImagePair,
  d: Deps,
): Promise<{ logoKey: string }> {
  const row = await getBoothRow(db, eventId, boothId);
  const keys = await storePair(bucket, eventId, boothId, pair, d.newId());
  try {
    await runBatch(db, [
      db
        .update(booths)
        .set({ logoKey: keys.fullKey, updatedAt: Math.max(d.now, row.updatedAt + 1) })
        .where(eq(booths.id, boothId)),
      db
        .update(events)
        .set({ statsVersion: sql`${events.statsVersion} + 1`, updatedAt: d.now })
        .where(eq(events.id, eventId)),
    ]);
  } catch (err) {
    await deleteKeys(bucket, [keys.fullKey, keys.thumbKey]);
    throw err;
  }
  if (row.logoKey) await deleteKeys(bucket, [row.logoKey, thumbKeyOf(row.logoKey)]);
  return { logoKey: keys.fullKey };
}

export async function removeBoothLogo(
  db: Db,
  bucket: R2Bucket,
  eventId: string,
  boothId: string,
  d: Deps,
): Promise<void> {
  const row = await getBoothRow(db, eventId, boothId);
  if (!row.logoKey) return;
  await runBatch(db, [
    db
      .update(booths)
      .set({ logoKey: null, updatedAt: Math.max(d.now, row.updatedAt + 1) })
      .where(eq(booths.id, boothId)),
    ...touch(db, eventId, boothId, d.now).slice(1),
  ]);
  await deleteKeys(bucket, [row.logoKey, thumbKeyOf(row.logoKey)]);
}
