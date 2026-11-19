import { GRID_COLUMNS, type GridRow } from "@shared/data-grid";
import { completeness } from "@shared/visual";
import { describe, expect, it, vi } from "vitest";
import { SPECS } from "../../services/data/specs";
import { setOwnerEmail } from "../../test/booth";
import { directVisitor, fakeEmail, liveHarness, review } from "../../test/visitor";

type Ctx = Awaited<ReturnType<typeof liveHarness>>;

const grid = async (c: Ctx, entity: string, qs = "") =>
  c.h.call("GET", `/api/admin/e/${c.s.event.id}/data/${entity}${qs}`);
const bulk = (c: Ctx, body: unknown, opts?: { key?: string | false }) =>
  c.h.call("PATCH", `/api/admin/e/${c.s.event.id}/data/bulk`, body, opts);
const filters = (...f: { key: string; op: string; value: string }[]) =>
  `filters=${encodeURIComponent(JSON.stringify(f))}`;
const byName = (rows: GridRow[]) => rows.map((r) => r.values.name);

/** Tiga pengunjung menilai booth lengkap (5, 4, 2) dan satu menilai booth hanya-nama (1, dengan komentar). */
async function withReviews() {
  const c = await liveHarness();
  const given: Record<string, string> = {};
  for (const [i, stars] of [5, 4, 2].entries()) {
    const v = await directVisitor(c.h, c.s.event.id, { name: `Tamu${i}` });
    await review(v, c.s.lengkap.id, { stars, comment: i === 0 ? "Enak sekali" : undefined });
    given[`v${i}`] = v.visitor.id;
  }
  const v = await directVisitor(c.h, c.s.event.id, { name: "Dodi" });
  await review(v, c.s.hanyaNama.id, { stars: 1, comment: "Kurang ramah" });
  const rows = (await grid(c, "reviews")).json.rows as GridRow[];
  const rid = (stars: number, booth: string) =>
    rows.find((r) => r.values.stars === stars && r.values.boothName === booth) as GridRow;
  return { ...c, given, rid };
}

describe("definisi kolom", () => {
  it("peta kolom SQL tiap entity sama persis dengan GRID_COLUMNS (tidak ada kolom yatim)", () => {
    for (const [entity, spec] of Object.entries(SPECS)) {
      expect(Object.keys(spec.cols).sort(), entity).toEqual(
        GRID_COLUMNS[entity as keyof typeof GRID_COLUMNS].map((c) => c.key).sort(),
      );
    }
  });
});

describe("GET /data/:entity", () => {
  it("booth: urut nama, nilai per kolom, tanpa data entitas lain", async () => {
    const c = await liveHarness();
    const r = await grid(c, "booths");
    expect(r.status).toBe(200);
    expect(byName(r.json.rows)).toEqual(["Belum Tayang", "Es Teh Pak Budi", "Kopi Rempah"]);
    const kopi = r.json.rows.find((x: GridRow) => x.values.name === "Kopi Rempah");
    expect(kopi.values).toMatchObject({
      boothNo: "A12",
      owner: "none",
      status: "approved",
      isLate: false,
      createdBy: "admin",
      reviewCount: 0,
    });
    expect(typeof kopi.version).toBe("number");
    expect(r.json.summary.total).toBe(3);
  });

  it("entity tak dikenal: 400; event tak ada: 404", async () => {
    const c = await liveHarness();
    expect((await grid(c, "rahasia")).status).toBe(400);
    expect((await c.h.call("GET", "/api/admin/e/tidak-ada/data/booths")).status).toBe(404);
  });

  it("paginasi kursor: berjalan lewat semua baris tanpa ganda dan tanpa terlewat (asc dan desc)", async () => {
    const c = await liveHarness();
    for (const dir of ["asc", "desc"] as const) {
      const seen: unknown[] = [];
      let cursor: string | null = null;
      let pages = 0;
      do {
        const qs: string = `?limit=1&sort=name&dir=${dir}${cursor ? `&cursor=${cursor}` : ""}`;
        const r = await grid(c, "booths", qs);
        seen.push(...byName(r.json.rows));
        cursor = r.json.next;
        pages++;
      } while (cursor && pages < 10);
      const all = ["Belum Tayang", "Es Teh Pak Budi", "Kopi Rempah"];
      expect(seen).toEqual(dir === "asc" ? all : [...all].reverse());
    }
  });

  it("kursor rusak: 400", async () => {
    const c = await liveHarness();
    expect((await grid(c, "booths", "?cursor=%%%")).status).toBe(400);
  });

  it("urut dengan nilai seri (rating sama) tetap stabil lewat id", async () => {
    const c = await liveHarness();
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const r = await grid(
        c,
        "booths",
        `?limit=1&sort=reviewCount${cursor ? `&cursor=${cursor}` : ""}`,
      );
      seen.push(r.json.rows[0].id);
      cursor = r.json.next;
    } while (cursor);
    expect(new Set(seen).size).toBe(3);
  });

  it("filter: status, teks, angka, pilihan 'in'", async () => {
    const c = await withReviews();
    const by = async (...f: { key: string; op: string; value: string }[]) =>
      byName((await grid(c, "booths", `?${filters(...f)}`)).json.rows);
    expect(await by({ key: "status", op: "eq", value: "pending" })).toEqual(["Belum Tayang"]);
    expect(await by({ key: "name", op: "contains", value: "kopi" })).toEqual(["Kopi Rempah"]);
    expect(await by({ key: "reviewCount", op: "gte", value: "3" })).toEqual(["Kopi Rempah"]);
    expect(await by({ key: "reviewCount", op: "lte", value: "1" })).toEqual([
      "Belum Tayang",
      "Es Teh Pak Budi",
    ]);
    expect(await by({ key: "status", op: "in", value: "pending,approved" })).toHaveLength(3);
    expect(await by({ key: "average", op: "gte", value: "3" })).toEqual(["Kopi Rempah"]);
  });

  it("filter kelengkapan 'hanya nama' sejalan dengan fungsi completeness()", async () => {
    const c = await liveHarness();
    const r = await grid(c, "booths");
    const ids = new Map(r.json.rows.map((x: GridRow) => [x.id, x.values.completeness]));
    expect(ids.get(c.s.lengkap.id)).toBe(
      completeness({
        id: c.s.lengkap.id,
        name: "Kopi Rempah",
        boothNo: "A12",
        coverThumbKey: "ada",
        description: "Kopi dengan rempah pilihan.",
        tagline: "Hangat di lidah",
      }),
    );
    expect(ids.get(c.s.hanyaNama.id)).toBe("name_only");
    const only = await grid(
      c,
      "booths",
      `?${filters({ key: "completeness", op: "eq", value: "name_only" })}`,
    );
    expect(byName(only.json.rows)).toEqual(["Belum Tayang", "Es Teh Pak Budi"]);
  });

  it("pencarian global q; karakter LIKE (% _) dicari apa adanya", async () => {
    const c = await liveHarness();
    expect(byName((await grid(c, "booths", "?q=teh")).json.rows)).toEqual(["Es Teh Pak Budi"]);
    expect((await grid(c, "booths", `?q=${encodeURIComponent("%")}`)).json.rows).toHaveLength(0);
    expect((await grid(c, "booths", `?q=${encodeURIComponent("_")}`)).json.rows).toHaveLength(0);
  });

  it("masukan jahat: kolom/operator di luar whitelist ditolak; nilai SQL hanya diikat sebagai parameter", async () => {
    const c = await liveHarness();
    for (const qs of [
      "?sort=password",
      "?sort=description", // ada di whitelist kolom tetapi tidak sortable
      `?${filters({ key: "id", op: "eq", value: "x" })}`,
      `?${filters({ key: "name", op: "gte", value: "x" })}`,
      `?${filters({ key: "reviewCount", op: "eq", value: "abc" })}`,
      `?${filters({ key: "status", op: "eq", value: "bukan-status" })}`,
      "?filters=bukan-json",
      "?limit=99999",
    ]) {
      expect((await grid(c, "booths", qs)).status, qs).toBe(400);
    }
    const inj = await grid(
      c,
      "booths",
      `?q=${encodeURIComponent("'; DROP TABLE booths; --")}&${filters({ key: "name", op: "contains", value: "' OR 1=1 --" })}`,
    );
    expect(inj.status).toBe(200);
    expect(inj.json.rows).toHaveLength(0);
    expect((await grid(c, "booths")).json.rows).toHaveLength(3); // tabel utuh
  });

  it("ruang lingkup event: baris event lain tidak pernah muncul", async () => {
    const c = await liveHarness();
    await c.h.call("POST", "/api/admin/events", {
      name: "Event Lain",
      registrationCloseAt: 2000,
      eventStartAt: 3000,
      eventEndAt: 4000,
      registrationOpenAt: 1000,
    });
    const other = (await c.h.call("GET", "/api/admin/events")).json.events.find(
      (e: { name: string }) => e.name === "Event Lain",
    );
    await c.h.call("POST", `/api/admin/e/${other.id}/booths`, { name: "Booth Event Lain" });
    expect(byName((await grid(c, "booths")).json.rows)).not.toContain("Booth Event Lain");
    expect((await c.h.call("GET", `/api/admin/e/${other.id}/data/booths`)).json.rows).toHaveLength(
      1,
    );
  });

  it("ringkasan mengikuti filter: jumlah, rata-rata bintang, jumlah per status", async () => {
    const c = await withReviews();
    const all = (await grid(c, "reviews")).json.summary;
    expect(all.total).toBe(4);
    expect(all.avgStars).toBeCloseTo(3, 5);
    expect(all.byStatus).toEqual({ visible: 4 });
    const f = (await grid(c, "reviews", `?${filters({ key: "stars", op: "gte", value: "4" })}`))
      .json.summary;
    expect(f.total).toBe(2);
    expect(f.avgStars).toBeCloseTo(4.5, 5);
  });

  it("review: gabungan booth/pengunjung, hash singkat, flag sebagai teks", async () => {
    const c = await withReviews();
    const r = await grid(c, "reviews", "?sort=stars&dir=desc");
    expect(r.json.rows.map((x: GridRow) => x.values.stars)).toEqual([5, 4, 2, 1]);
    const first = r.json.rows[0] as GridRow;
    expect(first.values).toMatchObject({
      boothName: "Kopi Rempah",
      visitorName: "Tamu0",
      provider: "email",
      comment: "Enak sekali",
      status: "visible",
      commentStatus: "visible",
    });
    expect(String(first.values.visitorHash)).toHaveLength(8);
    expect(typeof first.values.flags === "string" || first.values.flags === null).toBe(true);
    expect(JSON.stringify(r.json)).not.toMatch(/identity_hash|"identityHash"/);
  });

  it("produk dan pengunjung (jumlah review dari subkueri)", async () => {
    const c = await withReviews();
    const p = await grid(c, "products", "?sort=priceIdr&dir=desc");
    expect(p.json.rows.map((x: GridRow) => x.values.name)).toEqual([
      "Kopi Rempah Susu",
      "Teh Tarik",
    ]);
    expect(p.json.rows[0].values).toMatchObject({
      boothName: "Kopi Rempah",
      priceIdr: 18000,
      isFeatured: true,
      badge: "limited",
    });
    const v = await grid(c, "visitors", "?sort=displayName");
    expect(v.json.rows.map((x: GridRow) => [x.values.displayName, x.values.reviewCount])).toEqual([
      ["Dodi", 1],
      ["Tamu0", 1],
      ["Tamu1", 1],
      ["Tamu2", 1],
    ]);
    expect(v.json.rows[0].values.blocked).toBe(false);
  });

  it("peringkat: urut peringkat, selisih skor, booth belum cukup ulasan di bawah; skor/peringkat di tab booth sama", async () => {
    const c = await withReviews();
    const r = await grid(c, "ranking");
    expect(r.json.rows[0].values).toMatchObject({
      rank: 1,
      name: "Kopi Rempah",
      reviewCount: 3,
      gap: null,
    });
    expect(r.json.rows.slice(1).every((x: GridRow) => x.values.rank === null)).toBe(true);
    expect(r.json.next).toBeNull();
    const booths = (await grid(c, "booths")).json.rows as GridRow[];
    const kopi = booths.find((x) => x.values.name === "Kopi Rempah") as GridRow;
    expect(kopi.values.rank).toBe(1);
    expect(kopi.values.score).toBeCloseTo(r.json.rows[0].values.score, 9);
    expect(booths.find((x) => x.values.name === "Belum Tayang")?.values.rank).toBeNull();
  });
});

describe("PATCH /data/bulk", () => {
  it("sunting bintang review: statistik dihitung ulang, nilai asli disimpan, versi baris naik", async () => {
    const c = await withReviews();
    const target = c.rid(2, "Kopi Rempah");
    const r = await bulk(c, {
      reason: "Bintang salah ketik",
      changes: [
        { entity: "reviews", id: target.id, field: "stars", value: 4, version: target.version },
      ],
    });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ applied: 1, results: [{ index: 0, status: "ok" }] });

    const after = (await grid(c, "reviews", `?${filters({ key: "stars", op: "gte", value: "1" })}`))
      .json.rows as GridRow[];
    const row = after.find((x) => x.id === target.id) as GridRow;
    expect(row.values).toMatchObject({
      stars: 4,
      originalStars: 2,
      moderationReason: "Bintang salah ketik",
    });
    expect(row.values.moderatedBy).toBeTruthy();
    expect(row.version).toBeGreaterThan(target.version);
    const kopi = (await grid(c, "booths")).json.rows.find(
      (x: GridRow) => x.values.name === "Kopi Rempah",
    );
    expect(kopi.values.average).toBeCloseTo((5 + 4 + 4) / 3, 5);
  });

  it("versi usang → conflict dan tidak ada yang berubah", async () => {
    const c = await withReviews();
    const t = c.rid(5, "Kopi Rempah");
    const r = await bulk(c, {
      reason: "Uji konflik",
      changes: [{ entity: "reviews", id: t.id, field: "stars", value: 1, version: t.version - 1 }],
    });
    expect(r.json.applied).toBe(0);
    expect(r.json.results[0]).toEqual({ index: 0, status: "conflict", code: "version_conflict" });
    expect(
      (await grid(c, "reviews")).json.rows.find((x: GridRow) => x.id === t.id).values.stars,
    ).toBe(5);
  });

  it("kolom tak boleh disunting, nilai tidak sah, baris tak ada: galat per perubahan", async () => {
    const c = await withReviews();
    const t = c.rid(5, "Kopi Rempah");
    const r = await bulk(c, {
      reason: "Uji galat",
      changes: [
        { entity: "reviews", id: t.id, field: "ipHash", value: "x", version: t.version },
        { entity: "reviews", id: t.id, field: "stars", value: 9, version: t.version },
        { entity: "reviews", id: t.id, field: "id", value: "baru", version: t.version },
        { entity: "reviews", id: "tidak-ada", field: "stars", value: 3, version: 1 },
        { entity: "booths", id: c.s.lengkap.id, field: "createdAt", value: 1, version: 1 },
      ],
    });
    expect(r.json.applied).toBe(0);
    expect(r.json.results.map((x: { code: string }) => x.code)).toEqual([
      "field_not_editable",
      "invalid_value",
      "field_not_editable",
      "not_found",
      "field_not_editable",
    ]);
  });

  it("validasi permintaan: alasan wajib (≥5), maksimum 100 perubahan, kunci idempotensi wajib", async () => {
    const c = await withReviews();
    const t = c.rid(5, "Kopi Rempah");
    const one = { entity: "reviews", id: t.id, field: "stars", value: 3, version: t.version };
    expect((await bulk(c, { reason: "x", changes: [one] })).status).toBe(400);
    expect((await bulk(c, { reason: "alasan valid", changes: [] })).status).toBe(400);
    expect((await bulk(c, { reason: "alasan valid", changes: Array(101).fill(one) })).status).toBe(
      400,
    );
    expect((await bulk(c, { reason: "alasan valid", changes: [one] }, { key: false })).status).toBe(
      400,
    );
    expect(
      (await bulk(c, { reason: "alasan valid", changes: [{ ...one, entity: "ranking" }] })).status,
    ).toBe(400);
  });

  it("beberapa kolom pada satu baris dengan versi yang sama diterapkan semua", async () => {
    const c = await withReviews();
    const t = c.rid(4, "Kopi Rempah");
    const r = await bulk(c, {
      reason: "Rapikan ulasan",
      changes: [
        { entity: "reviews", id: t.id, field: "stars", value: 3, version: t.version },
        { entity: "reviews", id: t.id, field: "status", value: "hidden", version: t.version },
      ],
    });
    expect(r.json.applied).toBe(2);
    const row = (await grid(c, "reviews")).json.rows.find((x: GridRow) => x.id === t.id);
    expect(row.values).toMatchObject({ stars: 3, status: "hidden", originalStars: 4 });
    // review tersembunyi tidak dihitung
    const kopi = (await grid(c, "booths")).json.rows.find(
      (x: GridRow) => x.values.name === "Kopi Rempah",
    );
    expect(kopi.values.reviewCount).toBe(2);
  });

  it("komentar: teks disunting (tayang, dikunci), status komentar eksplisit menang", async () => {
    const c = await withReviews();
    const t = c.rid(5, "Kopi Rempah");
    const r = await bulk(c, {
      reason: "Sensor sebagian",
      changes: [
        {
          entity: "reviews",
          id: t.id,
          field: "comment",
          value: "Enak sekali!",
          version: t.version,
        },
        {
          entity: "reviews",
          id: t.id,
          field: "commentStatus",
          value: "hidden",
          version: t.version,
        },
      ],
    });
    expect(r.json.applied).toBe(2);
    const row = (await grid(c, "reviews")).json.rows.find((x: GridRow) => x.id === t.id);
    expect(row.values).toMatchObject({
      comment: "Enak sekali!",
      commentStatus: "hidden",
      originalComment: "Enak sekali",
    });
  });

  it("atomic: satu perubahan gagal → tak satu pun diterapkan; tanpa atomic: yang sah tetap jalan", async () => {
    const c = await withReviews();
    const a = c.rid(5, "Kopi Rempah");
    const b = c.rid(4, "Kopi Rempah");
    const changes = [
      { entity: "reviews", id: a.id, field: "stars", value: 1, version: a.version },
      { entity: "reviews", id: b.id, field: "stars", value: 1, version: b.version - 5 },
    ];
    const atomic = await bulk(c, { reason: "Uji atomik", atomic: true, changes });
    expect(atomic.json.applied).toBe(0);
    expect(atomic.json.results.map((x: { status: string; code: string }) => x.code)).toEqual([
      "atomic_aborted",
      "version_conflict",
    ]);
    expect(
      (await grid(c, "reviews")).json.rows.find((x: GridRow) => x.id === a.id).values.stars,
    ).toBe(5);

    const partial = await bulk(c, { reason: "Uji sebagian", changes });
    expect(partial.json.applied).toBe(1);
    expect(partial.json.results.map((x: { status: string }) => x.status)).toEqual([
      "ok",
      "conflict",
    ]);
  });

  it("booth: nama, status ditolak (alasan jadi catatan untuk pemilik + email), pemilik diisi/dilepas", async () => {
    const mail = fakeEmail();
    const c = await liveHarness({ email: mail.send });
    await setOwnerEmail(c.h, c.s.event.id, c.s.hanyaNama.id, "budi@c.id");
    mail.sent.length = 0;
    const rows = (await grid(c, "booths")).json.rows as GridRow[];
    const budi = rows.find((x) => x.values.name === "Es Teh Pak Budi") as GridRow;
    const r = await bulk(c, {
      reason: "Tidak sesuai tema",
      changes: [
        {
          entity: "booths",
          id: budi.id,
          field: "name",
          value: "Es Teh Budi",
          version: budi.version,
        },
        {
          entity: "booths",
          id: budi.id,
          field: "status",
          value: "rejected",
          version: budi.version,
        },
      ],
    });
    expect(r.json.applied).toBe(2);
    const after = (await grid(c, "booths")).json.rows.find((x: GridRow) => x.id === budi.id);
    expect(after.values).toMatchObject({
      name: "Es Teh Budi",
      status: "rejected",
      rejectReason: "Tidak sesuai tema",
    });
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0]?.text).toContain("Tidak sesuai tema");

    const lengkap = rows.find((x) => x.id === c.s.lengkap.id) as GridRow;
    const own = await bulk(c, {
      reason: "Pemilik baru",
      changes: [
        {
          entity: "booths",
          id: lengkap.id,
          field: "email",
          value: "Baru@C.id",
          version: lengkap.version,
        },
      ],
    });
    expect(own.json.applied).toBe(1);
    expect(
      (await grid(c, "booths")).json.rows.find((x: GridRow) => x.id === lengkap.id).values,
    ).toMatchObject({ email: "baru@c.id", owner: "invited" });
  });

  it("booth: email yang sudah dipakai booth lain → error email_in_use", async () => {
    const c = await liveHarness();
    await setOwnerEmail(c.h, c.s.event.id, c.s.hanyaNama.id, "dipakai@c.id");
    const rows = (await grid(c, "booths")).json.rows as GridRow[];
    const k = rows.find((x) => x.values.name === "Kopi Rempah") as GridRow;
    const r = await bulk(c, {
      reason: "Uji email ganda",
      changes: [
        { entity: "booths", id: k.id, field: "email", value: "dipakai@c.id", version: k.version },
      ],
    });
    expect(r.json.results[0]).toEqual({ index: 0, status: "error", code: "email_in_use" });
  });

  it("produk (harga, tandai dihapus admin) dan pengunjung (nama, blokir)", async () => {
    const c = await withReviews();
    const p = (await grid(c, "products")).json.rows.find(
      (x: GridRow) => x.values.name === "Teh Tarik",
    ) as GridRow;
    const v = (await grid(c, "visitors")).json.rows.find(
      (x: GridRow) => x.values.displayName === "Dodi",
    ) as GridRow;
    const r = await bulk(c, {
      reason: "Pelanggaran aturan produk",
      changes: [
        { entity: "products", id: p.id, field: "priceIdr", value: 10000, version: p.version },
        {
          entity: "products",
          id: p.id,
          field: "status",
          value: "removed_by_admin",
          version: p.version,
        },
        { entity: "visitors", id: v.id, field: "blocked", value: true, version: v.version },
        { entity: "visitors", id: v.id, field: "displayName", value: "  ", version: v.version },
      ],
    });
    expect(r.json.applied).toBe(4);
    expect(
      (await grid(c, "products")).json.rows.find((x: GridRow) => x.id === p.id).values,
    ).toMatchObject({ priceIdr: 10000, status: "removed_by_admin" });
    expect(
      (await grid(c, "visitors")).json.rows.find((x: GridRow) => x.id === v.id).values,
    ).toMatchObject({ blocked: true, displayName: null });
  });

  it("setiap perubahan tercatat di log dengan nilai sebelum/sesudah dan alasan", async () => {
    const c = await withReviews();
    const t = c.rid(5, "Kopi Rempah");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await bulk(c, {
      reason: "Alasan untuk log",
      changes: [{ entity: "reviews", id: t.id, field: "stars", value: 3, version: t.version }],
    });
    const lines = spy.mock.calls
      .map((a) => String(a[0]))
      .filter((l) => l.includes("admin.review_edited"));
    spy.mockRestore();
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] as string)).toMatchObject({
      category: "admin",
      msg: "Alasan untuk log",
      target: { type: "review", id: t.id },
      meta: { via: "grid", field: "stars", before: 5, after: 3 },
    });
  });

  it("berfungsi penuh setelah event selesai (admin tidak pernah dibekukan)", async () => {
    const c = await withReviews();
    const t = c.rid(5, "Kopi Rempah");
    c.h.clk.t = 9_000_000_000_001;
    const r = await bulk(c, {
      reason: "Koreksi setelah selesai",
      changes: [{ entity: "reviews", id: t.id, field: "stars", value: 4, version: t.version }],
    });
    expect(r.status).toBe(200);
    expect(r.json.applied).toBe(1);
    expect((await grid(c, "reviews")).status).toBe(200);
  });

  it("klik ganda (kunci sama) tidak menerapkan dua kali", async () => {
    const c = await withReviews();
    const t = c.rid(5, "Kopi Rempah");
    const key = crypto.randomUUID();
    const body = {
      reason: "Sekali saja",
      changes: [{ entity: "reviews", id: t.id, field: "stars", value: 3, version: t.version }],
    };
    const [a, b] = [await bulk(c, body, { key }), await bulk(c, body, { key })];
    expect(a.json.applied).toBe(1);
    expect(b.json).toEqual(a.json);
  });
});

describe("GET /data/:entity/export", () => {
  it("CSV: BOM + header, hormati filter, tanggal ISO, bool 1/0, dan catat log ekspor", async () => {
    const c = await withReviews();
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const res = await c.h.app.request(
      `http://localhost/api/admin/e/${c.s.event.id}/data/reviews/export?${filters({ key: "stars", op: "gte", value: "4" })}&sort=stars&dir=desc`,
      {},
      c.h.env(),
    );
    const logged = spy.mock.calls.some((a) => String(a[0]).includes("admin.data_exported"));
    spy.mockRestore();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("attachment");
    // TextDecoder membuang BOM saat dekode: periksa byte mentahnya.
    const bytes = new Uint8Array(await res.clone().arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = await res.text();
    const lines = text.trim().split("\r\n");
    expect(lines[0]).toBe(GRID_COLUMNS.reviews.map((x) => x.key).join(","));
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("Kopi Rempah");
    expect(lines[1]).toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(logged).toBe(true);
  });

  it("sel berawalan = + - @ diberi awalan agar tidak dieksekusi sebagai rumus; koma dan kutip di-escape", async () => {
    const c = await liveHarness();
    await c.h.call("POST", `${c.s.base}`, { name: '=HYPERLINK("x")' });
    await c.h.call("POST", `${c.s.base}`, { name: 'Koma, "Kutip"' });
    const res = await c.h.app.request(
      `http://localhost/api/admin/e/${c.s.event.id}/data/booths/export`,
      {},
      c.h.env(),
    );
    const text = await res.text();
    expect(text).toContain(`"'=HYPERLINK(""x"")"`);
    expect(text).toContain(`"Koma, ""Kutip"""`);
  });

  it("data lebih dari satu halaman ekspor dialirkan semuanya", async () => {
    const c = await liveHarness();
    const values = Array.from(
      { length: 230 },
      (_, i) => `('vx${i}','${c.s.event.id}','email','h${i}','Tamu ${i}',0,1,1)`,
    ).join(",");
    await c.h.t.d1.exec(
      `INSERT INTO visitors (id,event_id,provider,identity_hash,display_name,blocked,created_at,updated_at) VALUES ${values}`,
    );
    const res = await c.h.app.request(
      `http://localhost/api/admin/e/${c.s.event.id}/data/visitors/export`,
      {},
      c.h.env(),
    );
    const lines = (await res.text()).trim().split("\r\n");
    expect(lines).toHaveLength(231);
    expect(new Set(lines.slice(1).map((l) => l.split(",")[2])).size).toBe(230);
  });
});
