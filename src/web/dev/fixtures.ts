// Fixture data booth/produk untuk galeri komponen dan matriks uji "data kosong" (explore.md A16, B26).
// Kunci gambar: "ok:N" → gambar contoh; "broken:N" → URL yang 404 (menguji gambar gagal dimuat).
import type { PublicBooth, PublicProduct } from "@shared/api-types";
import type { MediaUrlResolver } from "../lib/media-url";

/** Gambar contoh sebagai data URI SVG. Nama warna CSS (bukan hex) agar lolos lint-tokens. */
const SAMPLE_COLORS = ["tomato", "seagreen", "goldenrod", "steelblue", "orchid", "sienna"] as const;
function sampleImage(n: number): string {
  const a = SAMPLE_COLORS[n % SAMPLE_COLORS.length];
  const b = SAMPLE_COLORS[(n + 2) % SAMPLE_COLORS.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="400" height="300" fill="url(#g)"/><circle cx="${100 + n * 40}" cy="120" r="60" fill="white" fill-opacity="0.35"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Pemetaan untuk galeri dan tes: "ok:*" tampil, "broken:*" 404, selain itu /media/<kunci>. */
export const sampleResolver: MediaUrlResolver = (key) => {
  if (!key) return null;
  if (key.startsWith("ok:")) return sampleImage(Number(key.slice(3)) || 0);
  if (key.startsWith("broken:")) return `/media/events/gagal/${key.slice(7)}-thumb.webp`;
  return `/media/${key}`;
};

const base: PublicBooth = {
  id: "b-base",
  name: "Booth",
  boothNo: null,
  tagline: null,
  description: null,
  coverThumbKey: null,
  coverKey: null,
  ratingAverage: null,
  ratingCount: 0,
  priceFrom: null,
  allFree: false,
  featuredProduct: null,
};

export const BOOTHS = {
  lengkap: {
    ...base,
    id: "b-lengkap",
    name: "Kopi Rempah Nusantara",
    boothNo: "A12",
    tagline: "Hangat di lidah",
    description: "Kopi dengan rempah pilihan dari seluruh nusantara, diseduh di tempat.",
    coverThumbKey: "ok:1",
    coverKey: "ok:1",
    ratingAverage: 4.7,
    ratingCount: 24,
    priceFrom: 14000,
    featuredProduct: { id: "p1", name: "Kopi Rempah Susu", priceIdr: 18000, thumbKey: "ok:2" },
  },
  namaDanNomor: { ...base, id: "b-nomor", name: "Mie Ayam Bu Tini", boothNo: "B7" },
  hanyaNama: { ...base, id: "b-nama", name: "Es Teh Pak Budi" },
  fotoGagal404: {
    ...base,
    id: "b-gagal",
    name: "Roti Bakar Mas Agus",
    boothNo: "C3",
    description: "Roti bakar dengan isian cokelat dan keju.",
    coverThumbKey: "broken:1",
    coverKey: "broken:1",
    ratingAverage: 4.2,
    ratingCount: 9,
    priceFrom: 8000,
    featuredProduct: { id: "p2", name: "Roti Cokelat Keju", priceIdr: 12000, thumbKey: "broken:2" },
  },
  stringKosong: {
    ...base,
    id: "b-spasi",
    name: " Warung Spasi ",
    boothNo: "   ",
    tagline: "",
    description: "  ",
    coverThumbKey: "",
    coverKey: "",
  },
  namaPanjang: {
    ...base,
    id: "b-panjang",
    name: "Warungmakanpadangsederhanasangatpanjangnamanyatanpaspasiapapunjuga",
    boothNo: "D14",
  },
  namaSimbol: {
    ...base,
    id: "b-simbol",
    name: "🍜 Mie Ayam 🔥",
    ratingAverage: 3.8,
    ratingCount: 5,
  },
  gratis: {
    ...base,
    id: "b-gratis",
    name: "Workshop Daur Ulang",
    boothNo: "E1",
    allFree: true,
    coverThumbKey: "ok:3",
    coverKey: "ok:3",
    ratingAverage: 5,
    ratingCount: 3,
  },
} satisfies Record<string, PublicBooth>;

export type BoothFixtureName = keyof typeof BOOTHS;
export const BOOTH_NAMES = Object.keys(BOOTHS) as BoothFixtureName[];

const pbase: PublicProduct = {
  id: "pr-base",
  name: "Produk",
  description: null,
  category: null,
  priceIdr: 10000,
  comparePriceIdr: null,
  badge: null,
  thumbKey: null,
  fullKey: null,
};

export const PRODUCTS = {
  lengkap: {
    ...pbase,
    id: "pr-lengkap",
    name: "Kopi Rempah Susu",
    description: "Kopi dengan rempah dan susu segar.",
    category: "Minuman",
    priceIdr: 18000,
    comparePriceIdr: 24000,
    badge: "limited",
    thumbKey: "ok:2",
    fullKey: "ok:2",
  },
  tanpaFoto: { ...pbase, id: "pr-nofoto", name: "Teh Tarik", priceIdr: 9000, category: "Minuman" },
  fotoGagal404: {
    ...pbase,
    id: "pr-gagal",
    name: "Kue Lapis",
    priceIdr: 6500,
    thumbKey: "broken:1",
    fullKey: "broken:1",
  },
  gratis: { ...pbase, id: "pr-gratis", name: "Sampel Gratis", priceIdr: 0, badge: "new" },
  namaPanjang: {
    ...pbase,
    id: "pr-panjang",
    name: "Nasi goreng spesial dengan telur mata sapi dan kerupuk udang",
    priceIdr: 25000,
  },
} satisfies Record<string, PublicProduct>;
