// Pratinjau tautan (WhatsApp, media sosial), SEO, dan judul tab (explore.md B20, B27). Aplikasi ini SPA yang
// tidak menyajikan meta tag per halaman, jadi Worker menyisipkannya ke index.html saat menyajikan `/`, `/b/:id`,
// `/results`, dan `/register`. Fungsi murni (mudah diuji); penyisipan memakai string biasa karena index.html kecil
// dan tidak bergantung pada global HTMLRewriter (tidak ada di tes Node).

import { BRAND_LOGO_PATH } from "@shared/brand";
import type { EventPhase } from "@shared/event-state";
import { DEFAULT_OG_PATH, foodArtFor, foodOgPath } from "@shared/food-art";

export interface PageMeta {
  /** Judul tab dan hasil pencarian */
  title: string;
  /** Judul pratinjau tautan: lebih ringkas (WhatsApp memotong ±65 huruf; nama acara ada di og:site_name) */
  ogTitle: string;
  description: string;
  /** URL absolut gambar pratinjau. Selalu ada: cadangan terakhir adalah kartu bawaan (tidak pernah URL kosong) */
  image: string;
  imageAlt: string;
  /** Hanya untuk kartu bawaan (ukurannya pasti); foto unggahan tidak diketahui ukurannya */
  imageSize: { width: number; height: number } | null;
  /** URL kanonis: tanpa query (`?src=share`, `?p=` tidak membuat halaman ganda di mesin pencari) */
  url: string;
  siteName: string;
  /** Nilai meta robots / header X-Robots-Tag */
  robots: string;
  /** Data terstruktur schema.org; null = tidak ada */
  jsonLd: unknown | null;
}

export const ROBOTS_INDEX = "index, follow, max-image-preview:large, max-snippet:-1";
export const ROBOTS_NOINDEX = "noindex, follow";

/** Kartu pratinjau bawaan dibuat `scripts/build-art.mjs` dengan ukuran ini. */
const OG_CARD = { width: 1200, height: 630 } as const;
const ORGANIZER = { name: "LPPM UNIMED", url: "https://lppm.unimed.ac.id" } as const;

/** Deskripsi pratinjau: satu baris rapi, maks. ±160 huruf (WhatsApp/Google memotong lebih dari itu). */
const clip = (s: string, max = 160) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
};

/** Kalimat berakhir tanda baca (agar bisa digabung dengan kalimat lain); kosong → null. */
const sentence = (s: string | null | undefined) => {
  const t = s?.trim();
  return t ? (/[.!?…]$/.test(t) ? t : `${t}.`) : null;
};

const imageTypeOf = (url: string) =>
  /\.png(\?|$)/i.test(url) ? "image/png" : /\.jpe?g(\?|$)/i.test(url) ? "image/jpeg" : "image/webp";

const rupiah = (n: number) =>
  n === 0 ? "Gratis" : `Rp ${new Intl.NumberFormat("id-ID").format(n)}`;

export type PageKind = "home" | "booth" | "results" | "register";

export interface MetaInput {
  kind: PageKind;
  eventName: string;
  origin: string;
  path: string;
  /** Alamat dasar gambar (MEDIA_BASE_URL atau `${origin}/media`) tanpa garis miring akhir */
  mediaBase: string;
  eventImageKey: string | null;
  /** Logo penyelenggara yang diunggah admin (kunci full), bila ada */
  logoKey?: string | null;
  phase?: EventPhase;
  resultsPublished?: boolean;
  schedule?: { startAt: number; endAt: number; updatedAt: number };
  booth?: {
    id: string;
    name: string;
    boothNo?: string | null;
    tagline: string | null;
    teamName?: string | null;
    coverThumbKey: string | null;
    updatedAt?: number;
  } | null;
  product?: { name: string; priceIdr: number; thumbKey: string | null } | null;
}

const toThumb = (key: string) => key.replace(/-full\.webp$/, "-thumb.webp");

const homeDescription = (name: string, phase: EventPhase | undefined) => {
  if (phase === "upcoming")
    return `Voting segera dibuka! Kenali dulu booth-booth ${name}, lalu kasih bintang buat favoritmu.`;
  if (phase === "ended")
    return `Voting ${name} sudah ditutup. Intip booth yang ikut serta dan hasil booth terfavoritnya.`;
  return `Yuk, mampir ke booth-booth ${name} dan kasih bintang buat favoritmu!`;
};

export function buildPageMeta(i: MetaInput): PageMeta {
  const canonical = `${i.origin}${i.path.split("?")[0]}`;
  const media = (key: string | null | undefined) => (key ? `${i.mediaBase}/${toThumb(key)}` : null);
  const card = (path: string) => ({
    image: `${i.origin}${path}`,
    imageSize: OG_CARD as { width: number; height: number } | null,
  });
  const pick = (
    primary: (string | null)[],
    fallbackCard: string,
  ): { image: string; imageSize: { width: number; height: number } | null } => {
    const photo = primary.find((p): p is string => !!p);
    return photo ? { image: photo, imageSize: null } : card(fallbackCard);
  };

  const common = { url: canonical, siteName: i.eventName, robots: ROBOTS_INDEX, jsonLd: null };
  const org = {
    "@type": "Organization",
    "@id": `${i.origin}/#organizer`,
    ...ORGANIZER,
    logo: {
      "@type": "ImageObject",
      url: i.logoKey ? `${i.mediaBase}/${i.logoKey}` : `${i.origin}${BRAND_LOGO_PATH}`,
    },
  };
  const website = {
    "@type": "WebSite",
    "@id": `${i.origin}/#website`,
    url: `${i.origin}/`,
    name: i.eventName,
    inLanguage: "id-ID",
    publisher: { "@id": org["@id"] },
  };

  if (i.kind === "booth" && i.booth) {
    const b = i.booth;
    const team = b.teamName?.trim() || null;
    const title = i.product
      ? `${i.product.name} · ${b.name} · ${i.eventName}`
      : `${b.name} · ${i.eventName}`;
    const ogTitle = i.product
      ? `${i.product.name} · ${b.name}`
      : team
        ? `${b.name} · ${team}`
        : b.name;
    const where = `booth ${b.name}${b.boothNo?.trim() ? ` (${b.boothNo.trim()})` : ""}`;
    const description = clip(
      i.product
        ? `${i.product.name} (${rupiah(i.product.priceIdr)}) di booth ${b.name}${team ? `, ${team}` : ""}. Mampir yuk!`
        : [
            sentence(b.tagline),
            team ? `Dari ${team}.` : null,
            `Mampir ke ${where} di ${i.eventName}, lalu kasih bintang!`,
          ]
            .filter(Boolean)
            .join(" "),
    );
    // Urutan cadangan: foto produk → foto sampul booth → gambar OG event → kartu ilustrasi (beragam per booth)
    const img = pick(
      [media(i.product?.thumbKey), media(b.coverThumbKey), media(i.eventImageKey)],
      foodOgPath(foodArtFor(b.id)),
    );
    return {
      ...common,
      ...img,
      title,
      ogTitle,
      description,
      imageAlt: team ? `${b.name}, ${team}` : b.name,
      // Tanpa rating atau peringkat: admin boleh menyembunyikannya, dan swa-ulasan tidak layak untuk rich result.
      jsonLd: {
        "@context": "https://schema.org",
        "@graph": [
          website,
          {
            "@type": "WebPage",
            "@id": `${canonical}#page`,
            url: canonical,
            name: title,
            description,
            inLanguage: "id-ID",
            isPartOf: { "@id": website["@id"] },
            primaryImageOfPage: { "@type": "ImageObject", url: img.image },
            ...(b.updatedAt ? { dateModified: new Date(b.updatedAt).toISOString() } : {}),
          },
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: i.eventName, item: `${i.origin}/` },
              { "@type": "ListItem", position: 2, name: b.name, item: canonical },
            ],
          },
        ],
      },
    };
  }

  if (i.kind === "results") {
    const published = i.resultsPublished === true;
    return {
      ...common,
      ...pick([media(i.eventImageKey)], DEFAULT_OG_PATH),
      title: `Hasil · ${i.eventName}`,
      ogTitle: `Hasil · ${i.eventName}`,
      description: published
        ? `Lihat booth terfavorit hasil penilaian pengunjung ${i.eventName}.`
        : `Hasil penilaian pengunjung ${i.eventName} akan tampil di sini setelah diumumkan.`,
      imageAlt: i.eventName,
      // Halaman kosong sebelum pengumuman tidak berguna di hasil pencarian
      robots: published ? ROBOTS_INDEX : ROBOTS_NOINDEX,
    };
  }

  if (i.kind === "register") {
    return {
      ...common,
      ...pick([media(i.eventImageKey)], DEFAULT_OG_PATH),
      title: `Daftarkan booth · ${i.eventName}`,
      ogTitle: `Daftarkan booth · ${i.eventName}`,
      description: `Punya booth di ${i.eventName}? Daftarkan di sini supaya pengunjung bisa menemukan dan menilai booth kamu.`,
      imageAlt: i.eventName,
      robots: ROBOTS_NOINDEX,
    };
  }

  // home
  const img = pick([media(i.eventImageKey)], DEFAULT_OG_PATH);
  const description = homeDescription(i.eventName, i.phase);
  const event = i.schedule
    ? {
        "@type": "Event",
        "@id": `${i.origin}/#event`,
        name: i.eventName,
        description,
        url: `${i.origin}/`,
        startDate: new Date(i.schedule.startAt).toISOString(),
        endDate: new Date(i.schedule.endAt).toISOString(),
        eventStatus: "https://schema.org/EventScheduled",
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        isAccessibleForFree: true,
        inLanguage: "id-ID",
        image: [img.image],
        organizer: { "@id": org["@id"] },
      }
    : null;
  return {
    ...common,
    ...img,
    title: i.eventName,
    ogTitle: i.eventName,
    description: clip(description),
    imageAlt: i.eventName,
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [website, org, ...(event ? [event] : [])],
    },
  };
}

export const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** JSON untuk di dalam <script>: `<` di-escape agar `</script>` di nilai mana pun tidak menutup tag. */
export const safeJsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, String.raw`\u003c`);

/** Sisipkan judul dan meta tag ke HTML. Tag lama dengan nama yang sama tidak diduplikasi. */
export function injectMeta(html: string, m: PageMeta): string {
  const e = escapeHtml;
  const tags = [
    `<meta name="description" content="${e(m.description)}" />`,
    `<meta name="robots" content="${e(m.robots)}" />`,
    `<link rel="canonical" href="${e(m.url)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${e(m.siteName)}" />`,
    `<meta property="og:locale" content="id_ID" />`,
    `<meta property="og:title" content="${e(m.ogTitle)}" />`,
    `<meta property="og:description" content="${e(m.description)}" />`,
    `<meta property="og:url" content="${e(m.url)}" />`,
    `<meta property="og:image" content="${e(m.image)}" />`,
    ...(m.image.startsWith("https://")
      ? [`<meta property="og:image:secure_url" content="${e(m.image)}" />`]
      : []),
    `<meta property="og:image:type" content="${imageTypeOf(m.image)}" />`,
    `<meta property="og:image:alt" content="${e(m.imageAlt)}" />`,
    ...(m.imageSize
      ? [
          `<meta property="og:image:width" content="${m.imageSize.width}" />`,
          `<meta property="og:image:height" content="${m.imageSize.height}" />`,
        ]
      : []),
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${e(m.ogTitle)}" />`,
    `<meta name="twitter:description" content="${e(m.description)}" />`,
    `<meta name="twitter:image" content="${e(m.image)}" />`,
    `<meta name="twitter:image:alt" content="${e(m.imageAlt)}" />`,
    ...(m.jsonLd ? [`<script type="application/ld+json">${safeJsonLd(m.jsonLd)}</script>`] : []),
  ].join("\n    ");

  const withoutOld = html
    .replace(/<meta\s+name="(?:description|robots)"[^>]*>\s*/gi, "")
    .replace(/<meta\s+(?:property|name)="(?:og|twitter):[^"]*"[^>]*>\s*/gi, "")
    .replace(/<link\s+rel="canonical"[^>]*>\s*/gi, "")
    .replace(/<script\s+type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>\s*/gi, "");
  const withTitle = /<title>[\s\S]*?<\/title>/i.test(withoutOld)
    ? withoutOld.replace(/<title>[\s\S]*?<\/title>/i, `<title>${e(m.title)}</title>`)
    : withoutOld.replace(/<\/head>/i, `<title>${e(m.title)}</title></head>`);
  return withTitle.replace(/<\/head>/i, `    ${tags}\n  </head>`);
}

// ---------- robots.txt, sitemap.xml, manifest ----------

export function buildRobotsTxt(origin: string): string {
  return [
    "User-agent: *",
    "Allow: /",
    // Jalur teknis dan area pengelola: tak berguna di hasil pencarian (area admin juga dilindungi Cloudflare Access).
    "Disallow: /api/",
    "Disallow: /admin",
    "Disallow: /go/",
    "Disallow: /ws",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");
}

export interface SitemapEntry {
  path: string;
  lastModified?: number;
  changeFrequency?: "always" | "hourly" | "daily" | "weekly" | "monthly";
  priority?: number;
}

export function buildSitemapXml(origin: string, entries: readonly SitemapEntry[]): string {
  const items = entries.map((x) =>
    [
      "  <url>",
      `    <loc>${escapeHtml(`${origin}${x.path}`)}</loc>`,
      ...(x.lastModified
        ? [`    <lastmod>${new Date(x.lastModified).toISOString()}</lastmod>`]
        : []),
      ...(x.changeFrequency ? [`    <changefreq>${x.changeFrequency}</changefreq>`] : []),
      ...(x.priority !== undefined ? [`    <priority>${x.priority.toFixed(1)}</priority>`] : []),
      "  </url>",
    ].join("\n"),
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items.join("\n")}\n</urlset>\n`;
}

export function buildManifest(eventName: string) {
  return {
    name: eventName,
    short_name: eventName.length <= 14 ? eventName : "Booth Terfavorit",
    description: homeDescription(eventName, "live"),
    lang: "id",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#faf8f5",
    theme_color: "#1eb05f",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
