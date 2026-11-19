// Klien API portal booth: satu tempat untuk semua rute /api/booth/* (explore.md B10). Tipe dari shared/api-types.
import type { BoothMe, BoothSession, OtpRequestResult, PublicReviews } from "@shared/api-types";
import type { BoothAuthPurpose, SelfRegisterInput } from "@shared/schemas";
import { api } from "../../lib/api";

type Key = { key: string };
const B = "/api/booth";

export interface ProfileInput {
  name?: string;
  boothNo?: string;
  tagline?: string;
  description?: string;
  about?: string;
  teamName?: string;
}

export const boothApi = {
  session: () => api<BoothSession>("GET", `${B}/me`),
  requestOtp: (email: string, purpose: BoothAuthPurpose, turnstileToken?: string) =>
    api<OtpRequestResult>("POST", `${B}/otp/request`, {
      body: { email, purpose, turnstileToken },
    }),
  verifyOtp: (email: string, purpose: BoothAuthPurpose, code: string) =>
    api<{ ok: true }>("POST", `${B}/otp/verify`, { body: { email, purpose, code } }),
  register: (body: SelfRegisterInput & { email: string }, { key }: Key) =>
    api<{ ok: true }>("POST", `${B}/register`, { body, key }),
  logout: () => api<{ ok: true }>("POST", `${B}/logout`),

  updateProfile: (body: ProfileInput, { key }: Key) =>
    api<BoothMe>("PUT", `${B}/me`, { body, key }),
  resubmit: ({ key }: Key) => api<{ ok: true }>("POST", `${B}/resubmit`, { key }),
  setWhatsapp: (body: { number: string | null; consent: boolean }, { key }: Key) =>
    api<{ ok: true }>("PUT", `${B}/whatsapp`, { body, key }),

  reviews: (cursor?: string | null) =>
    api<PublicReviews>(
      "GET",
      `${B}/reviews${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
    ),
  report: (reviewId: string, body: { reason: string; note?: string }, { key }: Key) =>
    api<{ ok: true; alreadyReported: boolean }>("POST", `${B}/reviews/${reviewId}/report`, {
      body,
      key,
    }),
};

export const boothKeys = {
  session: ["booth", "session"] as const,
  reviews: ["booth", "reviews"] as const,
};
