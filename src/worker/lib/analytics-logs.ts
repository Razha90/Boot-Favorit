// Pembaca log aktivitas dari Analytics Engine lewat SQL API (explore.md B13). Kebalikan dari `logEvent` (penulis).
// Aturan: SQL dibangun HANYA dari nilai yang sudah divalidasi whitelist/pola ketat; tidak ada masukan mentah yang
// disambung ke string SQL. Token API read-only dan account id adalah rahasia Worker (tidak pernah ke klien).

import type { LogEntry } from "@shared/api-types";
import { CONFIG } from "@shared/config";
import { ApiError } from "@shared/errors";
import type { LOG_ACTIONS, LOG_CATEGORIES, LOG_LEVELS } from "@shared/log-events";

export const LOG_DATASET = "booth_favorit_logs";

export const LOG_RANGES = {
  "1h": "INTERVAL '1' HOUR",
  "1d": "INTERVAL '1' DAY",
  "7d": "INTERVAL '7' DAY",
  "30d": "INTERVAL '30' DAY",
} as const;
export type LogRange = keyof typeof LOG_RANGES;

export interface LogQuery {
  eventId: string;
  range: LogRange;
  category?: (typeof LOG_CATEGORIES)[number];
  level?: (typeof LOG_LEVELS)[number];
  action?: (typeof LOG_ACTIONS)[number];
  /** id pelaku/target: hanya karakter aman (id dan hash singkat, B13) */
  actor?: string;
  target?: string;
}

const SAFE_ID = /^[A-Za-z0-9_.:-]{1,64}$/;

export const isSafeLogId = (v: string): boolean => SAFE_ID.test(v);

/** SQL log. Setiap nilai sudah divalidasi pemanggil; di sini diperiksa SEKALI LAGI (pertahanan berlapis). */
export function buildLogSql(q: LogQuery): string {
  const lit = (v: string) => {
    if (!SAFE_ID.test(v)) throw new ApiError("validation_error", "unsafe_log_value");
    return `'${v}'`; // pola di atas tidak memuat tanda kutip, garis miring, atau spasi
  };
  const where = [`index1 = ${lit(q.eventId)}`, `timestamp > NOW() - ${LOG_RANGES[q.range]}`];
  if (q.category) where.push(`blob1 = ${lit(q.category)}`);
  if (q.action) where.push(`blob2 = ${lit(q.action)}`);
  if (q.level) where.push(`blob3 = ${lit(q.level)}`);
  if (q.actor) where.push(`blob5 = ${lit(q.actor)}`);
  if (q.target) where.push(`blob7 = ${lit(q.target)}`);
  return `SELECT timestamp, blob1 AS category, blob2 AS action, blob3 AS level, blob4 AS actor_type, blob5 AS actor_id, blob6 AS target_type, blob7 AS target_id, blob8 AS msg, blob9 AS meta, blob10 AS request_id FROM ${LOG_DATASET} WHERE ${where.join(" AND ")} ORDER BY timestamp DESC LIMIT ${CONFIG.logs.maxRows} FORMAT JSON`;
}

type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");

function parseMeta(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== "string" || raw === "" || raw === "{}") return null;
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null; // meta dipotong di 2000 karakter: bisa tidak utuh
  }
}

export const toLogEntry = (r: Row): LogEntry => ({
  // AE mengembalikan "YYYY-MM-DD HH:MM:SS" (UTC, tanpa zona)
  at: Date.parse(`${str(r.timestamp).replace(" ", "T")}Z`) || 0,
  category: str(r.category),
  action: str(r.action),
  level: str(r.level),
  actorType: str(r.actor_type),
  actorId: str(r.actor_id),
  targetType: str(r.target_type),
  targetId: str(r.target_id),
  msg: str(r.msg),
  meta: parseMeta(r.meta),
  requestId: str(r.request_id),
});

export type LogFetcher = typeof fetch;

export function logsConfigured(env: Pick<Env, "CF_ACCOUNT_ID" | "CF_API_TOKEN">): boolean {
  return Boolean(env.CF_ACCOUNT_ID && env.CF_API_TOKEN);
}

export async function queryLogs(
  env: Pick<Env, "CF_ACCOUNT_ID" | "CF_API_TOKEN">,
  q: LogQuery,
  fetcher: LogFetcher = fetch,
): Promise<LogEntry[]> {
  if (!env.CF_ACCOUNT_ID || !env.CF_API_TOKEN)
    throw new ApiError("internal_error", "logs_not_configured");
  const res = await fetcher(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CF_ACCOUNT_ID)}/analytics_engine/sql`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, "Content-Type": "text/plain" },
      body: buildLogSql(q),
    },
  );
  // Isi galat dari Cloudflare tidak diteruskan (bisa memuat potongan SQL atau id akun).
  if (!res.ok) throw new ApiError("internal_error", `logs_provider_${res.status}`);
  const json = (await res.json()) as { data?: Row[] };
  return (json.data ?? []).map(toLogEntry);
}
