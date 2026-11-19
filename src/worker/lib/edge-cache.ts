// Cache API untuk data publik (explore.md B8 opsi A, B17): beban ke D1 ≈ (jumlah lokasi edge aktif) × 1 per TTL,
// TIDAK bergantung pada jumlah pengunjung. Kunci memuat versi (`active`/`stats`/`results`): perubahan admin berganti
// kunci sehingga langsung terlihat; review baru terlihat setelah TTL (≤ 5 dtk saat event berlangsung).
// ETag + 304 membuat balasan polling "tidak ada perubahan" sangat kecil. Tanpa `caches` (tes Node) langsung memproduksi.

import type { AppContext } from "../app-env";
import { sha256Hex } from "./hash";

interface CacheLike {
  match(req: Request): Promise<Response | undefined>;
  put(req: Request, res: Response): Promise<void>;
}

const cacheOf = (): CacheLike | null =>
  (globalThis as unknown as { caches?: { default?: CacheLike } }).caches?.default ?? null;

export interface EdgeCacheOptions {
  /** Kunci unik yang sudah memuat versi data */
  key: string;
  ttlSec: number;
}

const headersFor = (etag: string, ttlSec: number, hit: boolean) => ({
  "Content-Type": "application/json; charset=UTF-8",
  "Cache-Control": `public, s-maxage=${ttlSec}`,
  ETag: etag,
  "X-Cache": hit ? "HIT" : "MISS",
});

const notModified = (c: AppContext, etag: string): boolean => {
  const inm = c.req.header("if-none-match");
  return !!inm && inm.split(",").some((t) => t.trim() === etag);
};

export async function edgeJson(
  c: AppContext,
  o: EdgeCacheOptions,
  produce: () => Promise<unknown>,
): Promise<Response> {
  const cache = cacheOf();
  const req = new Request(`https://edge-cache.internal/${o.key}`);

  const hit = cache ? await cache.match(req) : undefined;
  if (hit) {
    const etag = hit.headers.get("ETag") ?? "";
    if (etag && notModified(c, etag)) {
      return new Response(null, { status: 304, headers: { ETag: etag, "X-Cache": "HIT" } });
    }
    return new Response(hit.body, {
      status: hit.status,
      headers: headersFor(etag, o.ttlSec, true),
    });
  }

  // Galat (mis. 404 booth) tidak pernah masuk cache: `produce` melempar sebelum sampai ke put().
  const body = JSON.stringify(await produce());
  const etag = `W/"${(await sha256Hex(body)).slice(0, 16)}"`;
  if (cache) {
    const put = cache.put(req, new Response(body, { headers: headersFor(etag, o.ttlSec, false) }));
    try {
      c.executionCtx.waitUntil(put);
    } catch {
      await put; // tanpa ExecutionContext (tes): tunggu langsung
    }
  }
  if (notModified(c, etag)) {
    return new Response(null, { status: 304, headers: { ETag: etag, "X-Cache": "MISS" } });
  }
  return new Response(body, { headers: headersFor(etag, o.ttlSec, false) });
}
