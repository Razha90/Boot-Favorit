// Klien API hasil dan tampilan (explore.md B10). Semua aksi tulis menerima `{ key }` (Idempotency-Key, B21).
import type { AdminResultsView, DisplayMode } from "@shared/api-types";
import { api } from "../../lib/api";

type Key = { key: string };

export const resultsKeys = { view: (id: string) => ["admin", "results", id] as const };

export const resultsApi = {
  view: (id: string) => api<AdminResultsView>("GET", `/api/admin/e/${id}/results`),
  setRatingsMode: (id: string, mode: DisplayMode, { key }: Key) =>
    api<{ ok: true }>("PUT", `/api/admin/events/${id}/ratings-mode`, { body: { mode }, key }),
  setRankingMode: (id: string, mode: DisplayMode, { key }: Key) =>
    api<{ ok: true }>("PUT", `/api/admin/events/${id}/ranking-mode`, { body: { mode }, key }),
  publish: (id: string, { key }: Key) =>
    api<{ ok: true; booths: number }>("POST", `/api/admin/events/${id}/publish-results`, { key }),
  refresh: (id: string, { key }: Key) =>
    api<{ ok: true; booths: number }>("POST", `/api/admin/events/${id}/refresh-results`, { key }),
  reveal: (id: string, target: "screen" | "everyone", { key }: Key) =>
    api<{ ok: true }>("POST", `/api/admin/events/${id}/reveal`, { body: { target }, key }),
};
