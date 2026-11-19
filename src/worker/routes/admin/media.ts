import { ApiError } from "@shared/errors";
import { orderedIdsSchema } from "@shared/schemas";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import type { AppEnv } from "../../app-env";
import { getDb } from "../../lib/db";
import {
  adminActor,
  adminIdempotencyActor,
  logAdmin,
  parseBody,
  serviceDeps,
} from "../../lib/http";
import { logEvent } from "../../lib/logger";
import { idempotency } from "../../middleware/idempotency";
import { getBoothRow } from "../../services/booths";
import { limitKindOf, removeEventMedia, setEventMedia } from "../../services/event-media";
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
import { removeProductPhoto, setProductPhoto } from "../../services/products";

const keyed = idempotency({ required: true, actor: adminIdempotencyActor });
const queryShape = z.object({
  kind: z.enum(["photo", "logo", "product"]),
  productId: z.string().min(1).optional(),
});
const eventMediaQuery = z.object({
  kind: z.enum(["logo", "og", "hero"]),
  slot: z.coerce.number().int().min(0).default(0),
});
const KINDS: MediaKind[] = ["photo", "logo", "product"];

// Batas dipasang SEBELUM idempotensi (yang membaca seluruh badan untuk hash). Dua lapis: header dan aliran.
const limit = bodyLimit({
  maxSize: Math.max(...KINDS.map(maxUploadBytes)),
  onError: (c) => c.json({ code: "payload_too_large" }, 413),
});

export const adminMediaRoutes = new Hono<AppEnv>()
  .get("/api/admin/e/:id/booths/:bid/photos", async (c) => {
    const db = getDb(c.env);
    await getBoothRow(db, c.req.param("id"), c.req.param("bid")); // booth harus ada di event ini
    return c.json({ photos: await listBoothPhotos(db, c.req.param("bid")) });
  })

  // Unggah gambar: satu permintaan multipart berisi `full` dan `thumb` (WebP hasil konversi di client).
  .post("/api/admin/e/:id/booths/:bid/media", limit, keyed, async (c) => {
    const { kind, productId } = queryShape.parse(c.req.query());
    const eventId = c.req.param("id");
    const boothId = c.req.param("bid");
    const db = getDb(c.env);
    const d = serviceDeps(c);
    const pair = await readUploadForm(c.req.raw, kind);

    let result: unknown;
    if (kind === "photo") {
      result = { photo: await addBoothPhoto(db, c.env.MEDIA, eventId, boothId, pair, d) };
    } else if (kind === "logo") {
      result = await setBoothLogo(db, c.env.MEDIA, eventId, boothId, pair, d);
    } else {
      if (!productId) throw new ApiError("validation_error", "productId_required");
      result = {
        product: await setProductPhoto(db, c.env.MEDIA, eventId, boothId, productId, pair, d),
      };
    }
    logEvent(c, {
      eventId,
      category: "booth",
      action: "booth.media_uploaded",
      actor: await adminActor(c),
      target: { type: "booth", id: boothId },
      meta: { kind },
    });
    return c.json(result, 201);
  })

  .delete("/api/admin/e/:id/booths/:bid/photos/:pid", keyed, async (c) => {
    const photos = await deleteBoothPhoto(
      getDb(c.env),
      c.env.MEDIA,
      c.req.param("id"),
      c.req.param("bid"),
      c.req.param("pid"),
      serviceDeps(c),
    );
    return c.json({ photos });
  })

  .put("/api/admin/e/:id/booths/:bid/photos/order", keyed, async (c) => {
    const { ids } = await parseBody(c, orderedIdsSchema);
    const photos = await reorderBoothPhotos(
      getDb(c.env),
      c.req.param("id"),
      c.req.param("bid"),
      ids,
      serviceDeps(c),
    );
    return c.json({ photos });
  })

  .delete("/api/admin/e/:id/booths/:bid/logo", keyed, async (c) => {
    await removeBoothLogo(
      getDb(c.env),
      c.env.MEDIA,
      c.req.param("id"),
      c.req.param("bid"),
      serviceDeps(c),
    );
    return c.json({ ok: true });
  })

  // ---- gambar EVENT: logo, OG, kolase hero (opsional; A12, A16) ----
  .post("/api/admin/e/:id/media", limit, keyed, async (c) => {
    const { kind, slot } = eventMediaQuery.parse(c.req.query());
    const eventId = c.req.param("id");
    const pair = await readUploadForm(c.req.raw, limitKindOf(kind));
    const media = await setEventMedia(
      getDb(c.env),
      c.env.MEDIA,
      eventId,
      kind,
      slot,
      pair,
      serviceDeps(c),
    );
    await logAdmin(c, eventId, {
      action: "admin.event_media_changed",
      target: { type: "event", id: eventId },
      meta: { kind, op: "set" },
    });
    return c.json({ media }, 201);
  })

  .delete("/api/admin/e/:id/media", keyed, async (c) => {
    const { kind, slot } = eventMediaQuery.parse(c.req.query());
    const eventId = c.req.param("id");
    const media = await removeEventMedia(
      getDb(c.env),
      c.env.MEDIA,
      eventId,
      kind,
      slot,
      serviceDeps(c),
    );
    await logAdmin(c, eventId, {
      action: "admin.event_media_changed",
      target: { type: "event", id: eventId },
      meta: { kind, op: "remove" },
    });
    return c.json({ media });
  })

  .delete("/api/admin/e/:id/booths/:bid/products/:pid/photo", keyed, async (c) => {
    const product = await removeProductPhoto(
      getDb(c.env),
      c.env.MEDIA,
      c.req.param("id"),
      c.req.param("bid"),
      c.req.param("pid"),
      serviceDeps(c),
    );
    return c.json({ product });
  });
