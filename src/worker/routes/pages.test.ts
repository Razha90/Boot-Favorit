import { describe, expect, it } from "vitest";
import { adminHarness } from "../test/admin";
import { seedPublic } from "../test/seed";

const INDEX = `<!doctype html><html lang="id"><head><meta charset="UTF-8" /><title>Penilaian Booth Terfavorit LPPM Expo Tahun 2026</title></head><body><div id="root"></div></body></html>`;
const assets = {
  fetch: async () => new Response(INDEX, { headers: { "content-type": "text/html" } }),
} as unknown as Fetcher;

const page = (h: ReturnType<typeof adminHarness>, path: string) =>
  h.app.request(`http://localhost${path}`, {}, { ...h.env(), ASSETS: assets } as Env);

describe("halaman yang dibagikan: meta pratinjau tautan dan SEO", () => {
  it("halaman event: judul tab dan og:* memuat nama acara (di-escape), kanonis, dan kartu bawaan", async () => {
    const h = adminHarness();
    const s = await seedPublic(h);
    const res = await page(h, "/");
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("<title>Expo &lt;Uji&gt; &amp; &quot;Rasa&quot;</title>");
    expect(html).toContain('property="og:url" content="http://localhost/"');
    expect(html).toContain('rel="canonical" href="http://localhost/"');
    expect(html).toContain('<div id="root">');
    // belum ada gambar OG/hero unggahan: kartu bawaan, bukan tanpa gambar
    expect(html).toContain('og:image" content="http://localhost/og/default.png"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain("application/ld+json");
    expect(html).toContain('"@type":"Event"');
    expect(s.event.id).toBeTruthy();
  });

  it("halaman booth: judul '{booth} · {acara}', tagline, institusi, dan foto sampul sebagai og:image", async () => {
    const h = adminHarness();
    const s = await seedPublic(h);
    const res = await page(h, `/b/${s.lengkap.id}?src=share`);
    const html = await res.text();
    expect(html).toContain("Kopi Rempah ·");
    expect(html).toContain("Hangat di lidah.");
    expect(html).toContain('og:title" content="Kopi Rempah · Prodi Gizi"'); // judul pratinjau ringkas
    expect(html).toContain('og:image:type" content="image/webp"');
    expect(html).toContain(`rel="canonical" href="http://localhost/b/${s.lengkap.id}"`); // tanpa ?src
    expect(html).toContain('og:image:alt" content="Kopi Rempah, Prodi Gizi"');
    expect(html).toMatch(
      /og:image" content="http:\/\/localhost\/media\/events\/[^"]+-thumb\.webp"/,
    );
    expect(html).toContain("BreadcrumbList");
    expect(res.headers.get("x-robots-tag")).toBeNull(); // diindeks
  });

  it("?p= memakai produk: judul dan deskripsi memuat produk dan harga", async () => {
    const h = adminHarness();
    const s = await seedPublic(h);
    const html = await (await page(h, `/b/${s.lengkap.id}?p=${s.p1.id}`)).text();
    expect(html).toContain("Kopi Rempah Susu · Kopi Rempah");
    expect(html).toContain("Rp 18.000");
  });

  it("booth hanya-nama: tetap bermeta; tanpa foto memakai kartu ilustrasi makanan", async () => {
    const h = adminHarness();
    const s = await seedPublic(h);
    const html = await (await page(h, `/b/${s.hanyaNama.id}`)).text();
    expect(html).toContain("<title>Es Teh Pak Budi ·");
    expect(html).toMatch(/og:image" content="http:\/\/localhost\/og\/food-[a-z]+\.png"/);
    expect(html).not.toContain("-thumb.webp");
  });

  it("gambar OG event dipakai bila booth tanpa foto", async () => {
    const h = adminHarness();
    const s = await seedPublic(h);
    await s.setEvent({ ogImageKey: "events/e1/event/u-full.webp" });
    const html = await (await page(h, `/b/${s.hanyaNama.id}`)).text();
    expect(html).toContain("events/e1/event/u-thumb.webp");
  });

  it("MEDIA_BASE_URL (domain kustom R2) dipakai untuk URL gambar", async () => {
    const h = adminHarness(1500, { MEDIA_BASE_URL: "https://media.eventunimed.id/" });
    const s = await seedPublic(h);
    const html = await (await page(h, `/b/${s.lengkap.id}`)).text();
    expect(html).toContain('og:image" content="https://media.eventunimed.id/events/');
  });

  it("tanpa event publik, booth belum tayang, atau tak ada: HTML asli apa adanya", async () => {
    const h = adminHarness();
    const s = await seedPublic(h, { activate: false });
    expect(await (await page(h, "/")).text()).toBe(INDEX);
    await h.call("POST", `/api/admin/events/${s.event.id}/activate`);
    expect(await (await page(h, `/b/${s.pending.id}`)).text()).toBe(INDEX);
    expect(await (await page(h, "/b/tidak-ada")).text()).toBe(INDEX);
    await h.call("POST", `/api/admin/events/${s.event.id}/hide`);
    expect(await (await page(h, "/")).text()).toBe(INDEX);
  });

  it("nama booth jahat tidak menyuntikkan HTML", async () => {
    const h = adminHarness();
    const s = await seedPublic(h);
    const evil = (await h.call("POST", s.base, { name: '"><script>alert(1)</script>' })).json.booth;
    const html = await (await page(h, `/b/${evil.id}`)).text();
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] ?? "";
    expect(ld).not.toContain("<");
  });

  it("aset tak tersedia: 404 polos", async () => {
    const h = adminHarness();
    const broken = { fetch: async () => new Response("x", { status: 500 }) } as unknown as Fetcher;
    const res = await h.app.request("http://localhost/", {}, { ...h.env(), ASSETS: broken } as Env);
    expect(res.status).toBe(404);
  });

  it("/register dan /results: bermeta, register tidak diindeks (meta dan header)", async () => {
    const h = adminHarness();
    await seedPublic(h);
    const reg = await page(h, "/register");
    const regHtml = await reg.text();
    expect(regHtml).toContain("<title>Daftarkan booth ·");
    expect(regHtml).toContain('name="robots" content="noindex, follow"');
    expect(reg.headers.get("x-robots-tag")).toBe("noindex, follow");
    const res = await page(h, "/results");
    const resHtml = await res.text();
    expect(resHtml).toContain("<title>Hasil ·");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, follow"); // belum diumumkan
  });
});

describe("robots.txt, sitemap.xml, manifest.webmanifest", () => {
  it("robots.txt memakai origin permintaan", async () => {
    const h = adminHarness();
    const res = await page(h, "/robots.txt");
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(await res.text()).toContain("Sitemap: http://localhost/sitemap.xml");
  });

  it("sitemap.xml: beranda + booth tayang saja (tanpa booth belum tayang)", async () => {
    const h = adminHarness();
    const s = await seedPublic(h);
    const res = await page(h, "/sitemap.xml");
    expect(res.headers.get("content-type")).toContain("application/xml");
    const xml = await res.text();
    expect(xml).toContain("<loc>http://localhost/</loc>");
    expect(xml).toContain(`<loc>http://localhost/b/${s.lengkap.id}</loc>`);
    expect(xml).toContain(`<loc>http://localhost/b/${s.hanyaNama.id}</loc>`);
    expect(xml).not.toContain(s.pending.id);
    expect(xml).not.toContain("/results"); // belum diumumkan
  });

  it("sitemap.xml tanpa event publik: urlset kosong yang sah", async () => {
    const h = adminHarness();
    const xml = await (await page(h, "/sitemap.xml")).text();
    expect(xml).toContain("<urlset");
    expect(xml).not.toContain("<loc>");
  });

  it("manifest.webmanifest memuat nama acara aktif", async () => {
    const h = adminHarness();
    await seedPublic(h);
    const res = await page(h, "/manifest.webmanifest");
    expect(res.headers.get("content-type")).toContain("manifest+json");
    const json = (await res.json()) as { name: string; icons: unknown[] };
    expect(json.name).toBe('Expo <Uji> & "Rasa"');
    expect(json.icons.length).toBeGreaterThan(0);
  });
});
