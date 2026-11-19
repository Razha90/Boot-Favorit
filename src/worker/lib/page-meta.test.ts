import { describe, expect, it } from "vitest";
import { buildPageMeta, escapeHtml, injectMeta } from "./page-meta";

const base = {
  eventName: "Penilaian Booth Terfavorit LPPM Expo Tahun 2026",
  origin: "https://eventunimed.id",
  mediaBase: "https://media.eventunimed.id",
  eventImageKey: null,
};

describe("buildPageMeta", () => {
  it("halaman event: judul = nama acara, deskripsi mengajak, tanpa gambar bila tak ada", () => {
    const m = buildPageMeta({ ...base, path: "/" });
    expect(m.title).toBe(base.eventName);
    expect(m.description).toContain("kasih bintang");
    expect(m.image).toBeNull();
    expect(m.url).toBe("https://eventunimed.id/");
  });

  it("gambar OG event dipakai versi thumb dari kunci full", () => {
    const m = buildPageMeta({ ...base, path: "/", eventImageKey: "events/e1/event/u-full.webp" });
    expect(m.image).toBe("https://media.eventunimed.id/events/e1/event/u-thumb.webp");
  });

  it("booth: judul '{booth} · {acara}'; tagline jadi deskripsi; tanpa tagline memakai kalimat mengajak", () => {
    const withTag = buildPageMeta({
      ...base,
      path: "/b/x",
      booth: { name: "Kopi", tagline: "Hangat", coverThumbKey: null },
    });
    expect(withTag.title).toBe(`Kopi · ${base.eventName}`);
    expect(withTag.description).toBe("Hangat");
    const noTag = buildPageMeta({
      ...base,
      path: "/b/x",
      booth: { name: "Kopi", tagline: "  ", coverThumbKey: null },
    });
    expect(noTag.description).toContain("Mampir ke booth Kopi");
  });

  it("urutan cadangan gambar: produk → sampul booth → OG event → tanpa gambar", () => {
    const booth = { name: "K", tagline: null, coverThumbKey: "b/cover-thumb.webp" };
    const product = { name: "P", priceIdr: 5000, thumbKey: "p/foto-thumb.webp" };
    const img = (m: ReturnType<typeof buildPageMeta>) => m.image?.split("/").slice(-1)[0] ?? null;
    expect(img(buildPageMeta({ ...base, path: "/b/x", booth, product }))).toBe("foto-thumb.webp");
    expect(
      img(buildPageMeta({ ...base, path: "/b/x", booth, product: { ...product, thumbKey: null } })),
    ).toBe("cover-thumb.webp");
    expect(
      img(
        buildPageMeta({
          ...base,
          path: "/b/x",
          eventImageKey: "e/og-full.webp",
          booth: { ...booth, coverThumbKey: null },
          product: { ...product, thumbKey: null },
        }),
      ),
    ).toBe("og-thumb.webp");
    expect(
      buildPageMeta({ ...base, path: "/b/x", booth: { ...booth, coverThumbKey: null } }).image,
    ).toBeNull();
  });

  it("produk: judul memuat produk dan booth; deskripsi memuat harga (Gratis bila 0)", () => {
    const m = buildPageMeta({
      ...base,
      path: "/b/x?p=1",
      booth: { name: "K", tagline: null, coverThumbKey: null },
      product: { name: "Kopi", priceIdr: 18000, thumbKey: null },
    });
    expect(m.title).toBe(`Kopi · K · ${base.eventName}`);
    expect(m.description).toContain("Rp 18.000");
    const free = buildPageMeta({
      ...base,
      path: "/b/x",
      booth: { name: "K", tagline: null, coverThumbKey: null },
      product: { name: "Sampel", priceIdr: 0, thumbKey: null },
    });
    expect(free.description).toContain("Gratis");
  });
});

describe("injectMeta", () => {
  const html = `<!doctype html><html><head><meta charset="UTF-8" /><title>Lama</title><meta name="description" content="lama" /></head><body></body></html>`;
  const meta = {
    title: "Judul",
    description: "Deskripsi",
    image: "https://x/a-thumb.webp",
    url: "https://x/",
  };

  it("mengganti judul, menambah og:* dan twitter:card, tanpa menggandakan tag lama", () => {
    const out = injectMeta(html, meta);
    expect(out).toContain("<title>Judul</title>");
    expect(out).toContain('property="og:title" content="Judul"');
    expect(out).toContain('property="og:image" content="https://x/a-thumb.webp"');
    expect(out).toContain('name="twitter:card" content="summary_large_image"');
    expect(out.match(/name="description"/g)).toHaveLength(1);
    expect(out).not.toContain("lama");
    expect(out.indexOf("<meta property")).toBeLessThan(out.indexOf("</head>"));
  });

  it("tanpa gambar: tidak ada og:image sama sekali (bukan URL kosong)", () => {
    const out = injectMeta(html, { ...meta, image: null });
    expect(out).not.toContain("og:image");
    expect(out).toContain('name="twitter:card" content="summary"');
  });

  it("nama booth jahat di-escape: tidak ada injeksi tag atau atribut", () => {
    const evil = '"><script>alert(1)</script>';
    const out = injectMeta(html, { ...meta, title: evil, description: evil });
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
    expect(out).toContain("&quot;&gt;");
  });

  it("HTML tanpa <title> tetap mendapat judul", () => {
    const out = injectMeta("<html><head></head></html>", meta);
    expect(out).toContain("<title>Judul</title>");
  });
});

describe("escapeHtml", () => {
  it("meloloskan & < > \" '", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });
});
