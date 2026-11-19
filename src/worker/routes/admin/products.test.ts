import { fakeWebp } from "@shared/webp-fixture";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { boothStats, booths, products } from "../../db/schema";
import { adminHarness } from "../../test/admin";
import { TIMES } from "../../test/fixtures";

async function setup() {
  const h = adminHarness();
  const event = (await h.call("POST", "/api/admin/events", { name: "Expo", ...TIMES })).json
    .event as { id: string };
  const booth = (await h.call("POST", `/api/admin/e/${event.id}/booths`, { name: "Kopi" })).json
    .booth as { id: string };
  const url = `/api/admin/e/${event.id}/booths/${booth.id}/products`;
  let n = 0;
  const add = (over: Record<string, unknown> = {}) =>
    h.call("POST", url, { name: `Produk ${++n}`, priceIdr: 10_000, termsConfirmed: true, ...over });
  const stats = async () =>
    h.t.db.select().from(boothStats).where(eq(boothStats.boothId, booth.id)).get();
  const list = async () =>
    (await h.call("GET", url)).json.products as {
      id: string;
      isFeatured: boolean;
      status: string;
      position: number;
    }[];
  const featured = async () =>
    (await list()).filter((p) => p.isFeatured && p.status === "active").map((p) => p.id);
  return { h, event, booth, url, add, stats, list, featured };
}

describe("tambah produk", () => {
  it("aturan A14 wajib dicentang sebelum produk pertama; setelah itu tersimpan di booth", async () => {
    const { h, booth, add } = await setup();
    const no = await add({ termsConfirmed: false });
    expect(no.status).toBe(400);
    expect(await h.t.db.select().from(products)).toHaveLength(0);

    expect((await add()).status).toBe(201);
    const row = await h.t.db.select().from(booths).where(eq(booths.id, booth.id)).get();
    expect(row?.productTermsAcceptedAt).not.toBeNull();
    // produk berikutnya tidak perlu mencentang lagi
    expect((await add({ termsConfirmed: false })).status).toBe(201);
  });

  it("produk pertama otomatis menjadi andalan dan statistik turunan terisi", async () => {
    const { add, stats, featured } = await setup();
    const first = (await add({ priceIdr: 18_000 })).json.product;
    expect(first.isFeatured).toBe(true);
    await add({ priceIdr: 0 });
    await add({ priceIdr: 12_000 });
    expect(await featured()).toEqual([first.id]);
    expect(await stats()).toMatchObject({
      productCount: 3,
      priceFrom: 12_000, // harga terendah > 0 (gratis tidak dihitung)
      featuredProductId: first.id,
    });
  });

  it("semua produk gratis: price_from NULL", async () => {
    const { add, stats } = await setup();
    await add({ priceIdr: 0 });
    await add({ priceIdr: 0 });
    expect((await stats())?.priceFrom).toBeNull();
  });

  it("validasi: harga bulat 0..batas, harga normal harus lebih besar, penanda dari daftar tetap", async () => {
    const { add } = await setup();
    for (const bad of [
      { priceIdr: -1 },
      { priceIdr: 1.5 },
      { priceIdr: 100_000_000 },
      { priceIdr: 5000, comparePriceIdr: 5000 },
      { badge: "terlaris" },
      { name: "" },
    ]) {
      expect((await add(bad)).status, JSON.stringify(bad)).toBe(400);
    }
    expect((await add({ priceIdr: 5000, comparePriceIdr: 9000, badge: "limited" })).status).toBe(
      201,
    );
  });

  it("maksimal 8 kategori berbeda per booth", async () => {
    const { add } = await setup();
    for (let i = 0; i < 8; i++) expect((await add({ category: `Kat ${i}` })).status).toBe(201);
    expect((await add({ category: "kat 3" })).status).toBe(201); // sudah ada (tanpa membedakan huruf besar-kecil)
    expect((await add({ category: "Kat Baru" })).status).toBe(400);
  });
});

describe("batas produk atomik (B24)", () => {
  it("30 permintaan tambah serentak pada booth kosong: tepat 24 tersimpan", async () => {
    const { h, url } = await setup();
    const results = await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        h.call("POST", url, { name: `P${i}`, priceIdr: 1000, termsConfirmed: true }),
      ),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(24);
    const rejected = results.filter((r) => r.status === 409);
    expect(rejected).toHaveLength(6);
    expect(rejected.every((r) => r.json.code === "product_limit")).toBe(true);
    expect(await h.t.db.select().from(products)).toHaveLength(24);
  });

  it("produk tersembunyi tetap dihitung (batas tidak bisa diakali)", async () => {
    const { h, url, add } = await setup();
    const ids: string[] = [];
    for (let i = 0; i < 24; i++) ids.push((await add()).json.product.id);
    await h.call("PATCH", `${url}/${ids[5]}`, { status: "hidden" });
    expect((await add()).json.code).toBe("product_limit");
  });

  it("produk yang dihapus admin (removed_by_admin) tidak dihitung ke batas", async () => {
    const { h, url, add } = await setup();
    const ids: string[] = [];
    for (let i = 0; i < 24; i++) ids.push((await add()).json.product.id);
    await h.call("PATCH", `${url}/${ids[0]}`, { status: "removed_by_admin" });
    expect((await add()).status).toBe(201);
  });

  it("batas per event diatur admin: diturunkan di bawah jumlah produk tidak menghapus apa pun", async () => {
    const { h, event, url, add } = await setup();
    for (let i = 0; i < 15; i++) await add();
    await h.call("PUT", `/api/admin/events/${event.id}`, { settings: { maxProducts: 10 } });
    expect((await add()).json.code).toBe("product_limit");
    expect(await h.t.db.select().from(products)).toHaveLength(15); // tidak ada yang terhapus
    // batas di luar rentang ditolak
    expect(
      (await h.call("PUT", `/api/admin/events/${event.id}`, { settings: { maxProducts: 200 } }))
        .status,
    ).toBe(400);
    expect(url).toBeTruthy();
  });

  it("batas dinaikkan: booth bisa menambah lagi", async () => {
    const { h, event, add } = await setup();
    await h.call("PUT", `/api/admin/events/${event.id}`, { settings: { maxProducts: 2 } });
    await add();
    await add();
    expect((await add()).json.code).toBe("product_limit");
    await h.call("PUT", `/api/admin/events/${event.id}`, { settings: { maxProducts: 3 } });
    expect((await add()).status).toBe(201);
  });
});

describe("tepat satu produk andalan (B24)", () => {
  it("mengganti andalan melepas yang lama dalam satu batch", async () => {
    const { h, url, add, featured } = await setup();
    const a = (await add()).json.product.id as string;
    const b = (await add()).json.product.id as string;
    expect(await featured()).toEqual([a]);
    const r = await h.call("PUT", `${url}/${b}/featured`);
    expect(r.status).toBe(200);
    expect(await featured()).toEqual([b]);
  });

  it("andalan disembunyikan: pindah ke produk aktif berikutnya menurut urutan", async () => {
    const { h, url, add, featured } = await setup();
    const a = (await add()).json.product.id as string;
    const b = (await add()).json.product.id as string;
    await add();
    await h.call("PATCH", `${url}/${a}`, { status: "hidden" });
    expect(await featured()).toEqual([b]);
  });

  it("andalan dihapus: pindah; semua tidak aktif: tidak ada andalan dan featured_product_id NULL", async () => {
    const { h, url, add, featured, stats } = await setup();
    const a = (await add()).json.product.id as string;
    const b = (await add()).json.product.id as string;
    await h.call("DELETE", `${url}/${a}`);
    expect(await featured()).toEqual([b]);
    await h.call("PATCH", `${url}/${b}`, { status: "hidden" });
    expect(await featured()).toEqual([]);
    expect(await stats()).toMatchObject({
      productCount: 0,
      featuredProductId: null,
      priceFrom: null,
    });
  });

  it("produk tersembunyi tidak bisa dijadikan andalan; produk tak dikenal 404", async () => {
    const { h, url, add } = await setup();
    await add();
    const b = (await add()).json.product.id as string;
    await h.call("PATCH", `${url}/${b}`, { status: "hidden" });
    expect((await h.call("PUT", `${url}/${b}/featured`)).status).toBe(400);
    expect((await h.call("PUT", `${url}/tidak-ada/featured`)).status).toBe(404);
  });

  it("setelah rangkaian perubahan acak selalu paling banyak satu andalan aktif", async () => {
    const { h, url, add, featured } = await setup();
    const ids: string[] = [];
    for (let i = 0; i < 6; i++) ids.push((await add()).json.product.id);
    const ops: (() => Promise<unknown>)[] = [
      () => h.call("PUT", `${url}/${ids[3]}/featured`),
      () => h.call("PATCH", `${url}/${ids[3]}`, { status: "hidden" }),
      () => h.call("DELETE", `${url}/${ids[0]}`),
      () => h.call("PATCH", `${url}/${ids[3]}`, { status: "active" }),
      () => h.call("PUT", `${url}/${ids[4]}/featured`),
      () => h.call("PATCH", `${url}/${ids[4]}`, { status: "removed_by_admin" }),
    ];
    for (const op of ops) {
      await op();
      expect((await featured()).length).toBeLessThanOrEqual(1);
    }
    expect((await featured()).length).toBe(1);
  });
});

describe("ubah, urutkan, dan hapus", () => {
  it("mengubah sebagian dan memvalidasi harga normal terhadap harga gabungan", async () => {
    const { h, url, add } = await setup();
    const p = (await add({ priceIdr: 10_000, comparePriceIdr: 15_000 })).json.product.id as string;
    const ok = await h.call("PATCH", `${url}/${p}`, { name: "Baru", priceIdr: 12_000 });
    expect(ok.json.product).toMatchObject({
      name: "Baru",
      priceIdr: 12_000,
      comparePriceIdr: 15_000,
    });
    const bad = await h.call("PATCH", `${url}/${p}`, { priceIdr: 20_000 }); // harga normal 15.000 < 20.000
    expect(bad.status).toBe(400);
    const clear = await h.call("PATCH", `${url}/${p}`, { comparePriceIdr: null, priceIdr: 20_000 });
    expect(clear.status).toBe(200);
  });

  it("mengurutkan ulang menurut daftar id lengkap", async () => {
    const { h, url, add, list } = await setup();
    const ids = [
      (await add()).json.product.id,
      (await add()).json.product.id,
      (await add()).json.product.id,
    ] as string[];
    const r = await h.call("PUT", `${url}/order`, { ids: [ids[2], ids[0], ids[1]] });
    expect(r.json.products.map((p: { id: string }) => p.id)).toEqual([ids[2], ids[0], ids[1]]);
    expect((await h.call("PUT", `${url}/order`, { ids: [ids[0]] })).status).toBe(400);
    expect((await list()).map((p) => p.position)).toEqual([0, 1, 2]);
  });

  it("produk milik booth lain tidak bisa diubah lewat booth ini", async () => {
    const { h, event, add } = await setup();
    const p = (await add()).json.product.id as string;
    const other = (await h.call("POST", `/api/admin/e/${event.id}/booths`, { name: "Lain" })).json
      .booth.id;
    const r = await h.call("PATCH", `/api/admin/e/${event.id}/booths/${other}/products/${p}`, {
      name: "Curang",
    });
    expect(r.status).toBe(404);
  });

  it("klik ganda 'tambah produk' dengan kunci sama membuat satu produk", async () => {
    const { h, url } = await setup();
    const key = crypto.randomUUID();
    const body = { name: "Sekali", priceIdr: 1000, termsConfirmed: true };
    await h.call("POST", url, body, { key });
    const again = await h.call("POST", url, body, { key });
    expect(again.headers.get("Idempotent-Replay")).toBe("true");
    expect(await h.t.db.select().from(products)).toHaveLength(1);
  });
});

describe("foto produk", () => {
  const photoForm = () => {
    const f = new FormData();
    f.append(
      "full",
      new Blob([fakeWebp("VP8 ", 960, 960, 200).slice().buffer], { type: "image/webp" }),
      "f.webp",
    );
    f.append(
      "thumb",
      new Blob([fakeWebp("VP8 ", 400, 400, 80).slice().buffer], { type: "image/webp" }),
      "t.webp",
    );
    return f;
  };

  it("opsional: produk tanpa foto sah; unggah, ganti, hapus foto, dan hapus produk membersihkan R2", async () => {
    const { h, event, booth, url, add } = await setup();
    const p = (await add()).json.product as { id: string; keyFull: string | null };
    expect(p.keyFull).toBeNull(); // foto produk opsional, termasuk andalan

    const mediaUrl = `/api/admin/e/${event.id}/booths/${booth.id}/media?kind=product&productId=${p.id}`;
    const up = await h.call("POST", mediaUrl, undefined, { raw: photoForm() });
    expect(up.status).toBe(201);
    expect(up.json.product.keyFull).toBeTruthy();
    expect(h.r2.objects.size).toBe(2);

    await h.call("POST", mediaUrl, undefined, { raw: photoForm() });
    expect(h.r2.objects.size).toBe(2); // pasangan lama diganti

    await h.call("DELETE", `${url}/${p.id}/photo`);
    expect(h.r2.objects.size).toBe(0);

    await h.call("POST", mediaUrl, undefined, { raw: photoForm() });
    await h.call("DELETE", `${url}/${p.id}`);
    expect(h.r2.objects.size).toBe(0);
  });

  it("kind=product tanpa productId ditolak; produk tak dikenal 404", async () => {
    const { h, event, booth } = await setup();
    const base = `/api/admin/e/${event.id}/booths/${booth.id}/media?kind=product`;
    expect((await h.call("POST", base, undefined, { raw: photoForm() })).status).toBe(400);
    expect(
      (await h.call("POST", `${base}&productId=nope`, undefined, { raw: photoForm() })).status,
    ).toBe(404);
  });
});
