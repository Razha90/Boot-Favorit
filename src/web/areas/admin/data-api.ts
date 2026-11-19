// Klien API Data Grid dan Log admin (explore.md B10, B13, B18).
import type { EventHealth, LogsResponse } from "@shared/api-types";
import type {
  BulkEditInput,
  BulkEditResponse,
  GridEntity,
  GridFilter,
  GridPage,
} from "@shared/data-grid";
import { api } from "../../lib/api";

const A = "/api/admin/e";
type Key = { key: string };

export interface GridParams {
  cursor?: string;
  limit?: number;
  sort?: string;
  dir?: "asc" | "desc";
  q?: string;
  filters?: GridFilter[];
}

export interface LogParams {
  range?: "1h" | "1d" | "7d" | "30d";
  category?: string;
  level?: string;
  action?: string;
  actor?: string;
  target?: string;
}

export function buildGridSearchParams(p: GridParams): string {
  const s = new URLSearchParams();
  if (p.cursor) s.set("cursor", p.cursor);
  if (p.limit !== undefined) s.set("limit", String(p.limit));
  if (p.sort) s.set("sort", p.sort);
  if (p.dir) s.set("dir", p.dir);
  if (p.q) s.set("q", p.q);
  if (p.filters && p.filters.length > 0) s.set("filters", JSON.stringify(p.filters));
  const out = s.toString();
  return out ? `?${out}` : "";
}

function buildLogSearchParams(p: LogParams): string {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) {
    if (v) s.set(k, v);
  }
  const out = s.toString();
  return out ? `?${out}` : "";
}

export const dataKeys = {
  grid: (eventId: string, entity: GridEntity, params: Omit<GridParams, "cursor">) =>
    ["admin", "data", eventId, entity, params] as const,
  allGrid: (eventId: string) => ["admin", "data", eventId] as const,
  ranking: (eventId: string) => ["admin", "data", eventId, "ranking", "impact"] as const,
  logs: (eventId: string, params: LogParams) => ["admin", "logs", eventId, params] as const,
  health: (eventId: string) => ["admin", "health", eventId] as const,
};

export const dataApi = {
  query: (eventId: string, entity: GridEntity, params: GridParams) =>
    api<GridPage>("GET", `${A}/${eventId}/data/${entity}${buildGridSearchParams(params)}`),

  bulkEdit: (eventId: string, body: BulkEditInput, { key }: Key) =>
    api<BulkEditResponse>("PATCH", `${A}/${eventId}/data/bulk`, { body, key }),

  exportUrl: (eventId: string, entity: GridEntity, params: Omit<GridParams, "cursor" | "limit">) =>
    `${A}/${eventId}/data/${entity}/export${buildGridSearchParams(params)}`,

  logs: (eventId: string, params: LogParams) =>
    api<LogsResponse>("GET", `${A}/${eventId}/logs${buildLogSearchParams(params)}`),

  health: (eventId: string) => api<EventHealth>("GET", `${A}/${eventId}/health`),
};
