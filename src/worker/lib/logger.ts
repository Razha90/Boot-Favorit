// SATU-SATUNYA pintu log (explore.md B13). Tidak ada kode lain yang boleh memanggil console.log
// atau writeDataPoint langsung, supaya format selalu seragam. Jangan menulis data pribadi.

import type { LogEvent } from "@shared/log-events";
import type { AppContext } from "../app-env";

const MSG_MAX = 200;
const META_MAX = 2000;

export function logEvent(c: AppContext, e: LogEvent): void {
  const level = e.level ?? "info";
  const requestId = c.get("requestId") ?? "";

  // → Workers Logs (debug teknis di dashboard Cloudflare)
  console.log(JSON.stringify({ ...e, level, requestId }));

  // → Analytics Engine (log aktivitas yang tampil di admin). Pemetaan kolom tetap, lihat B13.
  c.env.LOG?.writeDataPoint({
    indexes: [e.eventId],
    blobs: [
      e.category,
      e.action,
      level,
      e.actor?.type ?? "",
      e.actor?.id ?? "",
      e.target?.type ?? "",
      e.target?.id ?? "",
      (e.msg ?? "").slice(0, MSG_MAX),
      JSON.stringify(e.meta ?? {}).slice(0, META_MAX),
      requestId,
    ],
    doubles: [e.num?.latencyMs ?? 0, e.num?.risk ?? 0],
  });
}
