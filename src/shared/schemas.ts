// Skema Zod: SATU sumber tipe dan validasi untuk form (client) dan API (server).
// Tipe diturunkan dengan z.infer; jangan menulis ulang tipe yang sama di tempat lain.

import { z } from "zod";
import { CONFIG } from "./config";

// ---------- Primitif ----------

/** Teks opsional: di-trim, string kosong atau tak ada menjadi null. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v === null || v === undefined || v === "" ? null : v));

const requiredText = (max: number) => z.string().trim().min(1).max(max);

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

/** Email opsional: kosong/tak ada = null (booth tanpa pemilik, A16). */
const optionalEmail = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v.toLowerCase() : null))
  .pipe(z.email().max(254).nullable());

const epochMs = z.int().nonnegative();

export const idempotencyKeySchema = z.uuid();

// ---------- Mode tampilan (kontrol admin) ----------

export const ratingsModeSchema = z.enum(["visible", "hidden", "on_results"]);
export const rankingModeSchema = z.enum(["visible", "hidden", "on_results"]);
export const reviewerAuthModeSchema = z.enum(["google_or_email", "ticket_code", "open_turnstile"]);

// ---------- Jadwal event (B17) ----------

const scheduleShape = {
  registrationOpenAt: epochMs.nullable(),
  registrationCloseAt: epochMs,
  eventStartAt: epochMs,
  eventEndAt: epochMs,
};

/** Aturan jadwal (B17), dipakai bersama oleh jadwal mandiri, pembuatan, dan pembaruan event. */
function checkSchedule(
  s: {
    registrationOpenAt: number | null;
    registrationCloseAt: number;
    eventStartAt: number;
    eventEndAt: number;
  },
  ctx: z.RefinementCtx,
): void {
  if (s.eventStartAt >= s.eventEndAt) {
    ctx.addIssue({ code: "custom", path: ["eventEndAt"], message: "event_end_before_start" });
  }
  if (s.registrationOpenAt !== null && s.registrationOpenAt >= s.registrationCloseAt) {
    ctx.addIssue({
      code: "custom",
      path: ["registrationCloseAt"],
      message: "registration_close_before_open",
    });
  }
  if (s.registrationCloseAt > s.eventEndAt) {
    ctx.addIssue({
      code: "custom",
      path: ["registrationCloseAt"],
      message: "registration_close_after_event_end",
    });
  }
}

export const scheduleSchema = z.object(scheduleShape).superRefine(checkSchedule);
export type ScheduleInput = z.infer<typeof scheduleSchema>;

// ---------- Event (admin) ----------

const isValidTimeZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("id-ID", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};
const timezoneSchema = z.string().refine(isValidTimeZone, { message: "invalid_timezone" });
const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: "invalid_slug" })
  .max(60);

export const createEventSchema = z
  .object({
    name: requiredText(120),
    slug: slugSchema.optional(),
    titleHighlight: optionalText(60),
    timezone: timezoneSchema.default("Asia/Jakarta"),
    ...scheduleShape,
    allowLateRegistration: z.boolean().optional(),
  })
  .superRefine(checkSchedule);
export type CreateEventInput = z.infer<typeof createEventSchema>;

/** Pembaruan sebagian. Jadwal digabung dengan nilai lama lalu divalidasi ulang di layanan. */
export const updateEventSchema = z.object({
  name: requiredText(120).optional(),
  titleHighlight: optionalText(60).optional(),
  timezone: timezoneSchema.optional(),
  visibility: z.enum(["draft", "published"]).optional(),
  registrationOpenAt: epochMs.nullable().optional(),
  registrationCloseAt: epochMs.optional(),
  eventStartAt: epochMs.optional(),
  eventEndAt: epochMs.optional(),
  settings: z
    .object({
      reviewerAuthMode: reviewerAuthModeSchema,
      maxProducts: z.int().min(1).max(CONFIG.booth.maxProductsHardCap),
      allowLateRegistration: z.boolean(),
    })
    .partial()
    .optional(),
});
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

/** Daftar lengkap kategori ulasan berurutan. Yang tidak disebut dinonaktifkan (tidak pernah dihapus). */
export const reviewCategoriesSchema = z.object({
  categories: z
    .array(
      z.object({
        id: z.string().min(1).optional(),
        label: requiredText(30),
        active: z.boolean().default(true),
      }),
    )
    .max(20),
});
export type ReviewCategoriesInput = z.infer<typeof reviewCategoriesSchema>;

export const extendRegistrationSchema = z.object({
  /** Perpanjangan dalam milidetik, maksimal 30 hari */
  byMs: z
    .int()
    .positive()
    .max(30 * 24 * 3_600_000),
});

// ---------- Booth (A16) ----------

const boothFields = {
  name: requiredText(CONFIG.profile.nameMaxLength),
  boothNo: optionalText(CONFIG.profile.boothNoMaxLength),
  email: optionalEmail,
  tagline: optionalText(CONFIG.profile.taglineMaxLength),
  description: optionalText(CONFIG.profile.descriptionMaxLength),
};

/** Admin membuat booth: HANYA nama yang wajib. Booth langsung tayang. */
export const createBoothSchema = z.object(boothFields);
export type CreateBoothInput = z.infer<typeof createBoothSchema>;

/** Satu baris impor CSV: sama dengan membuat booth. */
export const importRowSchema = createBoothSchema;
export type ImportRow = z.infer<typeof importRowSchema>;

export const importBoothsSchema = z.object({
  rows: z.array(importRowSchema).min(1).max(CONFIG.booths.csvMaxRows),
  /** Nama persis sama dengan booth yang sudah ada: dilewati (bawaan, mencegah ganda) atau tetap dibuat. */
  onDuplicateName: z.enum(["skip", "create"]).default("skip"),
});
export type ImportBoothsInput = z.infer<typeof importBoothsSchema>;

export const boothStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "revision",
  "suspended",
]);

/** Admin menyunting booth (sebagian). `version` = updated_at yang dibaca (kontrol konkurensi, B18). */
export const updateBoothSchema = z.object({
  name: requiredText(CONFIG.profile.nameMaxLength).optional(),
  boothNo: optionalText(CONFIG.profile.boothNoMaxLength).optional(),
  tagline: optionalText(CONFIG.profile.taglineMaxLength).optional(),
  description: optionalText(CONFIG.profile.descriptionMaxLength).optional(),
  about: optionalText(CONFIG.booth.aboutMaxLength).optional(),
  teamName: optionalText(CONFIG.profile.teamNameMaxLength).optional(),
  status: boothStatusSchema.optional(),
  /** Alasan penolakan/revisi yang dilihat pemilik. Wajib untuk status rejected dan revision. */
  rejectReason: optionalText(500).optional(),
  /** Alasan perubahan oleh admin. Wajib bila booth punya pemilik aktif (A16). */
  reason: optionalText(500).optional(),
  version: z.int().nonnegative().optional(),
});
export type UpdateBoothInput = z.infer<typeof updateBoothSchema>;

export const listBoothsQuerySchema = z.object({
  status: boothStatusSchema.optional(),
  owner: z.enum(["none", "invited", "active"]).optional(),
  completeness: z.enum(["name_only", "partial", "full"]).optional(),
  q: z.string().trim().max(60).optional(),
});

/** Isi/ganti pemilik dengan email; null atau kosong melepas pemilik. */
export const boothOwnerSchema = z.object({
  email: optionalEmail,
  reason: optionalText(500).optional(),
});

export const boothWhatsappSchema = z.object({
  /** null atau kosong menghapus nomor */
  number: z.string().trim().max(30).nullish(),
  /** Admin mengonfirmasi pemilik sudah menyetujui nomornya dihubungi pengunjung (A16). */
  consentConfirmedByAdmin: z.boolean().default(false),
});

/** Pendaftaran mandiri: email lewat OTP, hanya nama yang wajib. */
export const selfRegisterSchema = z.object({
  name: boothFields.name,
  boothNo: boothFields.boothNo,
  tagline: boothFields.tagline,
  description: boothFields.description,
});
export type SelfRegisterInput = z.infer<typeof selfRegisterSchema>;

// ---------- Produk (A14, B24) ----------

const productFields = {
  name: requiredText(CONFIG.booth.productNameMax),
  description: optionalText(CONFIG.booth.productDescMax),
  category: optionalText(20),
  priceIdr: z.int().min(0).max(CONFIG.booth.maxPriceIdr),
  comparePriceIdr: z.int().min(0).max(CONFIG.booth.maxPriceIdr).nullish(),
  badge: z.enum(CONFIG.booth.productBadges).nullish(),
};
const comparePriceRule = {
  path: ["comparePriceIdr"],
  message: "compare_price_not_greater",
};

export const productInputSchema = z
  .object(productFields)
  .refine((p) => p.comparePriceIdr == null || p.comparePriceIdr > p.priceIdr, comparePriceRule);
export type ProductInput = z.infer<typeof productInputSchema>;

/** Admin menambah produk atas nama booth. Aturan A14 dicentang admin sebelum produk pertama tersimpan. */
export const createProductSchema = z
  .object({ ...productFields, termsConfirmed: z.boolean().default(false) })
  .refine((p) => p.comparePriceIdr == null || p.comparePriceIdr > p.priceIdr, comparePriceRule);
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const productStatusSchema = z.enum(["active", "hidden", "removed_by_admin"]);

/** Ubah sebagian; yang tidak disebut tidak berubah. */
export const productPatchSchema = z.object({
  name: productFields.name.optional(),
  description: productFields.description.optional(),
  category: productFields.category.optional(),
  priceIdr: productFields.priceIdr.optional(),
  comparePriceIdr: productFields.comparePriceIdr.optional(),
  badge: productFields.badge.optional(),
  status: productStatusSchema.optional(),
});
export type ProductPatchInput = z.infer<typeof productPatchSchema>;

export const orderedIdsSchema = z.object({ ids: z.array(z.string().min(1)).max(200) });

// ---------- Review (A5) ----------

export const reviewInputSchema = z.object({
  stars: z.int().min(1).max(5),
  comment: optionalText(CONFIG.review.maxCommentLength),
  categoryIds: z
    .array(z.string().min(1))
    .max(CONFIG.review.maxCategoriesPerReview)
    .refine((ids) => new Set(ids).size === ids.length, { message: "duplicate_category" })
    .default([]),
});
export type ReviewInput = z.infer<typeof reviewInputSchema>;

/**
 * Badan `POST /api/booths/:id/review`. STRICT: kolom lain (mis. `status`, `commentStatus`) ditolak, bukan diabaikan,
 * sehingga tidak ada jalur bagi klien (termasuk booth) untuk mengubah status moderasi (B25 pengujian 1).
 */
export const reviewRequestSchema = reviewInputSchema
  .extend({ turnstileToken: z.string().max(2048).optional() })
  .strict();
export type ReviewRequest = z.infer<typeof reviewRequestSchema>;

// ---------- Login reviewer (A6, B7) ----------

const turnstileToken = z.string().max(2048).optional();
const displayName = z
  .string()
  .trim()
  .max(30)
  .nullish()
  .transform((v) => (v ? v : null));

export const googleLoginSchema = z
  .object({ credential: z.string().min(20).max(4096), turnstileToken })
  .strict();
export const otpRequestSchema = z.object({ email: emailSchema, turnstileToken }).strict();
export const otpVerifySchema = z
  .object({ email: emailSchema, code: z.string().regex(/^\d{6}$/), displayName })
  .strict();
export const ticketLoginSchema = z
  .object({ code: z.string().trim().min(4).max(64), displayName })
  .strict();
export const anonymousLoginSchema = z.object({ turnstileToken, displayName }).strict();

// ---------- Laporan dan moderasi (A15, B25) ----------

export const REPORT_REASONS = ["profanity", "hate", "personal_data", "spam", "other"] as const;
export const reportReasonSchema = z.enum(REPORT_REASONS);
export const reportRequestSchema = z
  .object({ reason: reportReasonSchema, note: optionalText(200), turnstileToken })
  .strict();

export const COMMENT_STATUS_VALUES = ["visible", "masked", "held", "hidden"] as const;
const adminReason = z.string().trim().min(CONFIG.registration.adminReasonMinLength).max(500);

export const adminCommentStatusSchema = z
  .object({
    commentStatus: z.enum(COMMENT_STATUS_VALUES),
    /** Kunci komentar yang dipulihkan agar laporan berikutnya tidak memunculkannya lagi di antrean */
    lock: z.boolean().optional(),
    reason: adminReason,
  })
  .strict();

export const adminReviewPatchSchema = z
  .object({
    stars: z.int().min(1).max(5).optional(),
    comment: optionalText(CONFIG.review.maxCommentLength).optional(),
    status: z.enum(["visible", "held", "hidden"]).optional(),
    reason: adminReason,
  })
  .strict();

export const adminReasonOnlySchema = z.object({ reason: adminReason }).strict();

export const reportDecisionSchema = z
  .object({
    decision: z.enum(["upheld", "dismissed"]),
    action: z.enum(["none", "hide_comment", "hide_review", "restore"]).default("none"),
    lock: z.boolean().optional(),
    reason: adminReason,
  })
  .strict();

export const moderationTermSchema = z
  .object({
    term: z.string().trim().min(2).max(40),
    lang: z.enum(["id", "en", "regional"]).default("id"),
    severity: z.enum(["severe", "mild"]),
    kind: z.enum(["block", "allow"]).default("block"),
    match: z.enum(["word", "contains"]).default("word"),
    enabled: z.boolean().default(true),
  })
  .strict();
export const moderationTermsPutSchema = z
  .object({ terms: z.array(moderationTermSchema).max(2000), reason: adminReason })
  .strict();
export const moderationTestSchema = z
  .object({ text: z.string().max(CONFIG.review.maxCommentLength * 2) })
  .strict();

export const visitorBlockSchema = z.object({ blocked: z.boolean(), reason: adminReason }).strict();

// ---------- Pengaturan event ----------

export const eventSettingsSchema = z.object({
  reviewerAuthMode: reviewerAuthModeSchema.optional(),
  maxProducts: z.int().min(1).max(CONFIG.booth.maxProductsHardCap).optional(),
  allowLateRegistration: z.boolean().optional(),
});
export type EventSettings = z.infer<typeof eventSettingsSchema>;
