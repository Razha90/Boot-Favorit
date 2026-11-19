// Pratinjau tautan (WhatsApp, media sosial) dan judul tab (explore.md B20). Aplikasi ini SPA yang tidak menyajikan
// meta tag per halaman, jadi Worker menyisipkannya ke index.html saat menyajikan `/` dan `/b/:id`.
// Fungsi murni (mudah diuji); penyisipan memakai string biasa karena index.html kecil dan tidak bergantung
// pada global HTMLRewriter (tidak ada di tes Node).

export interface PageMeta {
  title: string;
  description: string;
  /** URL absolut gambar, atau null (tag og:image tidak dikirim; tidak pernah URL kosong) */
  image: string | null;
  url: string;
}

const rupiah = (n: number) =>
  n === 0 ? "Gratis" : `Rp ${new Intl.NumberFormat("id-ID").format(n)}`;

export interface MetaInput {
  eventName: string;
  origin: string;
  path: string;
  /** Alamat dasar gambar (MEDIA_BASE_URL atau `${origin}/media`) tanpa garis miring akhir */
  mediaBase: string;
  eventImageKey: string | null;
  booth?: { name: string; tagline: string | null; coverThumbKey: string | null } | null;
  product?: { name: string; priceIdr: number; thumbKey: string | null } | null;
}

const toThumb = (key: string) => key.replace(/-full\.webp$/, "-thumb.webp");

export function buildPageMeta(i: MetaInput): PageMeta {
  const url = `${i.origin}${i.path}`;
  const img = (key: string | null | undefined) => (key ? `${i.mediaBase}/${toThumb(key)}` : null);

  if (i.booth && i.product) {
    return {
      title: `${i.product.name} · ${i.booth.name} · ${i.eventName}`,
      description: `${i.product.name} (${rupiah(i.product.priceIdr)}) di booth ${i.booth.name}. Mampir yuk!`,
      // Urutan cadangan: foto produk → foto sampul booth → gambar OG event → tanpa gambar
      image: img(i.product.thumbKey) ?? img(i.booth.coverThumbKey) ?? img(i.eventImageKey),
      url,
    };
  }
  if (i.booth) {
    return {
      title: `${i.booth.name} · ${i.eventName}`,
      description:
        i.booth.tagline?.trim() ||
        `Mampir ke booth ${i.booth.name} di ${i.eventName}, lalu kasih bintang!`,
      image: img(i.booth.coverThumbKey) ?? img(i.eventImageKey),
      url,
    };
  }
  return {
    title: i.eventName,
    description: `Yuk, mampir ke booth-booth ${i.eventName} dan kasih bintang buat favoritmu!`,
    image: img(i.eventImageKey),
    url,
  };
}

export const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Sisipkan judul dan meta tag ke HTML. Tag lama dengan nama yang sama tidak diduplikasi. */
export function injectMeta(html: string, m: PageMeta): string {
  const tags = [
    `<meta name="description" content="${escapeHtml(m.description)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${escapeHtml(m.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(m.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(m.url)}" />`,
    ...(m.image
      ? [
          `<meta property="og:image" content="${escapeHtml(m.image)}" />`,
          `<meta name="twitter:card" content="summary_large_image" />`,
        ]
      : [`<meta name="twitter:card" content="summary" />`]),
  ].join("\n    ");

  const withoutOld = html
    .replace(/<meta\s+name="description"[^>]*>\s*/gi, "")
    .replace(/<meta\s+property="og:[^"]*"[^>]*>\s*/gi, "");
  const withTitle = /<title>[\s\S]*?<\/title>/i.test(withoutOld)
    ? withoutOld.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(m.title)}</title>`)
    : withoutOld.replace(/<\/head>/i, `<title>${escapeHtml(m.title)}</title></head>`);
  return withTitle.replace(/<\/head>/i, `    ${tags}\n  </head>`);
}
