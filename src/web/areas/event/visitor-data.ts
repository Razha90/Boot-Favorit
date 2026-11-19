// Data sesi pengunjung dan review (TanStack Query, hanya di area event). Aksi tulis dipanggil dari `ActionButton`
// dengan `ctx.key` sebagai Idempotency-Key (B21); setelah sukses, cache terkait dibuat usang.

import type {
  MyReview,
  OtpRequestResult,
  PublicReviews,
  ReviewSubmitResult,
  VisitorMe,
} from "@shared/api-types";
import type { REPORT_REASONS } from "@shared/schemas";
import { type QueryClient, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { eventKeys } from "../../features/event-data";
import { api } from "../../lib/api";

export const visitorKeys = {
  me: ["visitor", "me"] as const,
  mine: ["visitor", "mine"] as const,
  reviews: (boothId: string) => ["public", "reviews", boothId] as const,
};

export const useVisitorQuery = () =>
  useQuery({
    queryKey: visitorKeys.me,
    queryFn: () => api<VisitorMe>("GET", "/api/visitor/me"),
    staleTime: 60_000,
  });

export const useMyReviewsQuery = (enabled: boolean) =>
  useQuery({
    queryKey: visitorKeys.mine,
    queryFn: () => api<{ reviews: MyReview[] }>("GET", "/api/me/reviews"),
    enabled,
  });

export const useReviewsQuery = (boothId: string) =>
  useInfiniteQuery({
    queryKey: visitorKeys.reviews(boothId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<PublicReviews>(
        "GET",
        `/api/booths/${boothId}/reviews${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ""}`,
      ),
    getNextPageParam: (last) => last.next ?? undefined,
    staleTime: 15_000,
  });

interface Ctx {
  key: string;
}

export const visitorApi = {
  google: (credential: string, turnstileToken: string | undefined) =>
    api<{ visitor: NonNullable<VisitorMe["visitor"]> }>("POST", "/api/visitor/google", {
      body: { credential, turnstileToken },
    }),
  requestOtp: (email: string, turnstileToken: string | undefined) =>
    api<OtpRequestResult>("POST", "/api/visitor/otp/request", { body: { email, turnstileToken } }),
  verifyOtp: (email: string, code: string, displayName: string) =>
    api<{ visitor: NonNullable<VisitorMe["visitor"]> }>("POST", "/api/visitor/otp/verify", {
      body: { email, code, displayName: displayName || null },
    }),
  ticket: (code: string, displayName: string) =>
    api<{ visitor: NonNullable<VisitorMe["visitor"]> }>("POST", "/api/visitor/ticket", {
      body: { code, displayName: displayName || null },
    }),
  anonymous: (displayName: string, turnstileToken: string | undefined) =>
    api<{ visitor: NonNullable<VisitorMe["visitor"]> }>("POST", "/api/visitor/anonymous", {
      body: { displayName: displayName || null, turnstileToken },
    }),
  logout: () => api<{ ok: true }>("POST", "/api/visitor/logout"),
  submitReview: (
    boothId: string,
    body: { stars: number; comment: string | null; categoryIds: string[] },
    turnstileToken: string | undefined,
    ctx: Ctx,
  ) =>
    api<ReviewSubmitResult>("POST", `/api/booths/${boothId}/review`, {
      body: { ...body, turnstileToken },
      key: ctx.key,
    }),
  report: (
    reviewId: string,
    body: { reason: (typeof REPORT_REASONS)[number]; note: string | null },
    turnstileToken: string | undefined,
    ctx: Ctx,
  ) =>
    api<{ ok: true; alreadyReported: boolean }>("POST", `/api/reviews/${reviewId}/report`, {
      body: { ...body, turnstileToken },
      key: ctx.key,
    }),
};

/** Setelah masuk/keluar atau mengirim review: data yang bergantung pada sesi atau statistik dibuat usang. */
export function invalidateAfterSession(qc: QueryClient): Promise<unknown> {
  return Promise.all([
    qc.invalidateQueries({ queryKey: visitorKeys.me }),
    qc.invalidateQueries({ queryKey: visitorKeys.mine }),
  ]);
}

export function invalidateAfterReview(qc: QueryClient, boothId: string): Promise<unknown> {
  return Promise.all([
    invalidateAfterSession(qc),
    qc.invalidateQueries({ queryKey: eventKeys.booth(boothId) }),
    qc.invalidateQueries({ queryKey: visitorKeys.reviews(boothId) }),
    qc.invalidateQueries({ queryKey: ["public", "snapshot"] }),
  ]);
}
