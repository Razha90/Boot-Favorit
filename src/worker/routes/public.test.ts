import { describe, expect, it } from "vitest";
import { adminHarness } from "../test/admin";
import { seedPublic } from "../test/seed";

type Booth = { id: string; name: string; [k: string]: unknown };

async function setup() {
  const h = adminHarness();
  return { h, s: await seedPublic(h) };
}

describe("GET /api/snapshot", () => {
  it("institusi/fakultas dari impor CSV tampil di snapshot publik; spasi/kosong menjadi null", async () => {
    const { h, s } = await setup();
    const imp = await h.call("POST", `${s.base}/import`, {
      rows: [
        { name: "Bakso Teknik", teamName: "  Fakultas Teknik " },
        { name: "Teh Kosong", teamName: "   " },
      ],
    });
    expect(imp.json).toMatchObject({ created: 2, errors: 0 });
    const booths = (await h.call("GET", "/api/snapshot")).json.booths as Booth[];
    expect(booths.find((b) => b.name === "Bakso Teknik")?.teamName).toBe("Fakultas Teknik");
    expect(booths.find((b) => b.name === "Teh Kosong")?.teamName).toBeNull();
    // booth lama yang diisi lewat profil juga ikut tampil di daftar
    expect(booths.find((b) => b.name === "Kopi Rempah")?.teamName).toBe("Prodi Gizi");
  });

  it("hanya booth tayang (approved); booth hanya-nama membawa null, bukan nilai pengganti", async () => {
    const { h } = await setup();
    const r = await h.call("GET", "/api/snapshot");
    expect(r.status).toBe(200);
    const names = (r.json.booths as Booth[]).map((b) => b.name).sort();
    expect(names).toEqual(["Es Teh Pak Budi", "Kopi Rempah"]); // "Belum Tayang" (pending) tidak ada
    const nama = (r.json.booths as Booth[]).find((b) => b.name === "Es Teh Pak Budi");
    expect(nama).toMatchObject({
      boothNo: null,
      tagline: null,
      description: null,
      teamName: null,
      coverThumbKey: null,
      coverKey: null,
      ratingAverage: null,
      ratingCount: 0,
      priceFrom: null,
      allFree: false,
      featuredProduct: null,
    });
  });

  it("booth lengkap: foto sampul, harga terendah, andalan; harga 'mulai' mengabaikan gratis", async () => {
    const { h, s } = await setup();
    const b = ((await h.call("GET", "/api/snapshot")).json.booths as Booth[]).find(
      (x) => x.id === s.lengkap.id,
    );
    expect(b).toMatchObject({
      boothNo: "A12",
      tagline: "Hangat di lidah",
      priceFrom: 9000,
      allFree: false,
    });
    expect(b?.coverThumbKey).toMatch(/-thumb\.webp$/);
    expect(b?.coverKey).toMatch(/-full\.webp$/);
    expect(b?.featuredProduct).toMatchObject({ name: "Kopi Rempah Susu", priceIdr: 18000 });
  });

  it("semua produk gratis: allFree = true dan priceFrom null", async () => {
    const { h, s } = await setup();
    await h.call("POST", `${s.base}/${s.hanyaNama.id}/products`, {
      name: "Sampel",
      priceIdr: 0,
      termsConfirmed: true,
    });
    const b = ((await h.call("GET", "/api/snapshot")).json.booths as Booth[]).find(
      (x) => x.id === s.hanyaNama.id,
    );
    expect(b).toMatchObject({ priceFrom: null, allFree: true });
  });

  it("rating dihitung dari booth_stats; statistik memakai rata-rata tertimbang", async () => {
    const { h, s } = await setup();
    await s.setStats(s.lengkap.id, { count: 4, sum: 18 });
    await s.setStats(s.hanyaNama.id, { count: 6, sum: 24 });
    const r = await h.call("GET", "/api/snapshot");
    const b = (r.json.booths as Booth[]).find((x) => x.id === s.lengkap.id);
    expect(b).toMatchObject({ ratingAverage: 4.5, ratingCount: 4 });
    expect(r.json.stats).toMatchObject({ boothCount: 2, reviewCount: 10, average: 4.2 });
    expect(r.json.ratingsHidden).toBe(false);
  });

  it("rating disembunyikan admin: angka, jumlah, dan statistik TIDAK ada di respons (ditegakkan server)", async () => {
    const { h, s } = await setup();
    await s.setStats(s.lengkap.id, { count: 4, sum: 18 });
    await s.setEvent({ ratingsMode: "hidden" });
    const r = await h.call("GET", "/api/snapshot");
    expect(r.json.ratingsHidden).toBe(true);
    for (const b of r.json.booths as Booth[])
      expect(b).toMatchObject({ ratingAverage: null, ratingCount: 0 });
    expect(r.json.stats).toMatchObject({ reviewCount: 0, average: null });
    expect(JSON.stringify(r.json)).not.toContain('"ratingAverage":4');
  });

  it("on_results: tersembunyi sampai hasil diumumkan", async () => {
    const { h, s } = await setup();
    await s.setStats(s.lengkap.id, { count: 2, sum: 10 });
    await s.setEvent({ ratingsMode: "on_results" });
    expect((await h.call("GET", "/api/snapshot")).json.ratingsHidden).toBe(true);
    await s.setEvent({ resultsPublishedAt: 4100 });
    const after = await h.call("GET", "/api/snapshot");
    expect(after.json.ratingsHidden).toBe(false);
    expect((after.json.booths as Booth[]).find((b) => b.id === s.lengkap.id)).toMatchObject({
      ratingAverage: 5,
    });
  });

  it("tanpa event publik (belum aktif, draf, atau disembunyikan): 404", async () => {
    const h = adminHarness();
    const s = await seedPublic(h, { activate: false });
    expect((await h.call("GET", "/api/snapshot")).status).toBe(404);
    await h.call("POST", `/api/admin/events/${s.event.id}/activate`);
    expect((await h.call("GET", "/api/snapshot")).status).toBe(200);
    await h.call("POST", `/api/admin/events/${s.event.id}/hide`);
    expect((await h.call("GET", "/api/snapshot")).status).toBe(404);
  });

  it("daftar kosong tetap sah (event tanpa booth)", async () => {
    const h = adminHarness();
    const ev = (
      await h.call("POST", "/api/admin/events", {
        name: "Kosong",
        registrationCloseAt: 2000,
        registrationOpenAt: 1000,
        eventStartAt: 3000,
        eventEndAt: 4000,
      })
    ).json.event;
    await h.call("POST", `/api/admin/events/${ev.id}/activate`);
    const r = await h.call("GET", "/api/snapshot");
    expect(r.json.booths).toEqual([]);
    expect(r.json.stats).toMatchObject({ boothCount: 0, average: null });
  });
});

describe("GET /api/booths/:id", () => {
  it("detail lengkap: teks, foto berurutan, sebaran bintang, WhatsApp hanya sebagai penanda", async () => {
    const { h, s } = await setup();
    await s.setStats(s.lengkap.id, { count: 3, sum: 14, s5: 2, s4: 1 });
    const r = await h.call("GET", `/api/booths/${s.lengkap.id}`);
    expect(r.status).toBe(200);
    expect(r.json.booth).toMatchObject({
      name: "Kopi Rempah",
      about: "Cerita panjang booth ini.",
      teamName: "Prodi Gizi",
      hasWhatsapp: true,
      distribution: [0, 0, 0, 1, 2],
      ratingsHidden: false,
    });
    expect(r.json.booth.photos).toHaveLength(2);
    expect(r.json.booth.photos[0].keyThumb).toBe(r.json.booth.coverThumbKey);
    // Nomor WhatsApp TIDAK PERNAH ada di respons publik.
    expect(JSON.stringify(r.json)).not.toMatch(/6281234567890|08123456|wa\.me/);
  });

  it("booth hanya-nama: semua bagian opsional null/kosong, tetap 200", async () => {
    const { h, s } = await setup();
    const r = await h.call("GET", `/api/booths/${s.hanyaNama.id}`);
    expect(r.status).toBe(200);
    expect(r.json.booth).toMatchObject({
      about: null,
      teamName: null,
      photos: [],
      hasWhatsapp: false,
      coverKey: null,
      distribution: [0, 0, 0, 0, 0],
    });
  });

  it("rating disembunyikan: sebaran null", async () => {
    const { h, s } = await setup();
    await s.setEvent({ ratingsMode: "hidden" });
    const r = await h.call("GET", `/api/booths/${s.lengkap.id}`);
    expect(r.json.booth).toMatchObject({ distribution: null, ratingsHidden: true });
  });

  it("booth belum tayang atau tidak ada: 404; booth event lain tidak bocor", async () => {
    const { h, s } = await setup();
    expect((await h.call("GET", `/api/booths/${s.pending.id}`)).status).toBe(404);
    expect((await h.call("GET", "/api/booths/tidak-ada")).status).toBe(404);
  });

  it("setelah event selesai: tombol WhatsApp hilang (hasWhatsapp false)", async () => {
    const { h, s } = await setup();
    h.clk.t = 5000;
    expect((await h.call("GET", `/api/booths/${s.lengkap.id}`)).json.booth.hasWhatsapp).toBe(false);
  });
});

describe("GET /api/booths/:id/products", () => {
  it("hanya produk aktif, berurutan; hasWhatsapp tanpa nomor", async () => {
    const { h, s } = await setup();
    await h.call("PATCH", `${s.base}/${s.lengkap.id}/products/${s.p2.id}`, { status: "hidden" });
    const r = await h.call("GET", `/api/booths/${s.lengkap.id}/products`);
    expect(r.json.products.map((p: { name: string }) => p.name)).toEqual(["Kopi Rempah Susu"]);
    expect(r.json.hasWhatsapp).toBe(true);
    expect(r.json.products[0]).toMatchObject({
      priceIdr: 18000,
      comparePriceIdr: 24000,
      badge: "limited",
      category: "Minuman",
      thumbKey: null,
    });
  });

  it("setelah event selesai: promo dan penanda disembunyikan, harga tetap tampil", async () => {
    const { h, s } = await setup();
    h.clk.t = 5000;
    const r = await h.call("GET", `/api/booths/${s.lengkap.id}/products`);
    expect(r.json.products[0]).toMatchObject({
      priceIdr: 18000,
      comparePriceIdr: null,
      badge: null,
    });
    expect(r.json.hasWhatsapp).toBe(false);
  });

  it("booth tanpa produk: daftar kosong (bukan galat)", async () => {
    const { h, s } = await setup();
    const r = await h.call("GET", `/api/booths/${s.hanyaNama.id}/products`);
    expect(r.status).toBe(200);
    expect(r.json.products).toEqual([]);
  });
});

describe("GET /go/wa/:boothId", () => {
  const go = (h: ReturnType<typeof adminHarness>, path: string, ip = "9.9.9.9") =>
    h.app.request(
      `http://localhost${path}`,
      { headers: { "cf-connecting-ip": ip }, redirect: "manual" },
      h.env(),
    );

  it("302 ke wa.me dengan pesan terisi dari data produk; tidak di-cache", async () => {
    const { h, s } = await setup();
    const res = await go(h, `/go/wa/${s.lengkap.id}?p=${s.p1.id}`);
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.get("location") ?? "");
    expect(loc.origin + loc.pathname).toBe("https://wa.me/6281234567890");
    const text = loc.searchParams.get("text") ?? "";
    expect(text).toContain("Kopi Rempah Susu");
    expect(text).toContain("Rp 18.000");
    expect(text).toContain("Kopi Rempah");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("tanpa produk: pesan tentang booth; produk tak dikenal diabaikan (pesan bukan dari parameter bebas)", async () => {
    const { h, s } = await setup();
    const a = await go(h, `/go/wa/${s.lengkap.id}`);
    expect(new URL(a.headers.get("location") ?? "").searchParams.get("text")).toContain(
      "booth Kopi Rempah",
    );
    const b = await go(h, `/go/wa/${s.lengkap.id}?p=bukan-produk`);
    expect(new URL(b.headers.get("location") ?? "").searchParams.get("text")).toContain(
      "booth Kopi Rempah",
    );
  });

  it("404 polos: booth tanpa nomor, booth belum tayang, tidak ada, event selesai, nomor dihapus", async () => {
    const { h, s } = await setup();
    for (const id of [s.hanyaNama.id, s.pending.id, "tidak-ada"]) {
      const res = await go(h, `/go/wa/${id}`);
      expect(res.status, id).toBe(404);
      expect(await res.text()).toBe("");
    }
    await h.call("PUT", `${s.base}/${s.lengkap.id}/whatsapp`, { number: "" });
    expect((await go(h, `/go/wa/${s.lengkap.id}`)).status).toBe(404);
  });

  it("ditolak setelah event selesai", async () => {
    const { h, s } = await setup();
    h.clk.t = 5000;
    expect((await go(h, `/go/wa/${s.lengkap.id}`)).status).toBe(404);
  });

  it("dibatasi laju per alamat (anti pemanenan nomor)", async () => {
    const { h, s } = await setup();
    const codes: number[] = [];
    for (let i = 0; i < 22; i++)
      codes.push((await go(h, `/go/wa/${s.lengkap.id}`, "7.7.7.7")).status);
    expect(codes.slice(0, 20).every((c) => c === 302)).toBe(true);
    expect(codes[20]).toBe(429);
    expect((await go(h, `/go/wa/${s.lengkap.id}`, "8.8.8.8")).status).toBe(302); // IP lain tak terpengaruh
  });
});
