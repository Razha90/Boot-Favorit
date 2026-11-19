import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { events, reviewCategories } from "../../db/schema";
import { adminHarness } from "../../test/admin";
import { TIMES } from "../../test/fixtures";

const newEvent = (over: Record<string, unknown> = {}) => ({
  name: "Penilaian Booth Terfavorit LPPM Expo Tahun 2026",
  ...TIMES,
  ...over,
});

describe("akses admin", () => {
  it("/api/admin/* menolak tanpa kredensial admin dan tidak pernah dibekukan", async () => {
    const h = adminHarness();
    const noAuth = await h.call("GET", "/api/admin/events", undefined, {
      extraEnv: { DEV_ADMIN_EMAIL: undefined },
    });
    expect(noAuth.status).toBe(401);
    expect((await h.call("GET", "/api/admin/events")).status).toBe(200);
  });
});

describe("POST /api/admin/events", () => {
  it("membuat event draft dengan slug otomatis dan kategori ulasan bawaan", async () => {
    const h = adminHarness();
    const r = await h.call("POST", "/api/admin/events", newEvent());
    expect(r.status).toBe(201);
    expect(r.json.event).toMatchObject({
      slug: "penilaian-booth-terfavorit-lppm-expo-tahun-2026",
      isActive: false,
      visibility: "draft",
      timezone: "Asia/Jakarta",
      schedule: { ...TIMES, allowLateRegistration: true },
    });
    const cats = await h.t.db.select().from(reviewCategories);
    expect(cats.map((c) => c.label)).toEqual([
      "Inovatif",
      "Ramah",
      "Seru",
      "Bermanfaat",
      "Kreatif",
      "Rapi",
    ]);
  });

  it("slug kembar mendapat akhiran; slug eksplisit yang kembar ditolak", async () => {
    const h = adminHarness();
    await h.call("POST", "/api/admin/events", newEvent({ name: "Expo" }));
    const second = await h.call("POST", "/api/admin/events", newEvent({ name: "Expo" }));
    expect(second.json.event.slug).toBe("expo-2");
    const dup = await h.call("POST", "/api/admin/events", newEvent({ name: "Lain", slug: "expo" }));
    expect(dup.status).toBe(409);
  });

  it("menolak jadwal yang tidak masuk akal dengan kode validasi", async () => {
    const h = adminHarness();
    for (const bad of [
      { eventEndAt: 3000 },
      { registrationCloseAt: 500 },
      { registrationCloseAt: 9000 },
      { timezone: "Mars/Olympus" },
      { name: "   " },
    ]) {
      const r = await h.call("POST", "/api/admin/events", newEvent(bad));
      expect(r.status, JSON.stringify(bad)).toBe(400);
      expect(r.json.code).toBe("validation_error");
    }
  });

  it("wajib Idempotency-Key; klik ganda dengan kunci sama hanya membuat satu event", async () => {
    const h = adminHarness();
    expect((await h.call("POST", "/api/admin/events", newEvent(), { key: false })).status).toBe(
      400,
    );

    const key = crypto.randomUUID();
    const a = await h.call("POST", "/api/admin/events", newEvent(), { key });
    const b = await h.call("POST", "/api/admin/events", newEvent(), { key });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(b.headers.get("Idempotent-Replay")).toBe("true");
    expect(b.json.event.id).toBe(a.json.event.id);
    expect(await h.t.db.select().from(events)).toHaveLength(1);
  });
});

describe("aktivasi event (A0)", () => {
  async function two(h: ReturnType<typeof adminHarness>) {
    const a = (await h.call("POST", "/api/admin/events", newEvent({ name: "Event A" }))).json.event;
    const b = (await h.call("POST", "/api/admin/events", newEvent({ name: "Event B" }))).json.event;
    return { a, b };
  }

  it("menjadikan event aktif sekaligus menerbitkannya dan menaikkan versi", async () => {
    const h = adminHarness();
    const { a } = await two(h);
    const r = await h.call("POST", `/api/admin/events/${a.id}/activate`);
    expect(r.status).toBe(200);
    expect(r.json.event).toMatchObject({
      isActive: true,
      visibility: "published",
      hiddenFromPublic: false,
    });
    expect(r.json.event.versions.active).toBe(1);
  });

  it("tepat satu event aktif: mengaktifkan yang lain menonaktifkan yang lama", async () => {
    const h = adminHarness();
    const { a, b } = await two(h);
    await h.call("POST", `/api/admin/events/${a.id}/activate`);
    await h.call("POST", `/api/admin/events/${b.id}/activate`);
    const rows = await h.t.db.select().from(events);
    expect(rows.filter((e) => e.isActive === 1).map((e) => e.id)).toEqual([b.id]);
  });

  it("mengaktifkan yang sudah aktif tidak menaikkan versi lagi", async () => {
    const h = adminHarness();
    const { a } = await two(h);
    await h.call("POST", `/api/admin/events/${a.id}/activate`);
    const again = await h.call("POST", `/api/admin/events/${a.id}/activate`);
    expect(again.json.event.versions.active).toBe(1);
  });

  it("event aktif muncul di GET /api/event publik; yang disembunyikan tidak", async () => {
    const h = adminHarness();
    const { a } = await two(h);
    const pub = async () =>
      (await h.call("GET", "/api/event")).json.event as { name: string } | null;
    expect(await pub()).toBeNull();
    await h.call("POST", `/api/admin/events/${a.id}/activate`);
    expect((await pub())?.name).toBe("Event A");
    await h.call("POST", `/api/admin/events/${a.id}/hide`);
    expect(await pub()).toBeNull(); // halaman utama menjadi "Segera hadir"
    await h.call("POST", `/api/admin/events/${a.id}/unhide`);
    expect((await pub())?.name).toBe("Event A");
  });

  it("event tidak ada → 404", async () => {
    const h = adminHarness();
    const r = await h.call("POST", "/api/admin/events/tidak-ada/activate");
    expect(r.status).toBe(404);
  });
});

describe("PUT /api/admin/events/:id (jadwal dinamis, B17)", () => {
  async function created() {
    const h = adminHarness();
    const e = (await h.call("POST", "/api/admin/events", newEvent())).json.event;
    return { h, e };
  }

  it("mengubah jadwal sebagian dan menghitung peringatan lunak", async () => {
    const { h, e } = await created();
    const r = await h.call("PUT", `/api/admin/events/${e.id}`, { registrationCloseAt: 3500 });
    expect(r.status).toBe(200);
    expect(r.json.event.schedule.registrationCloseAt).toBe(3500);
    expect(r.json.event.warnings).toContain("registration_closes_after_event_start");
  });

  it("memvalidasi jadwal gabungan (nilai baru + lama)", async () => {
    const { h, e } = await created();
    // eventEnd dimajukan sebelum registrationClose lama → melanggar aturan
    const r = await h.call("PUT", `/api/admin/events/${e.id}`, { eventEndAt: 1500 });
    expect(r.status).toBe(400);
  });

  it("mengubah nama, sorotan judul, dan pengaturan per-event", async () => {
    const { h, e } = await created();
    const r = await h.call("PUT", `/api/admin/events/${e.id}`, {
      name: "Nama Baru",
      titleHighlight: "Terfavorit",
      settings: { maxProducts: 10, allowLateRegistration: false },
    });
    expect(r.json.event).toMatchObject({
      name: "Nama Baru",
      titleHighlight: "Terfavorit",
      settings: { maxProducts: 10, allowLateRegistration: false },
    });
    // Pengaturan digabung, bukan ditimpa.
    const r2 = await h.call("PUT", `/api/admin/events/${e.id}`, { settings: { maxProducts: 12 } });
    expect(r2.json.event.settings).toEqual({ maxProducts: 12, allowLateRegistration: false });
  });

  it("batas produk di luar 1..100 ditolak", async () => {
    const { h, e } = await created();
    for (const maxProducts of [0, 101, 2.5]) {
      const r = await h.call("PUT", `/api/admin/events/${e.id}`, { settings: { maxProducts } });
      expect(r.status).toBe(400);
    }
  });

  it("perubahan pada event aktif menaikkan stats_version (kunci cache)", async () => {
    const { h, e } = await created();
    await h.call("POST", `/api/admin/events/${e.id}/activate`);
    const r = await h.call("PUT", `/api/admin/events/${e.id}`, { name: "Ganti" });
    expect(r.json.event.versions.stats).toBe(1);
  });

  it("event yang sudah selesai tetap bisa diubah admin, termasuk dibuka kembali", async () => {
    const { h, e } = await created();
    await h.call("POST", `/api/admin/events/${e.id}/activate`);
    h.clk.t = 5000;
    expect((await h.call("GET", `/api/admin/events/${e.id}`)).json.event.state.frozen).toBe(true);
    const r = await h.call("PUT", `/api/admin/events/${e.id}`, { eventEndAt: 9000 });
    expect(r.status).toBe(200);
    expect(r.json.event.state.frozen).toBe(false);
  });

  it("pintasan: tutup pendaftaran sekarang dan perpanjang", async () => {
    const { h, e } = await created();
    h.clk.t = 1500;
    const closed = await h.call("POST", `/api/admin/events/${e.id}/close-registration`);
    expect(closed.json.event.schedule.registrationCloseAt).toBe(1500);
    expect(closed.json.event.state.registrationButtonVisible).toBe(false);

    const day = 86_400_000;
    const extended = await h.call("POST", `/api/admin/events/${e.id}/extend-registration`, {
      byMs: day,
    });
    // Dihitung dari "sekarang" bila sudah lewat; ditolak bila melewati event selesai (aturan B17).
    expect(extended.status).toBe(400);
  });

  it("perpanjang pendaftaran dalam batas jadwal", async () => {
    const h = adminHarness();
    const day = 86_400_000;
    const e = (
      await h.call(
        "POST",
        "/api/admin/events",
        newEvent({
          registrationOpenAt: 0,
          registrationCloseAt: 1000,
          eventStartAt: 7 * day,
          eventEndAt: 8 * day,
        }),
      )
    ).json.event;
    const r = await h.call("POST", `/api/admin/events/${e.id}/extend-registration`, { byMs: day });
    expect(r.status).toBe(200);
    expect(r.json.event.schedule.registrationCloseAt).toBe(1500 + day);
  });
});

describe("kategori ulasan (A5)", () => {
  it("tambah, ganti nama, ubah urutan, dan nonaktifkan; tidak pernah dihapus", async () => {
    const h = adminHarness();
    const e = (await h.call("POST", "/api/admin/events", newEvent())).json.event;
    const list = (await h.call("GET", `/api/admin/e/${e.id}/review-categories`)).json
      .categories as { id: string; label: string; active: number }[];
    expect(list).toHaveLength(6);
    const [inovatif, ramah, seru] = list;

    const r = await h.call("PUT", `/api/admin/e/${e.id}/review-categories`, {
      categories: [
        { id: seru?.id, label: "Seru Banget", active: true }, // diganti nama dan dipindah ke atas
        { id: inovatif?.id, label: "Inovatif", active: false }, // dinonaktifkan
        { label: "Unik", active: true }, // baru
        // "ramah" dan sisanya tidak disebut → dinonaktifkan (bukan dihapus)
      ],
    });
    expect(r.status).toBe(200);
    const after = r.json.categories as {
      id: string;
      label: string;
      active: number;
      position: number;
    }[];
    expect(after).toHaveLength(7); // 6 lama + 1 baru; tidak ada yang dihapus
    const byId = new Map(after.map((c) => [c.id, c]));
    expect(byId.get(seru?.id ?? "")).toMatchObject({
      label: "Seru Banget",
      active: 1,
      position: 0,
    });
    expect(byId.get(inovatif?.id ?? "")).toMatchObject({ active: 0 });
    expect(byId.get(ramah?.id ?? "")).toMatchObject({ active: 0 });

    // Publik hanya melihat yang aktif, berurutan.
    await h.call("POST", `/api/admin/events/${e.id}/activate`);
    const pub = (await h.call("GET", "/api/event")).json.event.reviewCategories as {
      label: string;
    }[];
    expect(pub.map((c) => c.label)).toEqual(["Seru Banget", "Unik"]);
  });

  it("menolak id yang bukan milik event dan id ganda", async () => {
    const h = adminHarness();
    const e = (await h.call("POST", "/api/admin/events", newEvent())).json.event;
    const first = (
      await h.t.db.select().from(reviewCategories).where(eq(reviewCategories.eventId, e.id))
    )[0];
    const bad = await h.call("PUT", `/api/admin/e/${e.id}/review-categories`, {
      categories: [{ id: "bukan-milik-event", label: "X", active: true }],
    });
    expect(bad.status).toBe(400);
    const dup = await h.call("PUT", `/api/admin/e/${e.id}/review-categories`, {
      categories: [
        { id: first?.id, label: "A", active: true },
        { id: first?.id, label: "B", active: true },
      ],
    });
    expect(dup.status).toBe(400);
  });
});
