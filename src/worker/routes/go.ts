import { CONFIG } from "@shared/config";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { AppEnv } from "../app-env";
import { booths, products } from "../db/schema";
import { getDb } from "../lib/db";
import { eventState, findActiveEvent, isPublicEvent } from "../lib/event";
import { logEvent } from "../lib/logger";
import { rateLimit } from "../middleware/rate-limit";

/** Pesan awal WhatsApp dibuat SERVER dari data produk, bukan dari parameter bebas (anti-penyalahgunaan, B24). */
export function waMessage(args: {
  boothName: string;
  eventName: string;
  product?: { name: string; priceIdr: number } | null;
}): string {
  const price = (n: number) =>
    n === 0 ? "gratis" : `Rp ${new Intl.NumberFormat("id-ID").format(n)}`;
  const what = args.product
    ? `${args.product.name} (${price(args.product.priceIdr)}) di ${args.boothName}`
    : `booth ${args.boothName}`;
  const text = `Halo kak, aku lihat ${what}, ${args.eventName}. Masih ada, kak?`;
  return text.slice(0, CONFIG.booth.whatsapp.messageMaxLength);
}

/**
 * GET /go/wa/:boothId?p=:productId → 302 ke wa.me dengan pesan terisi (explore.md A14, B24).
 * Nomor hanya diketahui server: tidak ada di HTML, snapshot, maupun JSON. Dibatasi laju per IP, tidak di-cache,
 * ditolak setelah event selesai atau setelah nomor dihapus (404 polos, tanpa membocorkan alasannya).
 */
export const goRoutes = new Hono<AppEnv>().get(
  "/go/wa/:boothId",
  rateLimit({
    name: "wa-redirect",
    limit: CONFIG.booth.whatsapp.redirectRatePerMinute,
    windowSec: 60,
  }),
  async (c) => {
    const notFound = () => c.body(null, 404, { "Cache-Control": "no-store" });
    const db = getDb(c.env);
    const event = await findActiveEvent(db);
    if (!isPublicEvent(event) || eventState(event, c.get("now")()).frozen) return notFound();

    const booth = await db
      .select()
      .from(booths)
      .where(
        and(
          eq(booths.id, c.req.param("boothId")),
          eq(booths.eventId, event.id),
          eq(booths.status, "approved"),
        ),
      )
      .get();
    if (!booth?.whatsappE164) return notFound();

    const pid = c.req.query("p");
    const product = pid
      ? ((await db
          .select()
          .from(products)
          .where(
            and(
              eq(products.id, pid),
              eq(products.boothId, booth.id),
              eq(products.status, "active"),
            ),
          )
          .get()) ?? null)
      : null;

    logEvent(c, {
      eventId: event.id,
      category: "booth",
      action: "booth.wa_click",
      target: { type: "booth", id: booth.id },
    });
    const text = waMessage({ boothName: booth.name, eventName: event.name, product });
    c.header("Cache-Control", "no-store");
    return c.redirect(`https://wa.me/${booth.whatsappE164}?text=${encodeURIComponent(text)}`, 302);
  },
);
