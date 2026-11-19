import { describe, expect, it } from "vitest";
import { adminHarness } from "../test/admin";
import { seedPublic } from "../test/seed";

const INDEX = `<!doctype html><html lang="id"><head><meta charset="UTF-8" /><title>Penilaian Booth Terfavorit LPPM Expo Tahun 2026</title></head><body><div id="root"></div></body></html>`;
const assets = {
  fetch: async () => new Response(INDEX, { headers: { "content-type": "text/html" } }),
} as unknown as Fetcher;

const page = (h: ReturnType<typeof adminHarness>, path: string) =>
  h.app.request(`http://localhost${path}`, {}, { ...h.env(), ASSETS: assets } as Env);

describe("halaman yang dibagikan: meta pratinjau tautan", () => {
  it("halaman event: judul tab dan og:* memuat nama acara (di-escape)", async () => {
    const h = adminHarness();
    const s = await seedPublic(h);
    const res = await page(h, "/");
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("<title>Expo &lt;Uji&gt; &amp; &quot;Rasa&quot;</title>");
    expect(html).toContain('property="og:url" content="http://localhost/"');
    expect(html).toContain('<div id="root">');
    expect(html).not.toContain("og:image"); // belum ada gambar OG/hero
    expect(s.event.id).toBeTruthy();
  });

  it("halaman booth: judul '{booth} · {acara}', tagline, dan foto sampul sebagai og:image", async () => {
    const h = adminHarness();
    const s = await seedPublic(h);
    const html = await (await page(h, `/b/${s.lengkap.id}`)).text();
    expect(html).toContain("Kopi Rempah ·");
    expect(html).toContain('content="Hangat di lidah"');
    expect(html).toMatch(
      /og:image" content="http:\/\/localhost\/media\/events\/[^"]+-thumb\.webp"/,
    );
  });

  it("?p= memakai produk: judul dan deskripsi memuat produk dan harga", async () => {
    const h = adminHarness();
    const s = await seedPublic(h);
    const html = await (await page(h, `/b/${s.lengkap.id}?p=${s.p1.id}`)).text();
    expect(html).toContain("Kopi Rempah Susu · Kopi Rempah");
    expect(html).toContain("Rp 18.000");
  });

  it("booth hanya-nama: tetap bermeta; tanpa foto tidak ada og:image", async () => {
    const h = adminHarness();
    const s = await seedPublic(h);
    const html = await (await page(h, `/b/${s.hanyaNama.id}`)).text();
    expect(html).toContain("<title>Es Teh Pak Budi ·");
    expect(html).not.toContain("og:image");
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
  });

  it("aset tak tersedia: 404 polos", async () => {
    const h = adminHarness();
    const broken = { fetch: async () => new Response("x", { status: 500 }) } as unknown as Fetcher;
    const res = await h.app.request("http://localhost/", {}, { ...h.env(), ASSETS: broken } as Env);
    expect(res.status).toBe(404);
  });
});
