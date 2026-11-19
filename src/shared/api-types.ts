// Bentuk respons API admin yang dipakai client DAN server (hanya tipe). Server menandai nilai baliknya
// dengan tipe ini, jadi perubahan bentuk langsung menggagalkan typecheck di kedua sisi.

import type { OwnerState } from "./booth";
import type { EventSchedule, EventState, ScheduleWarning } from "./event-state";
import type { EventSettings } from "./schemas";
import type { Completeness } from "./visual";

export type BoothStatus = "pending" | "approved" | "rejected" | "revision" | "suspended";
export type ProductStatus = "active" | "hidden" | "removed_by_admin";
export type DisplayMode = "visible" | "hidden" | "on_results";

export interface AdminEventView {
  id: string;
  slug: string;
  name: string;
  titleHighlight: string | null;
  timezone: string;
  isActive: boolean;
  hiddenFromPublic: boolean;
  visibility: "draft" | "published";
  schedule: EventSchedule;
  settings: EventSettings;
  state: EventState;
  warnings: ScheduleWarning[];
  ratingsMode: DisplayMode;
  rankingMode: DisplayMode;
  resultsPublishedAt: number | null;
  versions: { active: number; stats: number; results: number };
  media: PublicEventMedia;
  createdAt: number;
  updatedAt: number;
}

export interface AdminBoothView {
  id: string;
  eventId: string;
  name: string;
  boothNo: string | null;
  email: string | null;
  ownerState: OwnerState;
  tagline: string | null;
  description: string | null;
  about: string | null;
  teamName: string | null;
  status: BoothStatus;
  rejectReason: string | null;
  approvedBy: string | null;
  approvedAt: number | null;
  isLate: boolean;
  createdBy: "self" | "admin";
  createdAt: number;
  /** Token versi untuk kontrol konkurensi (kirim kembali sebagai `version` saat menyunting). */
  version: number;
  logoKey: string | null;
  coverThumbKey: string | null;
  photoCount: number;
  productCount: number;
  hasWhatsapp: boolean;
  whatsappConsentBy: "owner" | "admin" | null;
  completeness: Completeness;
  reviewCount: number;
  average: number | null;
}

export interface PhotoView {
  id: string;
  keyFull: string;
  keyThumb: string;
  position: number;
}

export interface ProductView {
  id: string;
  boothId: string;
  name: string;
  description: string | null;
  category: string | null;
  priceIdr: number;
  comparePriceIdr: number | null;
  badge: "limited" | "new" | null;
  isFeatured: boolean;
  status: ProductStatus;
  keyFull: string | null;
  keyThumb: string | null;
  position: number;
  version: number;
}

export interface CategoryView {
  id: string;
  eventId: string;
  label: string;
  position: number;
  active: number;
}

export type ImportRowResult =
  | { index: number; status: "created"; id: string }
  | { index: number; status: "skipped"; reason: "duplicate_name" }
  | {
      index: number;
      status: "error";
      reason: "email_in_use" | "email_duplicate_in_file" | "chunk_failed";
    };

export interface ImportSummary {
  created: number;
  skipped: number;
  errors: number;
  results: ImportRowResult[];
}

// ---------- Data publik booth (dikirim ke pengunjung; Tahap 5 mengisinya dari snapshot) ----------

/** Produk andalan ringkas (kartu mini di sorotan, B24). */
export interface FeaturedProductBrief {
  id: string;
  name: string;
  priceIdr: number;
  thumbKey: string | null;
}

/** Satu booth sebagaimana dilihat pengunjung. Server mengirim `null`, tidak pernah URL pengganti (A16). */
export interface PublicBooth {
  id: string;
  name: string;
  boothNo: string | null;
  tagline: string | null;
  description: string | null;
  /** Kunci foto sampul ukuran kecil (kartu) dan penuh (sorotan); null = tanpa foto */
  coverThumbKey: string | null;
  coverKey: string | null;
  /** null = belum ada ulasan; disembunyikan admin → `ratingsHidden` di tampilan, bukan di sini */
  ratingAverage: number | null;
  ratingCount: number;
  /** Harga terendah > 0 dari produk aktif; null bila tanpa produk atau semua gratis */
  priceFrom: number | null;
  /** true bila ada produk tetapi semuanya gratis (stiker "Gratis") */
  allFree: boolean;
  featuredProduct: FeaturedProductBrief | null;
}

export interface PublicProduct {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  priceIdr: number;
  comparePriceIdr: number | null;
  badge: "limited" | "new" | null;
  thumbKey: string | null;
  fullKey: string | null;
}

// ---------- Respons publik (Tahap 5) ----------

export interface PublicEventMedia {
  logoKey: string | null;
  ogImageKey: string | null;
  /** 0–3 foto suasana acara untuk kolase hero (kunci full; thumb diturunkan) */
  heroKeys: string[];
}

/** Daftar booth tayang + statistik ringkas. Rating tidak dikirim bila disembunyikan admin (A3). */
export interface PublicSnapshot {
  eventId: string;
  /** true = admin menyembunyikan rating: angka, bintang, dan jumlah ulasan TIDAK ada di data */
  ratingsHidden: boolean;
  booths: PublicBooth[];
  stats: { boothCount: number; reviewCount: number; average: number | null };
}

export interface PublicBoothDetail extends PublicBooth {
  about: string | null;
  teamName: string | null;
  photos: { keyFull: string; keyThumb: string }[];
  ratingsHidden: boolean;
  /** Sebaran bintang [★1..★5]; null bila rating disembunyikan */
  distribution: [number, number, number, number, number] | null;
  /** Ada nomor WhatsApp? (nomornya sendiri TIDAK pernah dikirim; B24). False setelah event selesai. */
  hasWhatsapp: boolean;
}

export interface PublicProducts {
  products: PublicProduct[];
  hasWhatsapp: boolean;
}

/** Event sebagaimana dilihat publik (`GET /api/event`). Status dihitung di client dari `schedule` + waktu server. */
export interface PublicEvent {
  id: string;
  name: string;
  titleHighlight: string | null;
  timezone: string;
  schedule: EventSchedule;
  ratingsMode: DisplayMode;
  rankingMode: DisplayMode;
  versions: { active: number; stats: number; results: number };
  reviewCategories: { id: string; label: string }[];
  media: PublicEventMedia;
}

export interface PublicEventResponse {
  /** null = belum ada event aktif/terbit atau disembunyikan admin → layar "Segera hadir" (A0) */
  event: PublicEvent | null;
  serverNow: number;
}
