// Klien API admin: satu tempat untuk semua rute /api/admin/* (explore.md B10). Tipe respons dari shared/api-types.
import type {
  AdminBoothView,
  AdminEventView,
  CategoryView,
  ImportSummary,
  PublicEventMedia,
} from "@shared/api-types";
import type { ImportRow } from "@shared/schemas";
import { api } from "../../lib/api";
import type { ConvertedImage } from "../../lib/image/convert-to-webp";

const A = "/api/admin";
type Key = { key: string };

export interface BoothFilters {
  status?: string;
  owner?: string;
  completeness?: string;
  q?: string;
}

const qs = (f: BoothFilters) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
};

const multipart = (image: ConvertedImage) => {
  const f = new FormData();
  f.append("full", image.full, "full.webp");
  f.append("thumb", image.thumb, "thumb.webp");
  return f;
};

export const adminApi = {
  // ---- event ----
  events: () => api<{ events: AdminEventView[] }>("GET", `${A}/events`),
  event: (id: string) => api<{ event: AdminEventView }>("GET", `${A}/events/${id}`),
  createEvent: (body: unknown, { key }: Key) =>
    api<{ event: AdminEventView }>("POST", `${A}/events`, { body, key }),
  updateEvent: (id: string, body: unknown) =>
    api<{ event: AdminEventView }>("PUT", `${A}/events/${id}`, { body }),
  eventAction: (
    id: string,
    action: "activate" | "hide" | "unhide" | "close-registration",
    { key }: Key,
  ) => api<{ event: AdminEventView }>("POST", `${A}/events/${id}/${action}`, { key }),
  extendRegistration: (id: string, byMs: number, { key }: Key) =>
    api<{ event: AdminEventView }>("POST", `${A}/events/${id}/extend-registration`, {
      body: { byMs },
      key,
    }),
  categories: (id: string) =>
    api<{ categories: CategoryView[] }>("GET", `${A}/e/${id}/review-categories`),
  saveCategories: (
    id: string,
    categories: { id?: string; label: string; active: boolean }[],
    { key }: Key,
  ) =>
    api<{ categories: CategoryView[] }>("PUT", `${A}/e/${id}/review-categories`, {
      body: { categories },
      key,
    }),

  uploadEventMedia: (
    eventId: string,
    kind: "logo" | "og" | "hero",
    slot: number,
    image: ConvertedImage,
    { key }: Key,
  ) =>
    api<{ media: PublicEventMedia }>("POST", `${A}/e/${eventId}/media?kind=${kind}&slot=${slot}`, {
      form: multipart(image),
      key,
    }),
  removeEventMedia: (eventId: string, kind: "logo" | "og" | "hero", slot: number, { key }: Key) =>
    api<{ media: PublicEventMedia }>(
      "DELETE",
      `${A}/e/${eventId}/media?kind=${kind}&slot=${slot}`,
      { key },
    ),

  // ---- booth ----
  booths: (eventId: string, f: BoothFilters = {}) =>
    api<{ booths: AdminBoothView[] }>("GET", `${A}/e/${eventId}/booths${qs(f)}`),
  booth: (eventId: string, boothId: string) =>
    api<{ booth: AdminBoothView }>("GET", `${A}/e/${eventId}/booths/${boothId}`),
  createBooth: (eventId: string, body: unknown, { key }: Key) =>
    api<{ booth: AdminBoothView }>("POST", `${A}/e/${eventId}/booths`, { body, key }),
  importBooths: (
    eventId: string,
    rows: Partial<ImportRow>[],
    onDuplicateName: "skip" | "create",
    { key }: Key,
  ) =>
    api<ImportSummary>("POST", `${A}/e/${eventId}/booths/import`, {
      body: { rows, onDuplicateName },
      key,
    }),
  updateBooth: (eventId: string, boothId: string, body: unknown) =>
    api<{ booth: AdminBoothView }>("PATCH", `${A}/e/${eventId}/booths/${boothId}`, { body }),
  setOwner: (eventId: string, boothId: string, body: unknown, { key }: Key) =>
    api<{ booth: AdminBoothView }>("PUT", `${A}/e/${eventId}/booths/${boothId}/owner`, {
      body,
      key,
    }),
  invite: (eventId: string, boothId: string, { key }: Key) =>
    api<{ sent: boolean }>("POST", `${A}/e/${eventId}/booths/${boothId}/invite`, { key }),
  setWhatsapp: (eventId: string, boothId: string, body: unknown, { key }: Key) =>
    api<{ booth: AdminBoothView }>("PUT", `${A}/e/${eventId}/booths/${boothId}/whatsapp`, {
      body,
      key,
    }),
};

export const adminKeys = {
  events: ["admin", "events"] as const,
  event: (id: string) => ["admin", "event", id] as const,
  categories: (id: string) => ["admin", "categories", id] as const,
  booths: (eventId: string) => ["admin", "booths", eventId] as const,
  booth: (eventId: string, boothId: string) => ["admin", "booth", eventId, boothId] as const,
};
