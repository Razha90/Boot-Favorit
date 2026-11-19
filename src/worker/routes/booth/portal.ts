// Portal booth (explore.md A4, B10): profil sendiri, foto, produk, WhatsApp, ulasan masuk, laporan.
// Rute media/produk SENGAJA mengikuti bentuk rute admin (`/api/booth/...` vs `/api/admin/e/:id/booths/:bid/...`) dan memakai
// layanan yang sama; `boothId` diambil dari SESI, bukan dari path. Booth tidak punya jalur mengubah status atau menyembunyikan ulasan.

import { ApiError } from "@shared/errors";
import { visibility } from "@shared/results";
import {
  boothReportSchema,
  boothSelfUpdateSchema,
  boothSelfWhatsappSchema,
  createProductSchema,
  orderedIdsSchema,
  ownerProductPatchSchema,
} from "@shared/schemas";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import type { AppContext, AppEnv } from "../../app-env";
import type { EventRow } from "../../db/schema";
import { getDb } from "../../lib/db";
import { parseBody, serviceDeps } from "../../lib/http";
import { notifyLive } from "../../lib/live-notify";
import { logEvent } from "../../lib/logger";
import {
  boothIdempotencyActor,
  requireBooth,
  requireEditableBooth,
} from "../../middleware/booth-session";
import { idempotency } from "../../middleware/idempotency";
import { boothMe, resubmitBooth, updateOwnProfile } from "../../services/booth-portal";
import { getBoothRow, setWhatsapp } from "../../services/booths";
import {
  addBoothPhoto,
  deleteBoothPhoto,
  listBoothPhotos,
  type MediaKind,
  maxUploadBytes,
  readUploadForm,
  removeBoothLogo,
  reorderBoothPhotos,
  setBoothLogo,
} from "../../services/media";
import {
  createProduct,
  deleteProduct,
  getProductRow,
  listProducts,
  removeProductPhoto,
  reorderProducts,
  setFeatured,
  setProductPhoto,
  updateProduct,
} from "../../services/products";
import { listPublicReviews } from "../../services/public-reviews";
import { reportReviewAsBooth } from "../../services/reports";

const keyed = idempotency({ required: true, actor: boothIdempotencyActor });
const KINDS: MediaKind[] = ["photo", "logo", "product"];
const mediaQuery = z.object({
  kind: z.enum(["photo", "logo", "product"]),
  productId: z.string().min(1).optional(),
});
// Dipasang SEBELUM idempotensi (yang membaca seluruh badan untuk hash).
const limit = bodyLimit({
  maxSize: Math.max(...KINDS.map(maxUploadBytes)),
  onError: (c) => c.json({ code: "payload_too_large" }, 413),
});

/** Produk yang dihapus admin tidak boleh disentuh pemilik (bukti moderasi; tidak boleh dihidupkan/dihapus). */
async function ownProduct(c: AppContext, productId: string) {
  const row = await getProductRow(getDb(c.env), c.get("booth").id, productId);
  if (row.status === "removed_by_admin") throw new ApiError("forbidden", "removed_by_admin");
  return row;
}

const P = "/api/booth";

export const boothPortalRoutes = new Hono<AppEnv>()
  // Didaftarkan SETELAH rute auth (routes/booth/auth.ts): rute tanpa sesi sudah menjawab sebelum sampai ke sini.
  .use(`${P}/*`, requireBooth, async (c, next) => {
    // Booth ditolak/ditangguhkan: portal hanya-baca (status tetap terlihat).
    if (c.req.method !== "GET") await requireEditableBooth(c, async () => {});
    await next();
  })
  // Perubahan yang tampil publik → klien live mengambil ulang snapshot (kunci cache sudah berganti).
  .use(`${P}/*`, async (c, next) => {
    await next();
    if (c.get("booth") && c.req.method !== "GET" && c.res.status < 400)
      notifyLive(c, "refresh", true);
  })

  .put(`${P}/me`, keyed, async (c) => {
    const event = c.get("event") as EventRow;
    const booth = c.get("booth");
    const { changed } = await updateOwnProfile(
      getDb(c.env),
      event,
      booth,
      await parseBody(c, boothSelfUpdateSchema),
      serviceDeps(c),
    );
    if (changed.length > 0) {
      logEvent(c, {
        eventId: event.id,
        category: "booth",
        action: "booth.profile_updated",
        actor: { type: "booth", id: booth.id },
        target: { type: "booth", id: booth.id },
        meta: { fields: changed },
      });
    }
    return c.json(
      await boothMe(getDb(c.env), event, await getBoothRow(getDb(c.env), event.id, booth.id)),
    );
  })

  .post(`${P}/resubmit`, keyed, async (c) => {
    const event = c.get("event") as EventRow;
    const booth = c.get("booth");
    await resubmitBooth(getDb(c.env), booth, serviceDeps(c));
    logEvent(c, {
      eventId: event.id,
      category: "booth",
      action: "booth.resubmitted",
      actor: { type: "booth", id: booth.id },
      target: { type: "booth", id: booth.id },
    });
    return c.json({ ok: true });
  })

  // ---- foto dan logo ----
  .get(`${P}/photos`, async (c) =>
    c.json({ photos: await listBoothPhotos(getDb(c.env), c.get("booth").id) }),
  )
  .post(`${P}/media`, limit, keyed, async (c) => {
    const { kind, productId } = mediaQuery.parse(c.req.query());
    const event = c.get("event") as EventRow;
    const booth = c.get("booth");
    const db = getDb(c.env);
    const d = serviceDeps(c);
    const pair = await readUploadForm(c.req.raw, kind);

    let result: unknown;
    if (kind === "photo") {
      result = { photo: await addBoothPhoto(db, c.env.MEDIA, event.id, booth.id, pair, d) };
    } else if (kind === "logo") {
      result = await setBoothLogo(db, c.env.MEDIA, event.id, booth.id, pair, d);
    } else {
      if (!productId) throw new ApiError("validation_error", "productId_required");
      await ownProduct(c, productId);
      result = {
        product: await setProductPhoto(db, c.env.MEDIA, event.id, booth.id, productId, pair, d),
      };
    }
    logEvent(c, {
      eventId: event.id,
      category: "booth",
      action: "booth.media_uploaded",
      actor: { type: "booth", id: booth.id },
      target: { type: "booth", id: booth.id },
      meta: { kind },
    });
    return c.json(result, 201);
  })
  .delete(`${P}/photos/:pid`, keyed, async (c) =>
    c.json({
      photos: await deleteBoothPhoto(
        getDb(c.env),
        c.env.MEDIA,
        c.get("booth").eventId,
        c.get("booth").id,
        c.req.param("pid"),
        serviceDeps(c),
      ),
    }),
  )
  .put(`${P}/photos/order`, keyed, async (c) => {
    const { ids } = await parseBody(c, orderedIdsSchema);
    const b = c.get("booth");
    return c.json({
      photos: await reorderBoothPhotos(getDb(c.env), b.eventId, b.id, ids, serviceDeps(c)),
    });
  })
  .delete(`${P}/logo`, keyed, async (c) => {
    const b = c.get("booth");
    await removeBoothLogo(getDb(c.env), c.env.MEDIA, b.eventId, b.id, serviceDeps(c));
    return c.json({ ok: true });
  })

  // ---- produk (A14): sepenuhnya opsional ----
  .get(`${P}/products`, async (c) => {
    const b = c.get("booth");
    return c.json({ products: await listProducts(getDb(c.env), b.eventId, b.id) });
  })
  .post(`${P}/products`, keyed, async (c) => {
    const b = c.get("booth");
    const { termsConfirmed, ...input } = await parseBody(c, createProductSchema);
    const product = await createProduct(
      getDb(c.env),
      b.eventId,
      b.id,
      input,
      { termsConfirmed },
      serviceDeps(c),
    );
    logEvent(c, {
      eventId: b.eventId,
      category: "booth",
      action: "booth.product_created",
      actor: { type: "booth", id: b.id },
      target: { type: "product", id: product.id },
    });
    return c.json({ product }, 201);
  })
  .put(`${P}/products/order`, keyed, async (c) => {
    const { ids } = await parseBody(c, orderedIdsSchema);
    const b = c.get("booth");
    return c.json({
      products: await reorderProducts(getDb(c.env), b.eventId, b.id, ids, serviceDeps(c)),
    });
  })
  .patch(`${P}/products/:pid`, keyed, async (c) => {
    const patch = await parseBody(c, ownerProductPatchSchema);
    const b = c.get("booth");
    await ownProduct(c, c.req.param("pid"));
    const product = await updateProduct(
      getDb(c.env),
      b.eventId,
      b.id,
      c.req.param("pid"),
      patch,
      serviceDeps(c),
    );
    logEvent(c, {
      eventId: b.eventId,
      category: "booth",
      action: "booth.product_updated",
      actor: { type: "booth", id: b.id },
      target: { type: "product", id: product.id },
    });
    return c.json({ product });
  })
  .put(`${P}/products/:pid/featured`, keyed, async (c) => {
    const b = c.get("booth");
    await ownProduct(c, c.req.param("pid"));
    const products = await setFeatured(
      getDb(c.env),
      b.eventId,
      b.id,
      c.req.param("pid"),
      serviceDeps(c),
    );
    logEvent(c, {
      eventId: b.eventId,
      category: "booth",
      action: "booth.product_featured",
      actor: { type: "booth", id: b.id },
      target: { type: "product", id: c.req.param("pid") },
    });
    return c.json({ products });
  })
  .delete(`${P}/products/:pid/photo`, keyed, async (c) => {
    const b = c.get("booth");
    await ownProduct(c, c.req.param("pid"));
    const product = await removeProductPhoto(
      getDb(c.env),
      c.env.MEDIA,
      b.eventId,
      b.id,
      c.req.param("pid"),
      serviceDeps(c),
    );
    return c.json({ product });
  })
  .delete(`${P}/products/:pid`, keyed, async (c) => {
    const b = c.get("booth");
    await ownProduct(c, c.req.param("pid"));
    await deleteProduct(
      getDb(c.env),
      c.env.MEDIA,
      b.eventId,
      b.id,
      c.req.param("pid"),
      serviceDeps(c),
    );
    logEvent(c, {
      eventId: b.eventId,
      category: "booth",
      action: "booth.product_deleted",
      actor: { type: "booth", id: b.id },
      target: { type: "product", id: c.req.param("pid") },
    });
    return c.json({ ok: true });
  })

  // ---- WhatsApp (A14, B24): nomor milik sendiri, persetujuan dari pemilik ----
  .put(`${P}/whatsapp`, keyed, async (c) => {
    const b = c.get("booth");
    const input = await parseBody(c, boothSelfWhatsappSchema);
    const r = await setWhatsapp(
      getDb(c.env),
      b.eventId,
      b.id,
      { number: input.number, consent: input.consent, by: "owner" },
      serviceDeps(c),
    );
    logEvent(c, {
      eventId: b.eventId,
      category: "booth",
      action: r.removed ? "booth.whatsapp_removed" : "booth.whatsapp_set",
      actor: { type: "booth", id: b.id },
      target: { type: "booth", id: b.id },
    });
    return c.json({ ok: true });
  })

  // ---- ulasan masuk (baca saja) dan laporan ----
  .get(`${P}/reviews`, async (c) => {
    const event = c.get("event") as EventRow;
    const b = c.get("booth");
    // Booth yang belum tayang belum punya ulasan; daftar publik hanya melayani booth `approved`.
    if (b.status !== "approved") return c.json({ reviews: [], next: null });
    return c.json(
      await listPublicReviews(
        getDb(c.env),
        event,
        b.id,
        visibility(event).ratings,
        c.req.query("cursor"),
      ),
    );
  })
  .post(`${P}/reviews/:rid/report`, keyed, async (c) => {
    const event = c.get("event") as EventRow;
    const b = c.get("booth");
    const body = await parseBody(c, boothReportSchema);
    const r = await reportReviewAsBooth(getDb(c.env), serviceDeps(c), {
      eventId: event.id,
      boothId: b.id,
      reviewId: c.req.param("rid"),
      reason: body.reason,
      note: body.note,
    });
    if (!r.alreadyReported) {
      logEvent(c, {
        eventId: event.id,
        category: "booth",
        action: "booth.report_sent",
        actor: { type: "booth", id: b.id },
        target: { type: "review", id: c.req.param("rid") },
      });
    }
    return c.json({ ok: true, alreadyReported: r.alreadyReported });
  });
