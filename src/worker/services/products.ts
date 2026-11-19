// Produk & promosi booth (explore.md A14, B24): maksimal per booth ditegakkan ATOMIK di server,
// tepat satu produk andalan, statistik turunan dalam batch yang sama.

import type { ProductView } from "@shared/api-types";
import { CONFIG } from "@shared/config";
import { ApiError } from "@shared/errors";
import type { ProductInput } from "@shared/schemas";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { boothStats, booths, events, products } from "../db/schema";
import { type Db, runBatch } from "../lib/db";
import { readEventSettings } from "../lib/event";
import { getBoothRow } from "./booths";
import type { Deps } from "./events";
import { getEventOrThrow } from "./events";
import { deleteKeys, type ImagePair, storePair } from "./media";

export type ProductRow = typeof products.$inferSelect;
export type ProductStatus = ProductRow["status"];

/** Batas efektif per event: pengaturan admin, atau bawaan; selalu dalam 1..maxProductsHardCap. */
export function effectiveMaxProducts(settingsJson: string | null): number {
  const configured = readEventSettings({ settingsJson }).maxProducts ?? CONFIG.booth.maxProducts;
  return Math.min(Math.max(configured, 1), CONFIG.booth.maxProductsHardCap);
}

const view = (p: ProductRow): ProductView => ({
  id: p.id,
  boothId: p.boothId,
  name: p.name,
  description: p.description,
  category: p.category,
  priceIdr: p.priceIdr,
  comparePriceIdr: p.comparePriceIdr,
  badge: p.badge,
  isFeatured: p.isFeatured === 1,
  status: p.status,
  keyFull: p.keyFull,
  keyThumb: p.keyThumb,
  position: p.position,
  version: p.updatedAt,
});

export async function listProducts(db: Db, eventId: string, boothId: string) {
  await getBoothRow(db, eventId, boothId);
  const rows = await db
    .select()
    .from(products)
    .where(eq(products.boothId, boothId))
    .orderBy(asc(products.position), asc(products.createdAt));
  return rows.map(view);
}

async function getProductRow(db: Db, boothId: string, productId: string): Promise<ProductRow> {
  const row = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.boothId, boothId)))
    .get();
  if (!row) throw new ApiError("not_found", "product");
  return row;
}

/**
 * Setelah perubahan produk: pastikan tepat SATU andalan aktif (atau nol bila tak ada produk aktif)
 * dan perbarui statistik turunan booth_stats (jumlah, harga terendah > 0, id andalan). Menaikkan stats_version.
 */
async function settle(
  db: Db,
  eventId: string,
  boothId: string,
  now: number,
  preferFeatured?: string,
) {
  const all = await db
    .select()
    .from(products)
    .where(eq(products.boothId, boothId))
    .orderBy(asc(products.position), asc(products.createdAt));
  const active = all.filter((p) => p.status === "active");

  const keep =
    (preferFeatured && active.find((p) => p.id === preferFeatured)) ||
    active.find((p) => p.isFeatured === 1) ||
    active[0] ||
    null;

  const paid = active.filter((p) => p.priceIdr > 0).map((p) => p.priceIdr);
  const stats = {
    productCount: active.length,
    priceFrom: paid.length > 0 ? Math.min(...paid) : null,
    featuredProductId: keep?.id ?? null,
    updatedAt: now,
  };

  await runBatch(db, [
    // Lepas dulu yang lain, baru pasang: indeks unik parsial `one_featured` menolak keadaan ganda.
    db
      .update(products)
      .set({ isFeatured: 0 })
      .where(and(eq(products.boothId, boothId), keep ? ne(products.id, keep.id) : sql`1 = 1`)),
    ...(keep ? [db.update(products).set({ isFeatured: 1 }).where(eq(products.id, keep.id))] : []),
    db
      .insert(boothStats)
      .values({ boothId, eventId, ...stats })
      .onConflictDoUpdate({ target: boothStats.boothId, set: stats }),
    db
      .update(events)
      .set({ statsVersion: sql`${events.statsVersion} + 1`, updatedAt: now })
      .where(eq(events.id, eventId)),
  ]);
}

export interface CreateProductContext {
  /** Admin mencentang aturan "dilarang menawarkan imbalan untuk bintang/ulasan" atas nama booth (A14). */
  termsConfirmed: boolean;
}

export async function createProduct(
  db: Db,
  eventId: string,
  boothId: string,
  input: ProductInput,
  ctx: CreateProductContext,
  d: Deps,
): Promise<ProductView> {
  const event = await getEventOrThrow(db, eventId);
  const booth = await getBoothRow(db, eventId, boothId);

  // Aturan A14: dicentang sebelum produk pertama tersimpan.
  if (booth.productTermsAcceptedAt === null && !ctx.termsConfirmed) {
    throw new ApiError("validation_error", "terms_required");
  }

  const existing = await db.select().from(products).where(eq(products.boothId, boothId));
  const category = input.category?.trim().toLowerCase();
  if (category) {
    const categories = new Set(
      existing.flatMap((p) => (p.category ? [p.category.trim().toLowerCase()] : [])),
    );
    if (!categories.has(category) && categories.size >= CONFIG.booth.maxProductCategories) {
      throw new ApiError("validation_error", "category_limit");
    }
  }

  const id = d.newId();
  const max = effectiveMaxProducts(event.settingsJson);
  // Penyisipan bersyarat dalam SATU pernyataan: dua permintaan serentak tidak bisa melewati batas.
  // Produk "hidden" ikut dihitung (agar batas tidak diakali dengan menyembunyikan lalu menambah).
  const inserted = await db.run(sql`
    INSERT INTO products (id, event_id, booth_id, name, description, category, price_idr, compare_price_idr,
                          badge, is_featured, status, position, created_at, updated_at)
    SELECT ${id}, ${eventId}, ${boothId}, ${input.name}, ${input.description}, ${input.category},
           ${input.priceIdr}, ${input.comparePriceIdr ?? null}, ${input.badge ?? null}, 0, 'active',
           COALESCE((SELECT MAX(position) + 1 FROM products WHERE booth_id = ${boothId}), 0),
           ${d.now}, ${d.now}
    WHERE (SELECT COUNT(*) FROM products WHERE booth_id = ${boothId} AND status != 'removed_by_admin') < ${max}
  `);
  if ((inserted.meta?.changes ?? 0) === 0) throw new ApiError("product_limit");

  if (booth.productTermsAcceptedAt === null) {
    await db.update(booths).set({ productTermsAcceptedAt: d.now }).where(eq(booths.id, boothId));
  }
  await settle(db, eventId, boothId, d.now);
  return view(await getProductRow(db, boothId, id));
}

export interface ProductPatch extends Partial<ProductInput> {
  status?: ProductStatus;
}

export async function updateProduct(
  db: Db,
  eventId: string,
  boothId: string,
  productId: string,
  patch: ProductPatch,
  d: Deps,
): Promise<ProductView> {
  await getBoothRow(db, eventId, boothId);
  const row = await getProductRow(db, boothId, productId);

  const price = patch.priceIdr ?? row.priceIdr;
  const compare = patch.comparePriceIdr === undefined ? row.comparePriceIdr : patch.comparePriceIdr;
  if (compare !== null && compare <= price) {
    throw new ApiError("validation_error", "compare_price_not_greater");
  }

  await db
    .update(products)
    .set({
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.description !== undefined && { description: patch.description }),
      ...(patch.category !== undefined && { category: patch.category }),
      ...(patch.priceIdr !== undefined && { priceIdr: patch.priceIdr }),
      ...(patch.comparePriceIdr !== undefined && { comparePriceIdr: patch.comparePriceIdr }),
      ...(patch.badge !== undefined && { badge: patch.badge }),
      ...(patch.status !== undefined && { status: patch.status }),
      updatedAt: Math.max(d.now, row.updatedAt + 1),
    })
    .where(eq(products.id, productId));
  await settle(db, eventId, boothId, d.now);
  return view(await getProductRow(db, boothId, productId));
}

export async function deleteProduct(
  db: Db,
  bucket: R2Bucket,
  eventId: string,
  boothId: string,
  productId: string,
  d: Deps,
): Promise<void> {
  await getBoothRow(db, eventId, boothId);
  const row = await getProductRow(db, boothId, productId);
  await db.delete(products).where(eq(products.id, productId));
  await settle(db, eventId, boothId, d.now);
  await deleteKeys(bucket, [row.keyFull, row.keyThumb]);
}

/** Jadikan satu produk sebagai andalan; yang lama dilepas dalam batch yang sama. */
export async function setFeatured(
  db: Db,
  eventId: string,
  boothId: string,
  productId: string,
  d: Deps,
): Promise<ProductView[]> {
  await getBoothRow(db, eventId, boothId);
  const row = await getProductRow(db, boothId, productId);
  if (row.status !== "active") throw new ApiError("validation_error", "featured_must_be_active");
  await settle(db, eventId, boothId, d.now, productId);
  return listProducts(db, eventId, boothId);
}

export async function reorderProducts(
  db: Db,
  eventId: string,
  boothId: string,
  ids: string[],
  d: Deps,
): Promise<ProductView[]> {
  await getBoothRow(db, eventId, boothId);
  const all = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.boothId, boothId));
  const same =
    ids.length === all.length &&
    new Set(ids).size === ids.length &&
    ids.every((id) => all.some((p) => p.id === id));
  if (!same) throw new ApiError("validation_error", "product_order_mismatch");
  await runBatch(
    db,
    ids.map((id, position) =>
      db
        .update(products)
        .set({ position })
        .where(and(eq(products.id, id), eq(products.boothId, boothId))),
    ),
  );
  await settle(db, eventId, boothId, d.now);
  return listProducts(db, eventId, boothId);
}

// ---------- Foto produk ----------

export async function setProductPhoto(
  db: Db,
  bucket: R2Bucket,
  eventId: string,
  boothId: string,
  productId: string,
  pair: ImagePair,
  d: Deps,
): Promise<ProductView> {
  await getBoothRow(db, eventId, boothId);
  const row = await getProductRow(db, boothId, productId);
  const keys = await storePair(bucket, eventId, boothId, pair, d.newId());
  try {
    await db
      .update(products)
      .set({
        keyFull: keys.fullKey,
        keyThumb: keys.thumbKey,
        updatedAt: Math.max(d.now, row.updatedAt + 1),
      })
      .where(eq(products.id, productId));
  } catch (err) {
    await deleteKeys(bucket, [keys.fullKey, keys.thumbKey]);
    throw err;
  }
  await deleteKeys(bucket, [row.keyFull, row.keyThumb]);
  await settle(db, eventId, boothId, d.now);
  return view(await getProductRow(db, boothId, productId));
}

export async function removeProductPhoto(
  db: Db,
  bucket: R2Bucket,
  eventId: string,
  boothId: string,
  productId: string,
  d: Deps,
): Promise<ProductView> {
  await getBoothRow(db, eventId, boothId);
  const row = await getProductRow(db, boothId, productId);
  await db
    .update(products)
    .set({ keyFull: null, keyThumb: null, updatedAt: Math.max(d.now, row.updatedAt + 1) })
    .where(eq(products.id, productId));
  await deleteKeys(bucket, [row.keyFull, row.keyThumb]);
  await settle(db, eventId, boothId, d.now);
  return view(await getProductRow(db, boothId, productId));
}
