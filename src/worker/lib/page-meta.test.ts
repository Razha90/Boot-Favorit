import { DEFAULT_OG_PATH, foodArtFor, foodOgPath } from "@shared/food-art";
import { describe, expect, it } from "vitest";
import {
  buildManifest,
  buildPageMeta,
  buildRobotsTxt,
  buildSitemapXml,
  escapeHtml,
  injectMeta,
  type MetaInput,
  ROBOTS_NOINDEX,
  safeJsonLd,
} from "./page-meta";

const base = {
  eventName: "Penilaian Booth Terfavorit LPPM Expo Tahun 2026",
  origin: "https://eventunimed.id",
  mediaBase: "https://media.eventunimed.id",
  eventImageKey: null,
};
const home: MetaInput = { ...base, kind: "home", path: "/" };
const boothInput = (booth: Partial<NonNullable<MetaInput["booth"]>> = {}): MetaInput => ({
  ...base,
  kind: "booth",
  path: "/b/x",
  booth: { id: "x", name: "Kopi", tagline: null, coverThumbKey: null, ...booth },
});

describe("buildPageMeta: halaman event", () => {
  it("judul = nama acara, deskripsi mengajak, kanonis tanpa query", () => {
    const m = buildPageMeta({ ...home, path: "/?src=share" });
    expect(m.title).toBe(base.eventName);
    expect(m.description).toContain("kasih bintang");
    expect(m.url).toBe("https://eventunimed.id/");
    expect(m.siteName).toBe(base.eventName);
  });

  it("tanpa gambar unggahan: kartu bawaan 1200x630 (URL absolut, tidak pernah kosong)", () => {
    const m = buildPageMeta(home);
    expect(m.image).toBe(`https://eventunimed.id${DEFAULT_OG_PATH}`);
    expect(m.imageSize).toEqual({ width: 1200, height: 630 });
  });

  it("gambar OG event dipakai versi thumb dari kunci full; ukurannya tidak diklaim", () => {
    const m = buildPageMeta({ ...home, eventImageKey: "events/e1/event/u-full.webp" });
    expect(m.image).toBe("https://media.eventunimed.id/events/e1/event/u-thumb.webp");
    expect(m.imageSize).toBeNull();
  });

  it("deskripsi mengikuti status: segera dibuka, berlangsung, selesai", () => {
    const d = (phase: "upcoming" | "live" | "ended") =>
      buildPageMeta({ ...home, phase }).description;
    expect(d("upcoming")).toContain("segera dibuka");
    expect(d("live")).toContain("kasih bintang");
    expect(d("ended")).toContain("sudah ditutup");
  });

  it("data terstruktur: WebSite, Organization LPPM UNIMED, dan Event dengan tanggal ISO", () => {
    const m = buildPageMeta({
      ...home,
      schedule: {
        startAt: Date.UTC(2026, 10, 20, 2),
        endAt: Date.UTC(2026, 10, 21, 10),
        updatedAt: 1,
      },
    });
    const graph = (m.jsonLd as { "@graph": { "@type": string; [k: string]: unknown }[] })["@graph"];
    expect(graph.map((n) => n["@type"])).toEqual(["WebSite", "Organization", "Event"]);
    const ev = graph[2] as Record<string, unknown>;
    expect(ev.startDate).toBe("2026-11-20T02:00:00.000Z");
    expect(ev.endDate).toBe("2026-11-21T10:00:00.000Z");
    expect(JSON.stringify(m.jsonLd)).toContain("lppm.unimed.ac.id");
  });

  it("Organization memuat logo: unggahan admin bila ada, selain itu logo resmi bawaan", () => {
    const withLogo = JSON.stringify(
      buildPageMeta({ ...home, logoKey: "events/e1/event/logo-full.webp" }).jsonLd,
    );
    expect(withLogo).toContain("https://media.eventunimed.id/events/e1/event/logo-full.webp");
    expect(JSON.stringify(buildPageMeta(home).jsonLd)).toContain(
      "https://eventunimed.id/brand/lppm-logo.png",
    );
  });

  it("tanpa jadwal, data terstruktur tidak memuat Event setengah jadi", () => {
    const graph = (buildPageMeta(home).jsonLd as { "@graph": { "@type": string }[] })["@graph"];
    expect(graph.some((n) => n["@type"] === "Event")).toBe(false);
  });
});

describe("buildPageMeta: booth", () => {
  it("judul '{booth} · {acara}'; tagline jadi deskripsi; tanpa tagline memakai kalimat mengajak", () => {
    const withTag = buildPageMeta(boothInput({ tagline: "Hangat" }));
    expect(withTag.title).toBe(`Kopi · ${base.eventName}`);
    expect(withTag.ogTitle).toBe("Kopi"); // judul pratinjau ringkas; nama acara ada di og:site_name
    expect(withTag.description).toMatch(/^Hangat\. Mampir ke booth Kopi di /);
    const noTag = buildPageMeta(boothInput({ tagline: "  " }));
    expect(noTag.description).toContain("Mampir ke booth Kopi");
  });

  it("institusi/fakultas masuk deskripsi dan teks alternatif gambar", () => {
    const m = buildPageMeta(boothInput({ teamName: "Fakultas Teknik" }));
    expect(m.description).toContain("Dari Fakultas Teknik.");
    expect(m.ogTitle).toBe("Kopi · Fakultas Teknik");
    expect(m.imageAlt).toBe("Kopi, Fakultas Teknik");
  });

  it("urutan cadangan gambar: produk → sampul booth → OG event → kartu ilustrasi", () => {
    const booth = { coverThumbKey: "b/cover-thumb.webp" };
    const product = { name: "P", priceIdr: 5000, thumbKey: "p/foto-thumb.webp" };
    const last = (m: ReturnType<typeof buildPageMeta>) => m.image.split("/").slice(-1)[0];
    expect(last(buildPageMeta({ ...boothInput(booth), product }))).toBe("foto-thumb.webp");
    expect(
      last(buildPageMeta({ ...boothInput(booth), product: { ...product, thumbKey: null } })),
    ).toBe("cover-thumb.webp");
    expect(last(buildPageMeta({ ...boothInput(), eventImageKey: "e/og-full.webp" }))).toBe(
      "og-thumb.webp",
    );
    const art = buildPageMeta(boothInput());
    expect(art.image).toBe(`https://eventunimed.id${foodOgPath(foodArtFor("x"))}`);
    expect(art.imageSize).toEqual({ width: 1200, height: 630 });
  });

  it("booth tanpa foto mendapat kartu ilustrasi yang stabil dan beragam antar booth", () => {
    const img = (id: string) => buildPageMeta(boothInput({ id })).image;
    expect(img("a")).toBe(img("a"));
    const distinct = new Set(Array.from({ length: 40 }, (_, i) => img(`booth-${i}`)));
    expect(distinct.size).toBeGreaterThan(6);
  });

  it("produk: judul memuat produk dan booth; deskripsi memuat harga (Gratis bila 0)", () => {
    const m = buildPageMeta({
      ...boothInput(),
      product: { name: "Kopi", priceIdr: 18000, thumbKey: null },
    });
    expect(m.title).toBe(`Kopi · Kopi · ${base.eventName}`);
    expect(m.description).toContain("Rp 18.000");
    const free = buildPageMeta({
      ...boothInput(),
      product: { name: "Sampel", priceIdr: 0, thumbKey: null },
    });
    expect(free.description).toContain("Gratis");
  });

  it("data terstruktur booth: WebPage + BreadcrumbList, TANPA rating/peringkat", () => {
    const m = buildPageMeta(boothInput({ updatedAt: 1_700_000_000_000 }));
    const json = JSON.stringify(m.jsonLd);
    expect(json).toContain('"BreadcrumbList"');
    expect(json).toContain('"WebPage"');
    expect(json).toContain("dateModified");
    expect(json).not.toMatch(/rating|review/i);
  });
});

describe("pratinjau tautan (WhatsApp): kualitas meta", () => {
  it("nomor booth masuk deskripsi; deskripsi tidak lebih dari 160 huruf dan satu baris", () => {
    const m = buildPageMeta(
      boothInput({
        boothNo: "A12",
        tagline: "Kopi\nbanget ".repeat(40),
        teamName: "Fakultas Teknik",
      }),
    );
    expect(m.description.length).toBeLessThanOrEqual(160);
    expect(m.description).not.toContain("\n");
    const plain = buildPageMeta(boothInput({ boothNo: "A12" }));
    expect(plain.description).toContain("booth Kopi (A12)");
  });

  it("jenis gambar mengikuti berkas (png kartu bawaan, webp foto unggahan)", () => {
    const html = "<html><head><title>x</title></head></html>";
    const card = injectMeta(html, buildPageMeta(home));
    expect(card).toContain('og:image:type" content="image/png"');
    const photo = injectMeta(html, buildPageMeta({ ...home, eventImageKey: "e/a-full.webp" }));
    expect(photo).toContain('og:image:type" content="image/webp"');
  });

  it("https: og:image:secure_url ikut; http (dev lokal) tidak", () => {
    const html = "<html><head><title>x</title></head></html>";
    expect(injectMeta(html, buildPageMeta(home))).toContain("og:image:secure_url");
    expect(
      injectMeta(html, buildPageMeta({ ...home, origin: "http://localhost:5173" })),
    ).not.toContain("og:image:secure_url");
  });

  it("og:title dan twitter:title memakai judul ringkas, <title> memakai judul lengkap", () => {
    const html = "<html><head><title>x</title></head></html>";
    const out = injectMeta(html, buildPageMeta(boothInput({ teamName: "Fakultas Teknik" })));
    expect(out).toContain('og:title" content="Kopi · Fakultas Teknik"');
    expect(out).toContain('twitter:title" content="Kopi · Fakultas Teknik"');
    expect(out).toContain(`<title>Kopi · ${base.eventName}</title>`);
  });
});

describe("buildPageMeta: hasil dan pendaftaran", () => {
  it("hasil: tidak diindeks sebelum diumumkan, diindeks sesudahnya", () => {
    const r = (published: boolean) =>
      buildPageMeta({ ...base, kind: "results", path: "/results", resultsPublished: published });
    expect(r(false).robots).toBe(ROBOTS_NOINDEX);
    expect(r(true).robots).toContain("index");
    expect(r(true).robots).not.toContain("noindex");
  });

  it("pendaftaran booth: noindex", () => {
    const m = buildPageMeta({ ...base, kind: "register", path: "/register" });
    expect(m.robots).toBe(ROBOTS_NOINDEX);
    expect(m.title).toContain("Daftarkan booth");
  });
});

describe("injectMeta", () => {
  const html = `<!doctype html><html><head><meta charset="UTF-8" /><title>Lama</title><meta name="description" content="lama" /><link rel="canonical" href="https://lama/" /><meta name="twitter:title" content="lama" /><script type="application/ld+json">{"lama":1}</script><meta name="theme-color" content="#1eb05f" /></head><body></body></html>`;
  const meta = buildPageMeta(home);

  it("mengganti judul, menambah og:*/twitter:*/canonical, tanpa menggandakan tag lama", () => {
    const out = injectMeta(html, meta);
    expect(out).toContain("<title>Penilaian Booth Terfavorit LPPM Expo Tahun 2026</title>");
    expect(out).toContain('rel="canonical" href="https://eventunimed.id/"');
    expect(out).toContain('property="og:site_name"');
    expect(out).toContain('property="og:locale" content="id_ID"');
    expect(out).toContain('property="og:image" content="https://eventunimed.id/og/default.png"');
    expect(out).toContain('property="og:image:width" content="1200"');
    expect(out).toContain('name="twitter:card" content="summary_large_image"');
    expect(out).toContain('name="twitter:image"');
    expect(out).toContain('name="robots" content="index, follow');
    expect(out.match(/name="description"/g)).toHaveLength(1);
    expect(out.match(/rel="canonical"/g)).toHaveLength(1);
    expect(out.match(/name="twitter:title"/g)).toHaveLength(1);
    expect(out.match(/application\/ld\+json/g)).toHaveLength(1);
    expect(out).not.toContain("lama");
    expect(out).toContain('name="theme-color"'); // tag statis lain tidak disentuh
    expect(out.indexOf("<meta property")).toBeLessThan(out.indexOf("</head>"));
  });

  it("gambar unggahan: tanpa og:image:width/height karena ukurannya tidak diketahui", () => {
    const out = injectMeta(html, buildPageMeta({ ...home, eventImageKey: "e/a-full.webp" }));
    expect(out).toContain("e/a-thumb.webp");
    expect(out).not.toContain("og:image:width");
  });

  it("nama booth jahat di-escape: tidak ada injeksi tag, atribut, atau penutup script", () => {
    const evil = '"><script>alert(1)</script></script><b>';
    const out = injectMeta(html, buildPageMeta(boothInput({ name: evil, tagline: evil })));
    expect(out).not.toContain("<script>alert");
    expect(out).toContain("&lt;script&gt;");
    expect(out).toContain("&quot;&gt;");
    // di dalam JSON-LD tidak ada "<" mentah yang bisa menutup <script>
    const ld = out.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] ?? "";
    expect(ld).not.toContain("<");
    expect(JSON.parse(ld)["@graph"]).toBeTruthy();
  });

  it("HTML tanpa <title> tetap mendapat judul", () => {
    const out = injectMeta("<html><head></head></html>", meta);
    expect(out).toContain("<title>Penilaian Booth Terfavorit LPPM Expo Tahun 2026</title>");
  });
});

describe("escapeHtml dan safeJsonLd", () => {
  it("meloloskan & < > \" '", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });
  it("JSON-LD tidak memuat < mentah dan tetap JSON valid", () => {
    const s = safeJsonLd({ a: "</script><b>" });
    expect(s).not.toContain("<");
    expect(JSON.parse(s)).toEqual({ a: "</script><b>" });
  });
});

describe("robots.txt, sitemap.xml, manifest", () => {
  it("robots.txt: izinkan semua, tutup jalur teknis, tunjuk sitemap absolut", () => {
    const t = buildRobotsTxt("https://eventunimed.id");
    expect(t).toContain("User-agent: *");
    expect(t).toContain("Disallow: /api/");
    expect(t).toContain("Disallow: /admin");
    expect(t).not.toMatch(/Disallow: \/\s*$/m);
    expect(t).toContain("Sitemap: https://eventunimed.id/sitemap.xml");
  });

  it("sitemap.xml: URL absolut di-escape, lastmod ISO, kosong tetap XML sah", () => {
    const xml = buildSitemapXml("https://eventunimed.id", [
      {
        path: "/b/a&b",
        lastModified: Date.UTC(2026, 10, 1),
        changeFrequency: "daily",
        priority: 0.6,
      },
    ]);
    expect(xml).toContain("<loc>https://eventunimed.id/b/a&amp;b</loc>");
    expect(xml).toContain("<lastmod>2026-11-01T00:00:00.000Z</lastmod>");
    expect(xml).toContain("<priority>0.6</priority>");
    expect(buildSitemapXml("https://x", [])).toContain("<urlset");
  });

  it("manifest memakai nama acara dan ikon yang ada di public/", () => {
    const m = buildManifest("Expo Rasa");
    expect(m.name).toBe("Expo Rasa");
    expect(m.short_name).toBe("Expo Rasa");
    expect(m.icons.map((i) => i.src)).toContain("/icon-512.png");
    expect(buildManifest(base.eventName).short_name).toBe("Booth Terfavorit");
  });
});
