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
  /** "Sering disebut" (A5): kategori ulasan terbanyak; kosong bila belum ada */
  topCategories: TopCategory[];
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

// ---------- Review dan pengunjung (Tahap 6) ----------

export type VisitorProvider = "google" | "email" | "ticket" | "anon";
export type ReviewerAuthMode = "google_or_email" | "ticket_code" | "open_turnstile";

/** Satu ulasan sebagaimana dilihat pengunjung lain. Komentar `held`/`hidden` TIDAK pernah ada di sini (B25). */
export interface PublicReview {
  id: string;
  /** null bila rating disembunyikan admin */
  stars: number | null;
  /** Teks komentar yang boleh tampil (disamarkan bila perlu) */
  text: string;
  displayName: string;
  categories: { id: string; label: string }[];
  createdAt: number;
}

export interface PublicReviews {
  reviews: PublicReview[];
  /** Kursor halaman berikutnya; null = habis */
  next: string | null;
}

/** "Sering disebut" (A5): kategori ulasan yang paling banyak dipilih untuk booth ini. */
export interface TopCategory {
  id: string;
  label: string;
  count: number;
}

/** Sesi pengunjung dan konfigurasi login (nilai publik; tidak ada rahasia). */
export interface VisitorMe {
  visitor: { id: string; displayName: string | null; provider: VisitorProvider } | null;
  authMode: ReviewerAuthMode;
  googleClientId: string | null;
  turnstileSiteKey: string | null;
  /** Booth yang sudah dinilai pengunjung ini (hanya bila masuk). Bintang null bila rating disembunyikan. */
  reviewed: { boothId: string; stars: number | null }[];
}

export interface MyReview {
  boothId: string;
  stars: number;
  comment: string | null;
  categoryIds: string[];
}

/** Hasil kirim review. Pesan netral: tidak pernah memberi tahu bahwa review ditahan atau kata mana yang tertangkap. */
export interface ReviewSubmitResult {
  review: MyReview;
  created: boolean;
  /** true bila komentar ditahan filter; boleh diberi tahu (A15), tidak menyebut kata */
  commentHeld: boolean;
  /** Ringkasan untuk layar terima kasih (A5) */
  progress: { reviewed: number; total: number };
  /** Booth lain yang belum dinilai (urutan acak dari server dengan seed pengunjung) */
  suggestions: { id: string; name: string }[];
}

export interface OtpRequestResult {
  ok: true;
  /** Hanya di pengembangan lokal (APP_ENV=development + localhost); tidak pernah di produksi. */
  devCode?: string;
}

// ---------- Moderasi (admin) ----------

export type CommentStatus = "visible" | "masked" | "held" | "hidden";
export type ReviewStatus = "visible" | "held" | "hidden";

export interface AdminReview {
  id: string;
  boothId: string;
  boothName: string;
  visitorId: string;
  displayName: string | null;
  stars: number;
  comment: string | null;
  commentStatus: CommentStatus;
  commentMasked: string | null;
  status: ReviewStatus;
  filterHits: number;
  commentLocked: boolean;
  riskScore: number | null;
  flags: string[];
  originalStars: number | null;
  originalComment: string | null;
  moderationReason: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface AdminReport {
  id: string;
  reviewId: string;
  reporterRole: "booth" | "visitor";
  reason: "profanity" | "hate" | "personal_data" | "spam" | "other";
  note: string | null;
  status: "open" | "upheld" | "dismissed";
  createdAt: number;
}

/** Satu entri antrean: komentar + semua laporannya. `suspicious` = pelapor (booth) cenderung melaporkan ulasan rendah. */
export interface AdminReportGroup {
  review: AdminReview;
  reports: AdminReport[];
  /** Urutan prioritas: SARA/data pribadi di atas */
  priority: number;
  suspiciousReporter: boolean;
}

export interface AdminModerationQueue {
  reports: AdminReportGroup[];
  /** Komentar ditahan filter/risiko yang menunggu keputusan (tanpa laporan) */
  held: AdminReview[];
}

export interface AdminTerm {
  id: string;
  term: string;
  lang: "id" | "en" | "regional";
  severity: "severe" | "mild";
  kind: "block" | "allow";
  match: "word" | "contains";
  enabled: boolean;
  source: string | null;
}

export interface ModerationTestResult {
  status: "visible" | "masked" | "held";
  masked: string | null;
  contact: boolean;
  /** Istilah yang tertangkap (hanya untuk admin) */
  matched: string[];
}
