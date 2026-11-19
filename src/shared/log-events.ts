// SATU sumber daftar kategori/aksi/level log (explore.md B13), dipakai logger DAN dropdown filter UI.
// Jangan menulis data pribadi (email, IP mentah) ke log: cukup id dan hash.

export const LOG_CATEGORIES = ["auth", "booth", "review", "spam", "admin", "system"] as const;
export const LOG_LEVELS = ["info", "warn", "error"] as const;

export const LOG_ACTIONS = [
  // auth
  "auth.otp_requested",
  "auth.otp_failed",
  "auth.login",
  "auth.admin_denied",
  // booth
  "booth.registered",
  "booth.registered_late",
  "booth.resubmitted",
  "booth.profile_updated",
  "booth.report_sent",
  "booth.owner_invalidated",
  "booth.approved",
  "booth.rejected",
  "booth.suspended",
  "booth.media_uploaded",
  "booth.product_created",
  "booth.product_updated",
  "booth.product_featured",
  "booth.product_deleted",
  "booth.whatsapp_set",
  "booth.whatsapp_removed",
  "booth.wa_click",
  "admin.event_media_changed",
  // review dan moderasi
  "review.created",
  "review.updated",
  "review.held",
  "review.hidden",
  "review.restored",
  "review.comment_held",
  "review.comment_masked",
  "review.reported",
  "moderation.report_decided",
  "moderation.terms_changed",
  // spam
  "spam.turnstile_failed",
  "spam.rate_limited",
  "spam.burst_detected",
  // admin
  "admin.event_created",
  "admin.event_activated",
  "admin.event_hidden",
  "admin.categories_changed",
  "admin.schedule_changed",
  "admin.event_settings_changed",
  "admin.event_archived",
  "admin.results_published",
  "admin.results_refreshed",
  "admin.ranking_mode_changed",
  "admin.ratings_mode_changed",
  "admin.reveal_played",
  "admin.visitor_blocked",
  "admin.visitor_edited",
  "admin.review_edited",
  "admin.review_deleted",
  "admin.booth_created",
  "admin.booths_imported",
  "admin.booth_edited",
  "admin.booth_owner_set",
  "admin.booth_owner_removed",
  "admin.booth_invite_sent",
  "admin.product_removed",
  "admin.product_edited",
  "admin.data_exported",
  // sistem
  "email.skipped",
  "email.sent",
  "email.failed",
  "event.write_blocked_ended",
  "system.idempotent_replay",
  "system.request_in_progress",
  "system.error",
  "live.viewer_limit_reached",
] as const;

export type LogCategory = (typeof LOG_CATEGORIES)[number];
export type LogLevel = (typeof LOG_LEVELS)[number];
export type LogAction = (typeof LOG_ACTIONS)[number];

export type ActorType = "admin" | "booth" | "visitor" | "system";

export interface LogEvent {
  eventId: string;
  category: LogCategory;
  action: LogAction;
  level?: LogLevel;
  actor?: { type: ActorType; id: string };
  target?: { type: string; id: string };
  /** Pesan singkat (dipotong 200 karakter saat ditulis) */
  msg?: string;
  /** Data kecil tambahan, mis. { risk, flags } atau nilai sebelum/sesudah (dipotong 2000 karakter) */
  meta?: Record<string, unknown>;
  num?: { latencyMs?: number; risk?: number };
}
