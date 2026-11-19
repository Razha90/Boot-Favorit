import { describe, expect, it } from "vitest";
import { adminHarness } from "../../test/admin";
import { TIMES } from "../../test/fixtures";
import { photoForm } from "../../test/seed";

async function setup() {
  const h = adminHarness();
  const event = (await h.call("POST", "/api/admin/events", { name: "Expo", ...TIMES })).json
    .event as { id: string };
  const url = (kind: string, slot = 0) =>
    `/api/admin/e/${event.id}/media?kind=${kind}&slot=${slot}`;
  // Logo memakai batas logo (512/128 px); OG dan hero memakai batas foto (1280/480 px).
  const up = (kind: string, slot = 0) =>
    h.call("POST", url(kind, slot), undefined, {
      raw: kind === "logo" ? photoForm([512, 512], [128, 128]) : photoForm(),
    });
  return { h, event, url, up };
}

describe("gambar event (logo, OG, kolase hero): semuanya opsional", () => {
  it("event baru tanpa gambar: media kosong, bukan galat", async () => {
    const { h, event } = await setup();
    const e = (await h.call("GET", `/api/admin/events/${event.id}`)).json.event;
    expect(e.media).toEqual({ logoKey: null, ogImageKey: null, heroKeys: [] });
  });

  it("logo dan OG: simpan, ganti (objek lama dihapus), hapus", async () => {
    const { h, up, url } = await setup();
    const a = await up("logo");
    expect(a.status).toBe(201);
    expect(h.r2.objects.size).toBe(2);
    const b = await up("logo");
    expect(b.json.media.logoKey).not.toBe(a.json.media.logoKey);
    expect(h.r2.objects.size).toBe(2); // pasangan lama diganti
    await up("og");
    expect(h.r2.objects.size).toBe(4);
    const del = await h.call("DELETE", url("logo"));
    expect(del.json.media.logoKey).toBeNull();
    expect(h.r2.objects.size).toBe(2);
  });

  it("kolase hero: maksimal 3, daftar rapat tanpa lubang, hapus menggeser", async () => {
    const { h, up, url } = await setup();
    for (let i = 0; i < 3; i++) expect((await up("hero", i)).status).toBe(201);
    expect(h.r2.objects.size).toBe(6);
    expect((await up("hero", 3)).status).toBe(400); // slot di luar 0–2
    const keys = (await up("hero", 1)).json.media.heroKeys as string[];
    expect(keys).toHaveLength(3);
    expect(h.r2.objects.size).toBe(6); // slot 1 diganti, bukan ditambah
    const after = await h.call("DELETE", url("hero", 0));
    expect(after.json.media.heroKeys).toEqual([keys[1], keys[2]]);
    expect(h.r2.objects.size).toBe(4);
  });

  it("slot hero di luar daftar menambah di akhir (tidak ada lubang)", async () => {
    const { up } = await setup();
    const r = await up("hero", 2); // daftar kosong → menjadi slot 0
    expect(r.json.media.heroKeys).toHaveLength(1);
  });

  it("menghapus yang tidak ada: tidak galat", async () => {
    const { h, url } = await setup();
    expect((await h.call("DELETE", url("hero", 2))).status).toBe(200);
    expect((await h.call("DELETE", url("logo"))).status).toBe(200);
  });

  it("validasi gambar sama seperti B15 (logo memakai batas logo 512 px)", async () => {
    const { h, url } = await setup();
    const big = await h.call("POST", url("logo"), undefined, { raw: photoForm() }); // 1280 px > 512
    expect(big.status).toBe(400);
    expect(big.json.code).toBe("invalid_image");
    expect(h.r2.objects.size).toBe(0);
  });

  it("kind tak dikenal ditolak; wajib Idempotency-Key; event tak ada → 404", async () => {
    const { h, event } = await setup();
    expect(
      (
        await h.call("POST", `/api/admin/e/${event.id}/media?kind=banner`, undefined, {
          raw: photoForm(),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await h.call("POST", `/api/admin/e/${event.id}/media?kind=og`, undefined, {
          raw: photoForm(),
          key: false,
        })
      ).status,
    ).toBe(400);
    expect(
      (await h.call("POST", "/api/admin/e/nope/media?kind=og", undefined, { raw: photoForm() }))
        .status,
    ).toBe(404);
  });

  it("event aktif: media ikut di GET /api/event publik dan menaikkan kunci cache", async () => {
    const { h, event, up } = await setup();
    await h.call("POST", `/api/admin/events/${event.id}/activate`);
    await up("og");
    await up("hero", 0);
    const pub = (await h.call("GET", "/api/event")).json.event;
    expect(pub.media.ogImageKey).toMatch(/-full\.webp$/);
    expect(pub.media.heroKeys).toHaveLength(1);
    expect(pub.versions.stats).toBeGreaterThanOrEqual(2);
  });
});
