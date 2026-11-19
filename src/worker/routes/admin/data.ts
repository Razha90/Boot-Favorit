// Data Grid admin (explore.md A3 langkah 8, B10, B18): daftar per entity, simpan massal, ekspor CSV.
// Hanya admin (Cloudflare Access); tidak melewati eventWriteGate, jadi berfungsi penuh setelah event selesai.

import { bulkEditSchema, GRID_ENTITIES, type GridEntity, gridQuerySchema } from "@shared/data-grid";
import type { LogAction } from "@shared/log-events";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../app-env";
import { booths } from "../../db/schema";
import { getDb } from "../../lib/db";
import type { EmailSender } from "../../lib/email";
import { adminIdempotencyActor, logAdmin, parseBody, serviceDeps } from "../../lib/http";
import { mailOwner } from "../../lib/owner-mail";
import { idempotency } from "../../middleware/idempotency";
import { exportCsvStream, queryGrid } from "../../services/data";
import { bulkEdit } from "../../services/data/bulk";
import { getEventOrThrow } from "../../services/events";

const keyed = idempotency({ required: true, actor: adminIdempotencyActor });
const entitySchema = z.enum(GRID_ENTITIES);
const P = "/api/admin/e/:id/data";

const ACTION: Record<string, LogAction> = {
  booths: "admin.booth_edited",
  products: "admin.product_edited",
  reviews: "admin.review_edited",
  visitors: "admin.visitor_edited",
};
const TYPE: Record<string, string> = {
  booths: "booth",
  products: "product",
  reviews: "review",
  visitors: "visitor",
};

/** Nilai di log dipotong: komentar bisa panjang dan memuat data pribadi (B13). */
const clip = (v: unknown) => (typeof v === "string" && v.length > 120 ? `${v.slice(0, 119)}…` : v);

export function createAdminDataRoutes(deps: { email?: EmailSender } = {}) {
  return new Hono<AppEnv>()
    .get(`${P}/:entity`, async (c) => {
      const eventId = c.req.param("id");
      const db = getDb(c.env);
      await getEventOrThrow(db, eventId);
      const entity = entitySchema.parse(c.req.param("entity"));
      return c.json(await queryGrid(db, eventId, entity, gridQuerySchema.parse(c.req.query())));
    })

    .patch(`${P}/bulk`, keyed, async (c) => {
      const eventId = c.req.param("id");
      const db = getDb(c.env);
      await getEventOrThrow(db, eventId);
      const input = await parseBody(c, bulkEditSchema);
      const out = await bulkEdit(db, eventId, input, serviceDeps(c), c.get("admin").email);

      // Satu entri log per perubahan: nilai sebelum/sesudah dan alasan (B18).
      for (const a of out.appliedChanges) {
        await logAdmin(c, eventId, {
          action: ACTION[a.entity] as LogAction,
          target: { type: TYPE[a.entity] as string, id: a.id },
          msg: input.reason.slice(0, 200),
          meta: { via: "grid", field: a.field, before: clip(a.before), after: clip(a.after) },
        });
      }
      // Status booth berubah lewat grid: pemilik diberi tahu seperti pada rute booth biasa.
      for (const a of out.appliedChanges) {
        if (a.entity !== "booths" || a.field !== "status" || a.after === "pending") continue;
        const b = await db.select().from(booths).where(eq(booths.id, a.id)).get();
        if (b) {
          await mailOwner(c, deps.email, a.after as "approved", {
            to: b.email,
            eventId,
            boothName: b.name,
            reason: b.rejectReason,
          });
        }
      }
      return c.json({ applied: out.applied, results: out.results });
    })

    .get(`${P}/:entity/export`, async (c) => {
      const eventId = c.req.param("id");
      const db = getDb(c.env);
      await getEventOrThrow(db, eventId);
      const entity: GridEntity = entitySchema.parse(c.req.param("entity"));
      const q = gridQuerySchema.parse(c.req.query());
      await logAdmin(c, eventId, {
        action: "admin.data_exported",
        meta: { entity, filters: q.filters.length, q: Boolean(q.q) },
      });
      return new Response(exportCsvStream(db, eventId, entity, q), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${entity}-${eventId.slice(0, 8)}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    });
}
