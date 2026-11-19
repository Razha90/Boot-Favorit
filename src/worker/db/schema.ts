// Skema D1 (SQLite), explore.md B6. Waktu = epoch ms UTC (integer). Boolean = integer 0/1.
// Semua tabel yang relevan membawa event_id (isolasi per-event, B11).
// Nilai enum di sini harus sama dengan yang dipakai shared/schemas.ts.

import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const id = () => text("id").primaryKey();
const createdAt = () => integer("created_at").notNull();
const updatedAt = () => integer("updated_at").notNull();
const flag = (name: string, def = 0) => integer(name).notNull().default(def);

export const MODES = ["visible", "hidden", "on_results"] as const;
export const BOOTH_STATUSES = ["pending", "approved", "rejected", "revision", "suspended"] as const;
export const REVIEW_STATUSES = ["visible", "held", "hidden"] as const;
export const COMMENT_STATUSES = ["visible", "masked", "held", "hidden"] as const;

// ---------- events ----------

export const events = sqliteTable(
  "events",
  {
    id: id(),
    slug: text("slug").notNull().unique(), // hanya pengenal arsip/admin, TIDAK dipakai di URL publik
    name: text("name").notNull(), // nama resmi acara = judul utama
    isActive: flag("is_active"), // tepat satu event aktif (indeks unik parsial)
    hiddenFromPublic: flag("hidden_from_public"),
    activeVersion: flag("active_version"), // naik tiap event aktif berganti → kunci cache
    visibility: text("visibility", { enum: ["draft", "published"] })
      .notNull()
      .default("draft"),
    timezone: text("timezone").notNull().default("Asia/Jakarta"),

    // JADWAL (epoch ms UTC). Status dihitung dari sini, tidak disimpan (B17).
    registrationOpenAt: integer("registration_open_at"), // NULL = terbuka sejak dipublikasikan
    registrationCloseAt: integer("registration_close_at").notNull(),
    eventStartAt: integer("event_start_at").notNull(),
    eventEndAt: integer("event_end_at").notNull(),
    resultsPublishedAt: integer("results_published_at"),

    ratingsMode: text("ratings_mode", { enum: MODES }).notNull().default("visible"),
    rankingMode: text("ranking_mode", { enum: MODES }).notNull().default("visible"),
    resultsJson: text("results_json"), // seluruh peringkat akhir, dibekukan saat "Umumkan hasil"
    resultsVersion: flag("results_version"),
    revealSeq: flag("reveal_seq"),
    revealStartedAt: integer("reveal_started_at"),
    revealJson: text("reveal_json"),
    revealTarget: text("reveal_target", { enum: ["screen", "everyone"] })
      .notNull()
      .default("screen"),
    statsVersion: flag("stats_version"), // naik tiap perubahan admin pada review/booth → kunci cache

    titleHighlight: text("title_highlight"),
    logoKey: text("logo_key"),
    ogImageKey: text("og_image_key"),
    heroKeysJson: text("hero_keys_json"), // 0–3 foto suasana acara untuk kolase hero
    contactJson: text("contact_json"),
    socialJson: text("social_json"),
    themeJson: text("theme_json"),
    settingsJson: text("settings_json"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("one_active").on(t.isActive).where(sql`${t.isActive} = 1`),
    check("events_start_before_end", sql`${t.eventStartAt} < ${t.eventEndAt}`),
    check(
      "events_registration_window",
      sql`${t.registrationOpenAt} IS NULL OR ${t.registrationOpenAt} < ${t.registrationCloseAt}`,
    ),
    check("events_active_flag", sql`${t.isActive} IN (0, 1)`),
  ],
);

// ---------- booths (A16: hanya name yang wajib; email boleh NULL = tanpa pemilik) ----------

export const booths = sqliteTable(
  "booths",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id),
    email: text("email"), // NULL = booth tanpa pemilik; bila terisi: huruf kecil + trim
    name: text("name").notNull(),
    description: text("description"),
    about: text("about"), // teks "Kenalan" panjang (CONFIG.booth.aboutMaxLength)
    tagline: text("tagline"),
    teamName: text("team_name"), // nama tim/prodi (chip di halaman booth)
    logoKey: text("logo_key"),
    boothNo: text("booth_no"),
    status: text("status", { enum: BOOTH_STATUSES }).notNull().default("pending"),
    rejectReason: text("reject_reason"),
    approvedBy: text("approved_by"),
    approvedAt: integer("approved_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(), // token versi untuk Data Grid (B18)
    isLate: flag("is_late"), // 1 = mendaftar sesudah registration_close_at
    createdBy: text("created_by", { enum: ["self", "admin"] })
      .notNull()
      .default("self"),
    ownerInvitedAt: integer("owner_invited_at"),
    ownerLastLoginAt: integer("owner_last_login_at"),
    productTermsAcceptedAt: integer("product_terms_accepted_at"),
    whatsappE164: text("whatsapp_e164"),
    whatsappConsentAt: integer("whatsapp_consent_at"),
    whatsappConsentBy: text("whatsapp_consent_by", { enum: ["owner", "admin"] }),
  },
  (t) => [
    // "Akun per-event". NULL boleh banyak: SQLite menganggap tiap NULL berbeda.
    uniqueIndex("booths_event_email").on(t.eventId, t.email),
    index("booths_event_status").on(t.eventId, t.status),
    check("booths_name_not_blank", sql`length(trim(${t.name})) > 0`),
  ],
);

export const boothPhotos = sqliteTable(
  "booth_photos",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id),
    boothId: text("booth_id")
      .notNull()
      .references(() => booths.id),
    keyFull: text("key_full").notNull(),
    keyThumb: text("key_thumb").notNull(),
    position: integer("position").notNull(), // 0 = foto sampul
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("booth_photos_position").on(t.boothId, t.position)],
);

// ---------- kategori ulasan, produk ----------

export const reviewCategories = sqliteTable(
  "review_categories",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id),
    label: text("label").notNull(),
    position: integer("position").notNull(),
    active: flag("active", 1), // nonaktif (bukan hapus) agar data lama tetap terbaca
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("review_categories_event").on(t.eventId, t.position)],
);

export const products = sqliteTable(
  "products",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id),
    boothId: text("booth_id")
      .notNull()
      .references(() => booths.id),
    name: text("name").notNull(),
    description: text("description"),
    category: text("category"),
    priceIdr: integer("price_idr").notNull(), // rupiah bulat; 0 = Gratis
    comparePriceIdr: integer("compare_price_idr"),
    badge: text("badge", { enum: ["limited", "new"] }),
    isFeatured: flag("is_featured"),
    status: text("status", { enum: ["active", "hidden", "removed_by_admin"] })
      .notNull()
      .default("active"),
    keyFull: text("key_full"),
    keyThumb: text("key_thumb"),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("products_price_range", sql`${t.priceIdr} BETWEEN 0 AND 99999999`),
    check(
      "products_compare_price",
      sql`${t.comparePriceIdr} IS NULL OR ${t.comparePriceIdr} > ${t.priceIdr}`,
    ),
    uniqueIndex("one_featured")
      .on(t.boothId)
      .where(sql`${t.isFeatured} = 1 AND ${t.status} = 'active'`),
    index("products_booth").on(t.boothId, t.position),
  ],
);

// ---------- pengunjung dan review ----------

export const visitors = sqliteTable(
  "visitors",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id),
    provider: text("provider", { enum: ["google", "email", "ticket"] }).notNull(),
    identityHash: text("identity_hash").notNull(), // HMAC(email/sub/kode); email asli tidak disimpan
    displayName: text("display_name"),
    blocked: flag("blocked"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("visitors_identity").on(t.eventId, t.identityHash)],
);

export const reviews = sqliteTable(
  "reviews",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id),
    boothId: text("booth_id")
      .notNull()
      .references(() => booths.id),
    visitorId: text("visitor_id")
      .notNull()
      .references(() => visitors.id),
    stars: integer("stars").notNull(),
    comment: text("comment"),
    categoryIdsJson: text("category_ids_json"),
    status: text("status", { enum: REVIEW_STATUSES }).notNull().default("visible"),
    commentStatus: text("comment_status", { enum: COMMENT_STATUSES }).notNull().default("visible"),
    commentMasked: text("comment_masked"),
    filterHitsJson: text("filter_hits_json"),
    filterVersion: integer("filter_version"),
    commentLocked: flag("comment_locked"),
    pinned: flag("pinned"),
    riskScore: integer("risk_score"),
    flagsJson: text("flags_json"),
    ipHash: text("ip_hash"),
    uaHash: text("ua_hash"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    // Jejak perubahan admin (data, bukan log): nilai asli tidak pernah ditimpa.
    moderatedBy: text("moderated_by"),
    moderatedAt: integer("moderated_at"),
    moderationReason: text("moderation_reason"),
    originalStars: integer("original_stars"),
    originalComment: text("original_comment"),
  },
  (t) => [
    check("reviews_stars_range", sql`${t.stars} BETWEEN 1 AND 5`),
    uniqueIndex("reviews_booth_visitor").on(t.boothId, t.visitorId), // 1 review per orang per booth
    index("reviews_event_created").on(t.eventId, t.createdAt),
    index("reviews_event_status").on(t.eventId, t.status),
    index("reviews_event_stars").on(t.eventId, t.stars),
    index("reviews_booth_status").on(t.boothId, t.status),
  ],
);

// ---------- moderasi ----------

export const moderationTerms = sqliteTable(
  "moderation_terms",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id),
    term: text("term").notNull(), // sudah dinormalisasi
    lang: text("lang", { enum: ["id", "en", "regional"] }).notNull(),
    severity: text("severity", { enum: ["severe", "mild"] }).notNull(),
    kind: text("kind", { enum: ["block", "allow"] })
      .notNull()
      .default("block"),
    match: text("match", { enum: ["word", "contains"] })
      .notNull()
      .default("word"),
    enabled: flag("enabled", 1),
    source: text("source"),
    createdBy: text("created_by"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("moderation_terms_unique").on(t.eventId, t.term, t.kind)],
);

export const reviewReports = sqliteTable(
  "review_reports",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id),
    reviewId: text("review_id")
      .notNull()
      .references(() => reviews.id),
    reporterRole: text("reporter_role", { enum: ["booth", "visitor"] }).notNull(),
    reporterBoothId: text("reporter_booth_id"),
    reporterVisitorId: text("reporter_visitor_id"),
    reason: text("reason", {
      enum: ["profanity", "hate", "personal_data", "spam", "other"],
    }).notNull(),
    note: text("note"),
    status: text("status", { enum: ["open", "upheld", "dismissed"] })
      .notNull()
      .default("open"),
    decidedBy: text("decided_by"),
    decidedAt: integer("decided_at"),
    decisionReason: text("decision_reason"),
    createdAt: createdAt(),
  },
  (t) => [
    // Satu laporan per pelapor per komentar. Dua indeks parsial (bukan satu indeks coalesce:
    // drizzle-kit memecah ekspresi pada koma dan menghasilkan SQL rusak).
    uniqueIndex("review_reports_booth_unique")
      .on(t.reviewId, t.reporterBoothId)
      .where(sql`${t.reporterRole} = 'booth'`),
    uniqueIndex("review_reports_visitor_unique")
      .on(t.reviewId, t.reporterVisitorId)
      .where(sql`${t.reporterRole} = 'visitor'`),
    check(
      "review_reports_reporter",
      sql`(${t.reporterRole} = 'booth' AND ${t.reporterBoothId} IS NOT NULL) OR (${t.reporterRole} = 'visitor' AND ${t.reporterVisitorId} IS NOT NULL)`,
    ),
  ],
);

// ---------- agregat ----------

export const boothStats = sqliteTable("booth_stats", {
  boothId: text("booth_id")
    .primaryKey()
    .references(() => booths.id),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id),
  reviewCount: flag("review_count"),
  starSum: flag("star_sum"),
  s1: flag("s1"),
  s2: flag("s2"),
  s3: flag("s3"),
  s4: flag("s4"),
  s5: flag("s5"),
  categoryCountsJson: text("category_counts_json").notNull().default("{}"),
  lastReviewAt: integer("last_review_at"), // pemutus seri peringkat (A7)
  productCount: flag("product_count"),
  priceFrom: integer("price_from"), // harga terendah > 0 dari produk aktif; NULL bila semua gratis
  featuredProductId: text("featured_product_id"),
  updatedAt: updatedAt(),
});

// ---------- autentikasi dan operasional ----------

export const authOtps = sqliteTable(
  "auth_otps",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id),
    purpose: text("purpose", { enum: ["booth_login", "booth_register", "visitor"] }).notNull(),
    emailHash: text("email_hash").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: integer("expires_at").notNull(),
    attempts: flag("attempts"),
    createdAt: createdAt(),
  },
  (t) => [index("auth_otps_lookup").on(t.eventId, t.purpose, t.emailHash)],
);

export const ticketCodes = sqliteTable(
  "ticket_codes",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => events.id),
    codeHash: text("code_hash").notNull(),
    visitorId: text("visitor_id"),
    usedAt: integer("used_at"),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.codeHash] })],
);

export const invitedEmails = sqliteTable(
  "invited_emails",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => events.id),
    emailHash: text("email_hash").notNull(),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.emailHash] })],
);

// Data operasional sementara (TTL 24 jam), BUKAN log (B21). Log aktivitas tidak memakai D1 (B13).
export const idempotencyKeys = sqliteTable(
  "idempotency_keys",
  {
    actor: text("actor").notNull(),
    key: text("key").notNull(),
    route: text("route").notNull(),
    bodyHash: text("body_hash").notNull(),
    status: text("status", { enum: ["processing", "done"] }).notNull(),
    responseStatus: integer("response_status"),
    responseBody: text("response_body"),
    createdAt: createdAt(),
    updatedAt: updatedAt(), // dipakai mengambil alih "processing" yang menggantung > 60 detik
  },
  (t) => [primaryKey({ columns: [t.actor, t.key] }), index("idempotency_created").on(t.createdAt)],
);

export type EventRow = typeof events.$inferSelect;
export type BoothRow = typeof booths.$inferSelect;
export type ReviewRow = typeof reviews.$inferSelect;
