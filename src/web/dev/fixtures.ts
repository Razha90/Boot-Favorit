// Fixture data booth/produk untuk galeri komponen dan matriks uji "data kosong" (explore.md A16, B26).
// Kunci gambar: "ok:N" → gambar contoh; "broken:N" → URL yang 404 (menguji gambar gagal dimuat).
import type { PublicBooth, PublicProduct, PublicReview } from "@shared/api-types";
import type { ResultEntry } from "@shared/results";
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
  teamName: null,
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
    teamName: "Fakultas Pariwisata",
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
  namaDanNomor: {
    ...base,
    id: "b-nomor",
    name: "Mie Ayam Bu Tini",
    teamName: "Prodi Tata Boga",
    boothNo: "B7",
  },
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

// ---------- Ulasan (Tahap 6) ----------

const rbase: PublicReview = {
  id: "rv-base",
  stars: 4,
  text: "Kopinya enak dan pelayanannya ramah.",
  displayName: "Budi",
  categories: [],
  createdAt: 1,
};

export const REVIEWS = {
  lengkap: {
    ...rbase,
    id: "rv-lengkap",
    stars: 5,
    categories: [
      { id: "c1", label: "Seru" },
      { id: "c2", label: "Ramah" },
    ],
  },
  tanpaKategori: { ...rbase, id: "rv-nokat" },
  ratingDisembunyikan: { ...rbase, id: "rv-hidden", stars: null },
  tanpaNama: { ...rbase, id: "rv-pengunjung", displayName: "Pengunjung" },
  teksPanjang: {
    ...rbase,
    id: "rv-panjang",
    text: `${"Pelayanannya cepat dan ramah sekali, ".repeat(7)}`.trim(),
  },
  tanpaSpasi: { ...rbase, id: "rv-tanpaspasi", text: "Enak".repeat(70) },
  emoji: { ...rbase, id: "rv-emoji", text: "Mantap banget 🍜🔥👍", displayName: "Siti 🌸" },
  samaran: { ...rbase, id: "rv-samaran", text: "Kopinya enak tapi antrean a***r lama" },
  namaPanjang: {
    ...rbase,
    id: "rv-namapanjang",
    displayName: "Namaparahpanjangtanpaspasiapapunjugasampaisepuluhhuruf",
  },
  multibaris: { ...rbase, id: "rv-multi", text: "Baris pertama.\n\nBaris ketiga setelah jeda." },
} satisfies Record<string, PublicReview>;

// ---------- Hasil akhir (Tahap 7) ----------

const rentry = (id: string, rank: number | null, over: Partial<ResultEntry> = {}): ResultEntry => ({
  boothId: id,
  rank,
  name: `Booth ${id.toUpperCase()}`,
  boothNo: null,
  coverThumbKey: null,
  average: rank ? 5 - rank * 0.25 : null,
  reviewCount: rank ? 30 - rank * 3 : 0,
  score: rank ? 4.6 - rank * 0.1 : null,
  topCategories: [],
  ...over,
});

export const RESULT_ENTRIES = {
  lengkap: [
    rentry("a", 1, {
      name: "Kopi Rempah Nusantara",
      boothNo: "A12",
      coverThumbKey: "ok:1",
      topCategories: [
        { label: "Seru", count: 12 },
        { label: "Ramah", count: 8 },
        { label: "Bermanfaat", count: 2 },
      ],
    }),
    rentry("b", 2, {
      name: "Mie Ayam Bu Tini",
      boothNo: "B7",
      coverThumbKey: "ok:2",
      topCategories: [{ label: "Kreatif", count: 9 }],
    }),
    rentry("c", 3, { name: "Workshop Daur Ulang", coverThumbKey: "ok:3" }),
    rentry("d", 4, { name: "Roti Bakar Mas Agus", coverThumbKey: "broken:1" }),
    rentry("e", 5, { name: "Es Teh Pak Budi" }),
    rentry("x", null, { name: "Warung Baru", reviewCount: 1, average: 4 }),
    rentry("y", null, { name: "Booth tanpa ulasan" }),
  ],
  hanyaDuaDiperingkat: [
    rentry("a", 1, { coverThumbKey: "ok:1" }),
    rentry("b", 2),
    rentry("x", null),
  ],
  tanpaPeringkat: [rentry("x", null), rentry("y", null)],
  namaAneh: [
    rentry("a", 1, { name: "Warung".repeat(15) }),
    rentry("b", 2, { name: "🍜 Mie Ayam 🔥" }),
    rentry("c", 3, { name: " Warung Spasi ", boothNo: "   " }),
  ],
  kosong: [] as ResultEntry[],
} satisfies Record<string, ResultEntry[]>;
