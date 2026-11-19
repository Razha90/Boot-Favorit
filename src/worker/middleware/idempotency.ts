// Lapis 2 perlindungan aksi ganda (explore.md B21): header Idempotency-Key.
// Urutan di app: auth → eventWriteGate → idempotency → handler.
//
//  - Kunci baru            → klaim (status "processing") → jalankan handler → simpan respons ("done").
//  - Kunci sama, "done"    → kembalikan respons tersimpan (Idempotent-Replay: true), handler TIDAK jalan lagi.
//  - Kunci sama, "processing" → 409 request_in_progress + Retry-After: 1.
//  - "processing" menggantung > 60 detik → dianggap gagal dan boleh diambil alih.
//  - Kunci sama dengan rute/isi berbeda → 422 idempotency_mismatch.
//  - Respons 5xx tidak disimpan (kunci dilepas agar "Coba lagi" bisa jalan).

import { CONFIG } from "@shared/config";
import { ApiError } from "@shared/errors";
import { idempotencyKeySchema } from "@shared/schemas";
import { and, eq, lt } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { routePath } from "hono/route";
import type { AppContext, AppEnv } from "../app-env";
import { idempotencyKeys } from "../db/schema";
import { type Db, getDb } from "../lib/db";
import { sha256Hex } from "../lib/hash";
import { logEvent } from "../lib/logger";

export const IDEMPOTENCY_HEADER = "Idempotency-Key";
export const PROCESSING_TIMEOUT_MS = 60_000;
export const MAX_STORED_BODY_BYTES = 16 * 1024;

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Browser membuat batas (boundary) multipart BARU di setiap pengiriman, padahal isinya sama. Tanpa
 * normalisasi, "Coba lagi" dengan kunci yang sama dianggap isi berbeda (422). Batas diganti konstanta
 * sebelum di-hash; dibaca sebagai latin1 agar aman untuk byte biner.
 */
export function normalizeBodyForHash(
  contentType: string | undefined,
  body: ArrayBuffer,
): ArrayBuffer {
  const boundary = /^multipart\/form-data;.*boundary="?([^";]+)"?/i.exec(contentType ?? "")?.[1];
  if (!boundary) return body;
  const latin1 = new TextDecoder("latin1").decode(body);
  const normalized = latin1.split(boundary).join("BOUNDARY");
  const out = new Uint8Array(normalized.length);
  for (let i = 0; i < normalized.length; i++) out[i] = normalized.charCodeAt(i) & 0xff;
  return out.buffer;
}

export interface IdempotencyOptions {
  /** true = tanpa header → 400 (buat event, tambah booth, unggah gambar, simpan massal, ...) */
  required?: boolean;
  /** Pelaku yang memiliki kunci. Bawaan: alamat klien (sebelum ada sesi). */
  actor?: (c: AppContext) => string;
}

const defaultActor = (c: AppContext) => `anon:${c.req.header("cf-connecting-ip") ?? "unknown"}`;

export function idempotency(opts: IdempotencyOptions = {}) {
  return createMiddleware<AppEnv>(async (c, next) => {
    if (SAFE_METHODS.has(c.req.method)) return next();

    const key = c.req.header(IDEMPOTENCY_HEADER);
    if (!key) {
      if (opts.required) throw new ApiError("idempotency_key_required");
      return next();
    }
    if (!idempotencyKeySchema.safeParse(key).success) {
      throw new ApiError("validation_error", "Idempotency-Key harus berupa UUID");
    }

    const db = getDb(c.env);
    const now = c.get("now");
    const actor = (opts.actor ?? defaultActor)(c);
    const route = `${c.req.method} ${routePath(c, -1)}`;
    // Hash BYTE badan dari salinan permintaan: tidak mengonsumsi badan asli, sehingga unggahan biner
    // (multipart) tetap bisa dibaca handler dan tidak rusak oleh dekode teks.
    const bodyHash = await sha256Hex(
      normalizeBodyForHash(c.req.header("content-type"), await c.req.raw.clone().arrayBuffer()),
    );

    const claimed = await db
      .insert(idempotencyKeys)
      .values({
        actor,
        key,
        route,
        bodyHash,
        status: "processing",
        createdAt: now(),
        updatedAt: now(),
      })
      .onConflictDoNothing()
      .returning({ key: idempotencyKeys.key });

    if (claimed.length === 0) {
      const replay = await resolveExisting(c, db, { actor, key, route, bodyHash }, now());
      if (replay) return replay;
    }

    await next();

    const res = c.res;
    const release = () =>
      db
        .delete(idempotencyKeys)
        .where(and(eq(idempotencyKeys.actor, actor), eq(idempotencyKeys.key, key)));

    if (res.status >= 500) {
      await release();
      return;
    }
    const text = await res.clone().text();
    if (new TextEncoder().encode(text).length > MAX_STORED_BODY_BYTES) {
      await release(); // terlalu besar untuk disimpan: tidak idempoten, tetapi tidak merusak apa pun
      return;
    }
    await db
      .update(idempotencyKeys)
      .set({ status: "done", responseStatus: res.status, responseBody: text, updatedAt: now() })
      .where(and(eq(idempotencyKeys.actor, actor), eq(idempotencyKeys.key, key)));
  });
}

async function resolveExisting(
  c: AppContext,
  db: Db,
  q: { actor: string; key: string; route: string; bodyHash: string },
  now: number,
): Promise<Response | undefined> {
  const existing = await db
    .select()
    .from(idempotencyKeys)
    .where(and(eq(idempotencyKeys.actor, q.actor), eq(idempotencyKeys.key, q.key)))
    .get();

  const eventId = c.get("event")?.id ?? "-";
  const inProgress = () => {
    logEvent(c, {
      eventId,
      category: "system",
      action: "system.request_in_progress",
      level: "warn",
    });
    c.header("Retry-After", "1");
    return new ApiError("request_in_progress");
  };

  // Baris hilang di antara dua query (dilepas pemiliknya): minta klien mengulang sebentar lagi.
  if (!existing) throw inProgress();

  if (existing.route !== q.route || existing.bodyHash !== q.bodyHash) {
    throw new ApiError("idempotency_mismatch");
  }

  if (existing.status === "done") {
    logEvent(c, { eventId, category: "system", action: "system.idempotent_replay" });
    return new Response(existing.responseBody, {
      status: existing.responseStatus ?? 200,
      headers: {
        "content-type": "application/json; charset=UTF-8",
        "Idempotent-Replay": "true",
      },
    });
  }

  if (now - existing.updatedAt <= PROCESSING_TIMEOUT_MS) throw inProgress();

  // Menggantung > 60 detik: ambil alih, tetapi hanya SATU pemohon yang menang.
  const taken = await db
    .update(idempotencyKeys)
    .set({ updatedAt: now })
    .where(
      and(
        eq(idempotencyKeys.actor, q.actor),
        eq(idempotencyKeys.key, q.key),
        eq(idempotencyKeys.status, "processing"),
        eq(idempotencyKeys.updatedAt, existing.updatedAt),
      ),
    )
    .returning({ key: idempotencyKeys.key });
  if (taken.length === 0) throw inProgress();
  return undefined;
}

/** Dipanggil Cron Trigger: hapus kunci lebih tua dari TTL (24 jam). Mengembalikan jumlah yang dihapus. */
export async function purgeExpiredIdempotencyKeys(db: Db, now: number): Promise<number> {
  const cutoff = now - CONFIG.net.idempotencyTtlHours * 3_600_000;
  const removed = await db
    .delete(idempotencyKeys)
    .where(lt(idempotencyKeys.createdAt, cutoff))
    .returning({ key: idempotencyKeys.key });
  return removed.length;
}
