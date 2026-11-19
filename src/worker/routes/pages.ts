import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { AppEnv } from "../app-env";
import { boothPhotos, booths, products } from "../db/schema";
import { type Db, getDb } from "../lib/db";
import { findActiveEvent, isPublicEvent } from "../lib/event";
import { buildPageMeta, injectMeta } from "../lib/page-meta";

/** Ambil index.html dari aset statis (SPA). Binding ASSETS diisi runtime; `/` dilayani aset tanpa memanggil Worker lagi. */
async function indexHtml(c: { env: Env; req: { url: string } }): Promise<string | null> {
  const res = await c.env.ASSETS.fetch(new Request(new URL("/", c.req.url)));
  return res.ok ? await res.text() : null;
}

const htmlResponse = (html: string) =>
  new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=10",
    },
  });

async function boothMeta(db: Db, eventId: string, boothId: string, productId: string | null) {
  const b = await db
    .select()
    .from(booths)
    .where(and(eq(booths.id, boothId), eq(booths.eventId, eventId), eq(booths.status, "approved")))
    .get();
  if (!b) return null;
  const cover = await db
    .select({ keyThumb: boothPhotos.keyThumb })
    .from(boothPhotos)
    .where(and(eq(boothPhotos.boothId, b.id), eq(boothPhotos.position, 0)))
    .get();
  const product = productId
    ? await db
        .select()
        .from(products)
        .where(
          and(
            eq(products.id, productId),
            eq(products.boothId, b.id),
            eq(products.status, "active"),
          ),
        )
        .get()
    : undefined;
  return {
    booth: { name: b.name, tagline: b.tagline, coverThumbKey: cover?.keyThumb ?? null },
    product: product
      ? { name: product.name, priceIdr: product.priceIdr, thumbKey: product.keyThumb }
      : null,
  };
}

// Halaman yang sering dibagikan: tautan event dan booth (juga lewat QR). Tanpa event publik atau booth
// tak ditemukan, HTML asli disajikan apa adanya (SPA yang menampilkan keadaannya).
export const pageRoutes = new Hono<AppEnv>()
  .get("/", async (c) => serve(c, null))
  .get("/b/:id", async (c) => serve(c, c.req.param("id")));

async function serve(
  c: Parameters<typeof indexHtml>[0] & {
    req: { url: string; query: (k: string) => string | undefined };
  },
  boothId: string | null,
) {
  const html = await indexHtml(c);
  if (html === null) return new Response("Not found", { status: 404 });

  const db = getDb(c.env);
  const event = await findActiveEvent(db);
  if (!isPublicEvent(event)) return htmlResponse(html);

  const url = new URL(c.req.url);
  const bm = boothId ? await boothMeta(db, event.id, boothId, c.req.query("p") ?? null) : null;
  if (boothId && !bm) return htmlResponse(html);

  const meta = buildPageMeta({
    eventName: event.name,
    origin: url.origin,
    path: boothId ? `/b/${boothId}` : "/",
    mediaBase: (c.env.MEDIA_BASE_URL ?? `${url.origin}/media`).replace(/\/+$/, ""),
    eventImageKey: event.ogImageKey ?? firstHero(event.heroKeysJson),
    booth: bm?.booth ?? null,
    product: bm?.product ?? null,
  });
  return htmlResponse(injectMeta(html, meta));
}

function firstHero(json: string | null): string | null {
  try {
    const arr = json ? JSON.parse(json) : [];
    return Array.isArray(arr) && typeof arr[0] === "string" ? arr[0] : null;
  } catch {
    return null;
  }
}
