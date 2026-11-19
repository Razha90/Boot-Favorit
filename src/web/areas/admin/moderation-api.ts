// Klien API moderasi admin (explore.md B10). Semua aksi tulis menerima `{ key }` (Idempotency-Key, B21).
import type {
  AdminModerationQueue,
  AdminReview,
  AdminTerm,
  ModerationTestResult,
} from "@shared/api-types";
import { api } from "../../lib/api";

const A = "/api/admin/e";
type Key = { key: string };

export const moderationKeys = {
  queue: (id: string) => ["admin", "moderation", "queue", id] as const,
  reviews: (id: string, filters: string) =>
    ["admin", "moderation", "reviews", id, filters] as const,
  terms: (id: string) => ["admin", "moderation", "terms", id] as const,
  /** Awalan bersama semua kunci moderasi: satu invalidasi menyegarkan antrean, daftar ulasan, dan daftar kata. */
  all: () => ["admin", "moderation"] as const,
};

export interface ReviewFilters {
  status?: string;
  stars?: string;
  boothId?: string;
}

const qs = (f: ReviewFilters) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const moderationApi = {
  queue: (id: string) => api<AdminModerationQueue>("GET", `${A}/${id}/moderation/queue`),
  reviews: (id: string, f: ReviewFilters) =>
    api<{ reviews: AdminReview[] }>("GET", `${A}/${id}/reviews${qs(f)}`),

  decide: (
    id: string,
    reportId: string,
    body: {
      decision: "upheld" | "dismissed";
      action: "none" | "hide_comment" | "hide_review" | "restore";
      lock?: boolean;
      reason: string;
    },
    { key }: Key,
  ) =>
    api<{ review: AdminReview }>("POST", `${A}/${id}/moderation/reports/${reportId}`, {
      body,
      key,
    }),

  setCommentStatus: (
    id: string,
    reviewId: string,
    body: {
      commentStatus: "visible" | "masked" | "held" | "hidden";
      lock?: boolean;
      reason: string;
    },
    { key }: Key,
  ) =>
    api<{ review: AdminReview }>("PATCH", `${A}/${id}/reviews/${reviewId}/comment`, { body, key }),

  patchReview: (
    id: string,
    reviewId: string,
    body: { status?: "visible" | "held" | "hidden"; reason: string },
    { key }: Key,
  ) => api<{ review: AdminReview }>("PATCH", `${A}/${id}/reviews/${reviewId}`, { body, key }),

  restore: (id: string, reviewId: string, reason: string, { key }: Key) =>
    api<{ review: AdminReview }>("POST", `${A}/${id}/reviews/${reviewId}/restore`, {
      body: { reason },
      key,
    }),

  remove: (id: string, reviewId: string, reason: string, { key }: Key) =>
    api<{ ok: true }>(
      "DELETE",
      `${A}/${id}/reviews/${reviewId}?reason=${encodeURIComponent(reason)}`,
      { key },
    ),

  terms: (id: string) => api<{ terms: AdminTerm[] }>("GET", `${A}/${id}/moderation/terms`),
  saveTerms: (
    id: string,
    terms: Pick<AdminTerm, "term" | "severity" | "kind" | "match" | "enabled" | "lang">[],
    reason: string,
    { key }: Key,
  ) =>
    api<{ terms: AdminTerm[] }>("PUT", `${A}/${id}/moderation/terms`, {
      body: { terms, reason },
      key,
    }),
  test: (id: string, text: string) =>
    api<ModerationTestResult>("POST", `${A}/${id}/moderation/test`, { body: { text } }),
};
