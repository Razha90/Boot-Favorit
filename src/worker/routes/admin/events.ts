import {
  createEventSchema,
  extendRegistrationSchema,
  reviewCategoriesSchema,
  updateEventSchema,
} from "@shared/schemas";
import { Hono } from "hono";
import type { AppEnv } from "../../app-env";
import { getDb } from "../../lib/db";
import { adminIdempotencyActor, logAdmin, parseBody, serviceDeps } from "../../lib/http";
import { idempotency } from "../../middleware/idempotency";
import {
  activateEvent,
  adminEventView,
  closeRegistrationNow,
  createEvent,
  extendRegistration,
  getEventOrThrow,
  listCategories,
  listEvents,
  replaceCategories,
  setHiddenFromPublic,
  updateEvent,
} from "../../services/events";

const keyed = idempotency({ required: true, actor: adminIdempotencyActor });

export const adminEventRoutes = new Hono<AppEnv>()
  .get("/api/admin/events", async (c) => {
    const rows = await listEvents(getDb(c.env));
    const now = c.get("now")();
    return c.json({ events: rows.map((e) => adminEventView(e, now)) });
  })

  .post("/api/admin/events", keyed, async (c) => {
    const d = serviceDeps(c);
    const event = await createEvent(getDb(c.env), await parseBody(c, createEventSchema), d);
    await logAdmin(c, event.id, {
      action: "admin.event_created",
      target: { type: "event", id: event.id },
    });
    return c.json({ event: adminEventView(event, d.now) }, 201);
  })

  .get("/api/admin/events/:id", async (c) => {
    const event = await getEventOrThrow(getDb(c.env), c.req.param("id"));
    return c.json({ event: adminEventView(event, c.get("now")()) });
  })

  .put("/api/admin/events/:id", async (c) => {
    const d = serviceDeps(c);
    const r = await updateEvent(
      getDb(c.env),
      c.req.param("id"),
      await parseBody(c, updateEventSchema),
      d,
    );
    const target = { type: "event", id: r.event.id };
    if (r.scheduleChanged) {
      await logAdmin(c, r.event.id, {
        action: "admin.schedule_changed",
        target,
        meta: { before: r.scheduleChanged.before, after: r.scheduleChanged.after },
      });
    }
    if (r.settingsChanged) {
      await logAdmin(c, r.event.id, { action: "admin.event_settings_changed", target });
    }
    return c.json({ event: adminEventView(r.event, d.now) });
  })

  .post("/api/admin/events/:id/activate", keyed, async (c) => {
    const d = serviceDeps(c);
    const event = await activateEvent(getDb(c.env), c.req.param("id"), d);
    await logAdmin(c, event.id, {
      action: "admin.event_activated",
      target: { type: "event", id: event.id },
    });
    return c.json({ event: adminEventView(event, d.now) });
  })

  .post("/api/admin/events/:id/hide", keyed, async (c) => {
    const d = serviceDeps(c);
    const event = await setHiddenFromPublic(getDb(c.env), c.req.param("id"), true, d);
    await logAdmin(c, event.id, {
      action: "admin.event_hidden",
      target: { type: "event", id: event.id },
      meta: { hidden: true },
    });
    return c.json({ event: adminEventView(event, d.now) });
  })

  .post("/api/admin/events/:id/unhide", keyed, async (c) => {
    const d = serviceDeps(c);
    const event = await setHiddenFromPublic(getDb(c.env), c.req.param("id"), false, d);
    await logAdmin(c, event.id, {
      action: "admin.event_hidden",
      target: { type: "event", id: event.id },
      meta: { hidden: false },
    });
    return c.json({ event: adminEventView(event, d.now) });
  })

  .post("/api/admin/events/:id/close-registration", keyed, async (c) => {
    const d = serviceDeps(c);
    const r = await closeRegistrationNow(getDb(c.env), c.req.param("id"), d);
    await logAdmin(c, r.event.id, {
      action: "admin.schedule_changed",
      target: { type: "event", id: r.event.id },
      meta: {
        shortcut: "close_registration",
        before: r.scheduleChanged?.before,
        after: r.scheduleChanged?.after,
      },
    });
    return c.json({ event: adminEventView(r.event, d.now) });
  })

  .post("/api/admin/events/:id/extend-registration", keyed, async (c) => {
    const d = serviceDeps(c);
    const { byMs } = await parseBody(c, extendRegistrationSchema);
    const r = await extendRegistration(getDb(c.env), c.req.param("id"), byMs, d);
    await logAdmin(c, r.event.id, {
      action: "admin.schedule_changed",
      target: { type: "event", id: r.event.id },
      meta: {
        shortcut: "extend_registration",
        byMs,
        before: r.scheduleChanged?.before,
        after: r.scheduleChanged?.after,
      },
    });
    return c.json({ event: adminEventView(r.event, d.now) });
  })

  .get("/api/admin/e/:id/review-categories", async (c) => {
    const db = getDb(c.env);
    await getEventOrThrow(db, c.req.param("id"));
    return c.json({ categories: await listCategories(db, c.req.param("id")) });
  })

  .put("/api/admin/e/:id/review-categories", keyed, async (c) => {
    const d = serviceDeps(c);
    const eventId = c.req.param("id");
    const categories = await replaceCategories(
      getDb(c.env),
      eventId,
      await parseBody(c, reviewCategoriesSchema),
      d,
    );
    await logAdmin(c, eventId, {
      action: "admin.categories_changed",
      target: { type: "event", id: eventId },
    });
    return c.json({ categories });
  });
