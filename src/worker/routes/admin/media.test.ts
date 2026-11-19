import { fakeWebp } from "@shared/webp-fixture";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { boothPhotos, booths } from "../../db/schema";
import { adminHarness } from "../../test/admin";
import { TIMES } from "../../test/fixtures";

const blob = (bytes: Uint8Array, type = "image/webp") => new Blob([bytes.slice().buffer], { type });
const goodFull = () => fakeWebp("VP8 ", 1280, 960, 300);
const goodThumb = () => fakeWebp("VP8 ", 480, 360, 100);

function form(
  parts: Record<string, Blob | undefined> = { full: blob(goodFull()), thumb: blob(goodThumb()) },
) {
  const f = new FormData();
  for (const [k, v] of Object.entries(parts)) if (v) f.append(k, v, `${k}.webp`);
  return f;
}

async function setup() {
  const h = adminHarness();
  const event = (await h.call("POST", "/api/admin/events", { name: "Expo", ...TIMES })).json
    .event as { id: string };
  const booth = (await h.call("POST", `/api/admin/e/${event.id}/booths`, { name: "Kopi" })).json
    .booth as { id: string };
  const url = `/api/admin/e/${event.id}/booths/${booth.id}`;
  const upload = (kind: string, f: FormData = form(), extra = "") =>
    h.call("POST", `${url}/media?kind=${kind}${extra}`, undefined, { raw: f });
  return { h, event, booth, url, upload };
}

describe("unggah foto booth (B15)", () => {
  it("menyimpan dua ukuran ke R2 dengan metadata cache abadi dan mencatat foto sampul", async () => {
    const { h, booth, url, upload } = await setup();
    const r = await upload("photo");
    expect(r.status).toBe(201);
    expect(r.json.photo).toMatchObject({ position: 0 });

    expect(h.r2.objects.size).toBe(2);
    for (const [key, obj] of h.r2.objects) {
      expect(key).toMatch(/^events\/[^/]+\/booths\/[^/]+\/[0-9a-f-]{36}-(full|thumb)\.webp$/);
      expect(obj.contentType).toBe("image/webp");
      expect(obj.cacheControl).toContain("immutable");
    }
    const view = (await h.call("GET", url)).json.booth;
    expect(view).toMatchObject({ photoCount: 1, completeness: "partial" });
    expect(view.coverThumbKey).toBe(r.json.photo.keyThumb);
    expect(booth.id).toBeTruthy();
  });

  it("foto berikutnya mendapat posisi berurutan; foto pertama tetap sampul", async () => {
    const { upload } = await setup();
    await upload("photo");
    const second = await upload("photo");
    expect(second.json.photo.position).toBe(1);
  });

  it("maksimal foto per booth: lewat batas ditolak dan tidak menulis ke R2", async () => {
    const { h, upload } = await setup();
    for (let i = 0; i < 6; i++) expect((await upload("photo")).status).toBe(201);
    const over = await upload("photo");
    expect(over.status).toBe(409);
    expect(over.json.code).toBe("photo_limit");
    expect(h.r2.objects.size).toBe(12);
  });

  it("menolak berkas yang tidak sesuai dan tidak meninggalkan apa pun di R2", async () => {
    const { h, upload } = await setup();
    const cases: [string, FormData, number, string][] = [
      [
        "bukan content-type webp",
        form({ full: blob(goodFull(), "image/png"), thumb: blob(goodThumb()) }),
        400,
        "invalid_image",
      ],
      [
        "isi bukan WebP walau bertipe webp",
        form({ full: blob(new Uint8Array(500)), thumb: blob(goodThumb()) }),
        400,
        "invalid_image",
      ],
      [
        "dimensi full melebihi batas",
        form({ full: blob(fakeWebp("VP8 ", 2000, 1500, 300)), thumb: blob(goodThumb()) }),
        400,
        "invalid_image",
      ],
      [
        "dimensi thumb melebihi batas",
        form({ full: blob(goodFull()), thumb: blob(fakeWebp("VP8 ", 900, 900, 100)) }),
        400,
        "invalid_image",
      ],
      [
        "ukuran byte full melebihi batas",
        form({ full: blob(fakeWebp("VP8 ", 1280, 960, 410_000)), thumb: blob(goodThumb()) }),
        413,
        "payload_too_large",
      ],
      ["thumb tidak ada", form({ full: blob(goodFull()) }), 400, "invalid_image"],
      ["full tidak ada", form({ thumb: blob(goodThumb()) }), 400, "invalid_image"],
    ];
    for (const [name, f, status, code] of cases) {
      const r = await upload("photo", f);
      expect(r.status, name).toBe(status);
      expect(r.json.code, name).toBe(code);
    }
    expect(h.r2.objects.size).toBe(0);
    expect(await h.t.db.select().from(boothPhotos)).toHaveLength(0);
  });

  it("menolak badan yang bukan multipart", async () => {
    const { h, url } = await setup();
    const r = await h.call("POST", `${url}/media?kind=photo`, { full: "x" });
    expect(r.status).toBe(400);
    expect(r.json.code).toBe("invalid_image");
  });

  it("badan terlalu besar ditolak 413 sebelum diproses", async () => {
    const { h, url } = await setup();
    const r = await h.call("POST", `${url}/media?kind=photo`, undefined, {
      raw: new Uint8Array(900_000),
      headers: { "content-type": "multipart/form-data; boundary=x" },
    });
    expect(r.status).toBe(413);
    expect(r.json.code).toBe("payload_too_large");
  });

  it("wajib Idempotency-Key; klik ganda dengan kunci sama hanya menyimpan satu foto", async () => {
    const { h, url } = await setup();
    const key = crypto.randomUUID();
    const mk = () => h.call("POST", `${url}/media?kind=photo`, undefined, { raw: form(), key });
    expect(
      (await h.call("POST", `${url}/media?kind=photo`, undefined, { raw: form(), key: false }))
        .status,
    ).toBe(400);
    const a = await mk();
    const b = await mk();
    expect(b.headers.get("Idempotent-Replay")).toBe("true");
    expect(b.json.photo.id).toBe(a.json.photo.id);
    expect(await h.t.db.select().from(boothPhotos)).toHaveLength(1);
    expect(h.r2.objects.size).toBe(2);
  });

  it("R2 gagal menyimpan thumb: objek full yang sudah masuk dibersihkan, tidak ada baris foto", async () => {
    const { h, upload } = await setup();
    h.r2.failPutFor.add("-thumb.webp");
    const r = await upload("photo");
    expect(r.status).toBe(500);
    expect(h.r2.objects.size).toBe(0);
    expect(await h.t.db.select().from(boothPhotos)).toHaveLength(0);
  });

  it("basis data gagal setelah R2 berhasil: kedua objek dibersihkan", async () => {
    const { h, upload } = await setup();
    h.t.sqlite.exec(
      "CREATE TRIGGER nofoto BEFORE INSERT ON booth_photos BEGIN SELECT RAISE(ABORT, 'db gagal'); END",
    );
    const r = await upload("photo");
    expect(r.status).toBe(500);
    expect(h.r2.objects.size).toBe(0);
  });

  it("booth di event lain tidak bisa diunggahi lewat event ini", async () => {
    const { h, booth } = await setup();
    const other = (await h.call("POST", "/api/admin/events", { name: "Lain", ...TIMES })).json
      .event;
    const r = await h.call(
      "POST",
      `/api/admin/e/${other.id}/booths/${booth.id}/media?kind=photo`,
      undefined,
      { raw: form() },
    );
    expect(r.status).toBe(404);
    expect(h.r2.objects.size).toBe(0);
  });
});

describe("hapus dan urutkan foto", () => {
  async function three() {
    const s = await setup();
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) ids.push((await s.upload("photo")).json.photo.id);
    return { ...s, ids };
  }

  it("menghapus foto menghapus kedua objek R2 dan menomori ulang; menghapus sampul menjadikan foto berikutnya sampul", async () => {
    const { h, url, ids } = await three();
    const r = await h.call("DELETE", `${url}/photos/${ids[0]}`);
    expect(r.status).toBe(200);
    expect(r.json.photos.map((p: { id: string; position: number }) => [p.id, p.position])).toEqual([
      [ids[1], 0],
      [ids[2], 1],
    ]);
    expect(h.r2.objects.size).toBe(4);
    expect((await h.call("GET", url)).json.booth.photoCount).toBe(2);
  });

  it("menghapus semua foto membuat booth kembali tanpa foto (tanpa galat)", async () => {
    const { h, url, ids } = await three();
    for (const id of ids) await h.call("DELETE", `${url}/photos/${id}`);
    expect(h.r2.objects.size).toBe(0);
    const v = (await h.call("GET", url)).json.booth;
    expect(v).toMatchObject({ photoCount: 0, coverThumbKey: null, completeness: "name_only" });
  });

  it("mengurutkan ulang: id pertama menjadi sampul; urutan tidak lengkap atau ganda ditolak", async () => {
    const { h, url, ids } = await three();
    const [a, b, c] = ids as [string, string, string];
    const ok = await h.call("PUT", `${url}/photos/order`, { ids: [c, a, b] });
    expect(ok.json.photos.map((p: { id: string }) => p.id)).toEqual([c, a, b]);
    for (const bad of [
      [a, b],
      [a, a, b],
      [a, b, "tidak-ada"],
    ]) {
      expect((await h.call("PUT", `${url}/photos/order`, { ids: bad })).status).toBe(400);
    }
  });

  it("foto yang bukan milik booth ini → 404", async () => {
    const { h, url } = await three();
    expect((await h.call("DELETE", `${url}/photos/tidak-ada`)).status).toBe(404);
  });
});

describe("logo booth", () => {
  it("mengganti logo menghapus pasangan objek lama; menghapus logo membersihkan R2", async () => {
    const { h, booth, upload, url } = await setup();
    const logo = () =>
      form({
        full: blob(fakeWebp("VP8 ", 512, 512, 200)),
        thumb: blob(fakeWebp("VP8 ", 128, 128, 80)),
      });
    const first = await upload("logo", logo());
    expect(first.status).toBe(201);
    expect(h.r2.objects.size).toBe(2);
    const second = await upload("logo", logo());
    expect(second.json.logoKey).not.toBe(first.json.logoKey);
    expect(h.r2.objects.size).toBe(2); // lama dihapus

    const row = await h.t.db.select().from(booths).where(eq(booths.id, booth.id)).get();
    expect(row?.logoKey).toBe(second.json.logoKey);

    await h.call("DELETE", `${url}/logo`);
    expect(h.r2.objects.size).toBe(0);
    expect((await h.call("GET", url)).json.booth.logoKey).toBeNull();
  });

  it("logo memakai batas ukuran logo (512/128 px), bukan batas foto", async () => {
    const { upload } = await setup();
    const tooBig = form({ full: blob(goodFull()), thumb: blob(goodThumb()) }); // 1280 px > 512 px
    expect((await upload("logo", tooBig)).json.code).toBe("invalid_image");
  });
});
