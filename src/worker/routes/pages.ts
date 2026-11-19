import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { AppEnv } from "../app-env";
import { boothPhotos, booths, products } from "../db/schema";
import { type Db, getDb } from "../lib/db";
import { eventState, findActiveEvent, isPublicEvent } from "../lib/event";
import {
  buildManifest,
  buildPageMeta,
  buildRobotsTxt,
  buildSitemapXml,
  injectMeta,
  type PageKind,
  type SitemapEntry,
} from "../lib/page-meta";
import { buildCsp } from "../middleware/security";

/** Ambil index.html dari aset statis (SPA). Binding ASSETS diisi runtime; `/` dilayani aset tanpa memanggil Worker lagi. */
async function indexHtml(c: { env: Env; req: { url: string } }): Promise<string | null> {
  const res = await c.env.ASSETS.fetch(new Request(new URL("/", c.req.url)));
  return res.ok ? await res.text() : null;
}

const htmlResponse = (html: string, csp: string, robots?: string) =>
  new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=10",
      "content-security-policy": csp,
      ...(robots?.startsWith("noindex") ? { "x-robots-tag": robots } : {}),
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
    booth: {
      id: b.id,
      name: b.name,
      boothNo: b.boothNo,
      tagline: b.tagline,
      teamName: b.teamName,
      coverThumbKey: cover?.keyThumb ?? null,
      updatedAt: b.updatedAt,
    },
    product: product
      ? { name: product.name, priceIdr: product.priceIdr, thumbKey: product.keyThumb }
      : null,
  };
}

// Halaman yang sering dibagikan dan dicari: tautan event dan booth (juga lewat QR). Tanpa event publik atau booth
// tak ditemukan, HTML asli disajikan apa adanya (SPA yang menampilkan keadaannya).
export const pageRoutes = new Hono<AppEnv>()
  .get("/", async (c) => serve(c, "home", null))
  .get("/b/:id", async (c) => serve(c, "booth", c.req.param("id")))
  .get("/results", async (c) => serve(c, "results", null))
  .get("/register", async (c) => serve(c, "register", null))
  .get("/robots.txt", (c) =>
    c.body(buildRobotsTxt(new URL(c.req.url).origin), 200, {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    }),
  )
  .get("/sitemap.xml", async (c) => {
    const url = new URL(c.req.url);
    const db = getDb(c.env);
    const event = await findActiveEvent(db);
    const entries: SitemapEntry[] = [];
    if (isPublicEvent(event)) {
      const state = eventState(event, c.get("now")());
      entries.push({
        path: "/",
        lastModified: event.updatedAt,
        changeFrequency: state.phase === "live" ? "hourly" : "daily",
        priority: 1,
      });
      if (state.resultsPublished) {
        entries.push({
          path: "/results",
          lastModified: event.resultsPublishedAt ?? event.updatedAt,
          changeFrequency: "daily",
          priority: 0.8,
        });
      }
      const rows = await db
        .select({ id: booths.id, updatedAt: booths.updatedAt })
        .from(booths)
        .where(and(eq(booths.eventId, event.id), eq(booths.status, "approved")))
        .limit(5000);
      for (const b of rows) {
        entries.push({
          path: `/b/${b.id}`,
          lastModified: b.updatedAt,
          changeFrequency: "daily",
          priority: 0.6,
        });
      }
    }
    return c.body(buildSitemapXml(url.origin, entries), 200, {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=300",
    });
  })
  .get("/manifest.webmanifest", async (c) => {
    const event = await findActiveEvent(getDb(c.env));
    const name = isPublicEvent(event) ? event.name : "Penilaian Booth Terfavorit";
    return c.body(JSON.stringify(buildManifest(name)), 200, {
      "content-type": "application/manifest+json; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=3600",
    });
  });

async function serve(
  c: Parameters<typeof indexHtml>[0] & {
    req: { url: string; query: (k: string) => string | undefined };
    get: (k: "now") => () => number;
  },
  kind: PageKind,
  boothId: string | null,
) {
  const html = await indexHtml(c);
  if (html === null) return new Response("Not found", { status: 404 });

  const csp = buildCsp(c.env);
  const db = getDb(c.env);
  const event = await findActiveEvent(db);
  if (!isPublicEvent(event)) return htmlResponse(html, csp);

  const url = new URL(c.req.url);
  const bm = boothId ? await boothMeta(db, event.id, boothId, c.req.query("p") ?? null) : null;
  if (boothId && !bm) return htmlResponse(html, csp);

  const state = eventState(event, c.get("now")());
  const meta = buildPageMeta({
    kind,
    eventName: event.name,
    origin: url.origin,
    path: url.pathname,
    mediaBase: (c.env.MEDIA_BASE_URL ?? `${url.origin}/media`).replace(/\/+$/, ""),
    // Hanya gambar OG yang diunggah admin: foto suasana hero (480px) kalah bagus dibanding kartu bawaan 1200x630.
    eventImageKey: event.ogImageKey,
    logoKey: event.logoKey,
    phase: state.phase,
    resultsPublished: state.resultsPublished,
    schedule: {
      startAt: event.eventStartAt,
      endAt: event.eventEndAt,
      updatedAt: event.updatedAt,
    },
    booth: bm?.booth ?? null,
    product: bm?.product ?? null,
  });
  return htmlResponse(injectMeta(html, meta), csp, meta.robots);
}
