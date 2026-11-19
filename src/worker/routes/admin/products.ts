import { createProductSchema, orderedIdsSchema, productPatchSchema } from "@shared/schemas";
import { Hono } from "hono";
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
import {
  createProduct,
  deleteProduct,
  listProducts,
  reorderProducts,
  setFeatured,
  updateProduct,
} from "../../services/products";

const keyed = idempotency({ required: true, actor: adminIdempotencyActor });
const base = "/api/admin/e/:id/booths/:bid/products";

export const adminProductRoutes = new Hono<AppEnv>()
  .get(base, async (c) =>
    c.json({ products: await listProducts(getDb(c.env), c.req.param("id"), c.req.param("bid")) }),
  )

  .post(base, keyed, async (c) => {
    const { termsConfirmed, ...input } = await parseBody(c, createProductSchema);
    const product = await createProduct(
      getDb(c.env),
      c.req.param("id"),
      c.req.param("bid"),
      input,
      { termsConfirmed },
      serviceDeps(c),
    );
    logEvent(c, {
      eventId: c.req.param("id"),
      category: "booth",
      action: "booth.product_created",
      actor: await adminActor(c),
      target: { type: "product", id: product.id },
    });
    return c.json({ product }, 201);
  })

  // Urutan: [pid, ...]. Didaftarkan sebelum rute /:pid agar "order" tidak dianggap id produk.
  .put(`${base}/order`, keyed, async (c) => {
    const { ids } = await parseBody(c, orderedIdsSchema);
    const products = await reorderProducts(
      getDb(c.env),
      c.req.param("id"),
      c.req.param("bid"),
      ids,
      serviceDeps(c),
    );
    return c.json({ products });
  })

  .patch(`${base}/:pid`, async (c) => {
    const patch = await parseBody(c, productPatchSchema);
    const eventId = c.req.param("id");
    const product = await updateProduct(
      getDb(c.env),
      eventId,
      c.req.param("bid"),
      c.req.param("pid"),
      patch,
      serviceDeps(c),
    );
    const target = { type: "product", id: product.id };
    if (patch.status === "removed_by_admin") {
      await logAdmin(c, eventId, { action: "admin.product_removed", target });
    } else {
      logEvent(c, {
        eventId,
        category: "booth",
        action: "booth.product_updated",
        actor: await adminActor(c),
        target,
      });
    }
    return c.json({ product });
  })

  .put(`${base}/:pid/featured`, keyed, async (c) => {
    const eventId = c.req.param("id");
    const products = await setFeatured(
      getDb(c.env),
      eventId,
      c.req.param("bid"),
      c.req.param("pid"),
      serviceDeps(c),
    );
    logEvent(c, {
      eventId,
      category: "booth",
      action: "booth.product_featured",
      actor: await adminActor(c),
      target: { type: "product", id: c.req.param("pid") },
    });
    return c.json({ products });
  })

  .delete(`${base}/:pid`, keyed, async (c) => {
    const eventId = c.req.param("id");
    await deleteProduct(
      getDb(c.env),
      c.env.MEDIA,
      eventId,
      c.req.param("bid"),
      c.req.param("pid"),
      serviceDeps(c),
    );
    logEvent(c, {
      eventId,
      category: "booth",
      action: "booth.product_deleted",
      actor: await adminActor(c),
      target: { type: "product", id: c.req.param("pid") },
    });
    return c.json({ ok: true });
  });
