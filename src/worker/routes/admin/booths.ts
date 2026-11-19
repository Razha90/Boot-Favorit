import type { BoothStatus } from "@shared/api-types";
import {
  boothOwnerSchema,
  boothWhatsappSchema,
  createBoothSchema,
  importBoothsSchema,
  listBoothsQuerySchema,
  updateBoothSchema,
} from "@shared/schemas";
import { Hono } from "hono";
import type { AppContext, AppEnv } from "../../app-env";
import { type BoothMailKind, boothMail } from "../../lib/booth-mail";
import { getDb } from "../../lib/db";
import type { EmailSender } from "../../lib/email";
import { deliver } from "../../lib/email";
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
  createBoothByAdmin,
  getBoothView,
  importBooths,
  listBooths,
  markInvited,
  setOwner,
  setWhatsappByAdmin,
  updateBooth,
} from "../../services/booths";

const keyed = idempotency({ required: true, actor: adminIdempotencyActor });
const STATUS_ACTION = {
  approved: "booth.approved",
  rejected: "booth.rejected",
  suspended: "booth.suspended",
} as const;

/** Kirim email ke pemilik booth. Gagal kirim TIDAK menggagalkan aksi admin (dicatat di log). */
async function mailOwner(
  c: AppContext,
  sender: EmailSender | undefined,
  kind: BoothMailKind,
  o: { to: string | null; eventId: string; boothName: string; reason?: string | null },
): Promise<boolean> {
  if (!o.to) return false;
  const event = c.get("event");
  try {
    const sent = await deliver(
      c,
      sender,
      boothMail(kind, {
        to: o.to,
        eventName: event?.name ?? "",
        boothName: o.boothName,
        reason: o.reason,
        origin: new URL(c.req.url).origin,
      }),
    );
    if (sent)
      logEvent(c, { eventId: o.eventId, category: "system", action: "email.sent", meta: { kind } });
    return sent;
  } catch {
    logEvent(c, {
      eventId: o.eventId,
      category: "system",
      action: "email.failed",
      level: "warn",
      meta: { kind },
    });
    return false;
  }
}

export function createAdminBoothRoutes(deps: { email?: EmailSender } = {}) {
  return (
    new Hono<AppEnv>()
      .get("/api/admin/e/:id/booths", async (c) => {
        const filters = listBoothsQuerySchema.parse(c.req.query());
        return c.json({ booths: await listBooths(getDb(c.env), c.req.param("id"), filters) });
      })

      .post("/api/admin/e/:id/booths", keyed, async (c) => {
        const eventId = c.req.param("id");
        const booth = await createBoothByAdmin(
          getDb(c.env),
          eventId,
          await parseBody(c, createBoothSchema),
          serviceDeps(c),
          c.get("admin").email,
        );
        await logAdmin(c, eventId, {
          action: "admin.booth_created",
          target: { type: "booth", id: booth.id },
          meta: { ownerState: booth.ownerState },
        });
        return c.json({ booth }, 201);
      })

      .post("/api/admin/e/:id/booths/import", keyed, async (c) => {
        const eventId = c.req.param("id");
        const summary = await importBooths(
          getDb(c.env),
          eventId,
          await parseBody(c, importBoothsSchema),
          serviceDeps(c),
          c.get("admin").email,
        );
        // Satu entri ringkas (tanpa isi berkas) + satu entri per booth yang dibuat (B26).
        await logAdmin(c, eventId, {
          action: "admin.booths_imported",
          meta: { created: summary.created, skipped: summary.skipped, errors: summary.errors },
        });
        for (const r of summary.results) {
          if (r.status === "created") {
            await logAdmin(c, eventId, {
              action: "admin.booth_created",
              target: { type: "booth", id: r.id },
              meta: { via: "csv" },
            });
          }
        }
        return c.json(summary);
      })

      .get("/api/admin/e/:id/booths/:bid", async (c) => {
        return c.json({
          booth: await getBoothView(getDb(c.env), c.req.param("id"), c.req.param("bid")),
        });
      })

      .patch("/api/admin/e/:id/booths/:bid", async (c) => {
        const eventId = c.req.param("id");
        const { booth, changes } = await updateBooth(
          getDb(c.env),
          eventId,
          c.req.param("bid"),
          await parseBody(c, updateBoothSchema),
          serviceDeps(c),
          c.get("admin").email,
        );
        if (Object.keys(changes).length > 0) {
          const target = { type: "booth", id: booth.id };
          await logAdmin(c, eventId, { action: "admin.booth_edited", target, meta: { changes } });
          const status = changes.status?.after as BoothStatus | undefined;
          if (status && status !== "pending") {
            await mailOwner(c, deps.email, status, {
              to: booth.email,
              eventId,
              boothName: booth.name,
              reason: booth.rejectReason,
            });
          }
          if (status && status in STATUS_ACTION) {
            logEvent(c, {
              eventId,
              category: "booth",
              action: STATUS_ACTION[status as keyof typeof STATUS_ACTION],
              actor: await adminActor(c),
              target,
            });
          }
        }
        return c.json({ booth });
      })

      .put("/api/admin/e/:id/booths/:bid/owner", keyed, async (c) => {
        const eventId = c.req.param("id");
        const input = await parseBody(c, boothOwnerSchema);
        const r = await setOwner(
          getDb(c.env),
          eventId,
          c.req.param("bid"),
          input.email,
          input.reason,
          serviceDeps(c),
        );
        if (r.before.email !== r.after.email) {
          // Email tidak ditulis ke log: hanya status pemilik sebelum/sesudah.
          await logAdmin(c, eventId, {
            action: r.after.email === null ? "admin.booth_owner_removed" : "admin.booth_owner_set",
            target: { type: "booth", id: r.booth.id },
            meta: { before: r.before.state, after: r.after.state },
          });
        }
        return c.json({ booth: r.booth });
      })

      .put("/api/admin/e/:id/booths/:bid/whatsapp", keyed, async (c) => {
        const eventId = c.req.param("id");
        const input = await parseBody(c, boothWhatsappSchema);
        const r = await setWhatsappByAdmin(
          getDb(c.env),
          eventId,
          c.req.param("bid"),
          input.number,
          input.consentConfirmedByAdmin,
          serviceDeps(c),
        );
        logEvent(c, {
          eventId,
          category: "booth",
          action: r.removed ? "booth.whatsapp_removed" : "booth.whatsapp_set",
          actor: await adminActor(c),
          target: { type: "booth", id: r.booth.id },
        });
        return c.json({ booth: r.booth });
      })

      // Kirim email undangan ke pemilik (opsional; mengisi email saja tidak mengirim apa pun, A16).
      .post("/api/admin/e/:id/booths/:bid/invite", keyed, async (c) => {
        const eventId = c.req.param("id");
        const row = await markInvited(getDb(c.env), eventId, c.req.param("bid"), serviceDeps(c));
        const sent = await mailOwner(c, deps.email, "invite", {
          to: row.email,
          eventId,
          boothName: row.name,
        });
        await logAdmin(c, eventId, {
          action: "admin.booth_invite_sent",
          target: { type: "booth", id: row.id },
          meta: { sent },
        });
        return c.json({ sent });
      })
  );
}
