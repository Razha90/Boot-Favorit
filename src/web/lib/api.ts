// Klien API tipis. Semua galat server menjadi ApiError(kode) dari shared/errors; galat jaringan menjadi NetworkError.
import { CONFIG } from "@shared/config";
import { ApiError, type ApiErrorBody, isErrorCode } from "@shared/errors";

export type NetworkReason = "offline" | "timeout" | "failed";

/** Permintaan tidak sampai atau balasan tidak kembali. Server MUNGKIN sudah memproses (B21): aman diulang dengan kunci sama. */
export class NetworkError extends Error {
  readonly reason: NetworkReason;
  constructor(reason: NetworkReason) {
    super(reason);
    this.name = "NetworkError";
    this.reason = reason;
  }
}

export interface RequestOptions {
  body?: unknown;
  /** Untuk unggahan multipart; menimpa `body`. */
  form?: FormData;
  /** Idempotency-Key (wajib dikirim untuk aksi tulis; dibuat oleh useAction). */
  key?: string;
  signal?: AbortSignal;
}

export async function api<T>(method: string, path: string, o: RequestOptions = {}): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new NetworkError("offline");
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (o.key) headers["Idempotency-Key"] = o.key;
  let body: BodyInit | undefined;
  if (o.form) {
    body = o.form; // browser mengatur content-type + boundary
  } else if (o.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(o.body);
  }

  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers,
      body,
      signal: o.signal,
      credentials: "same-origin",
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new NetworkError("failed");
  }

  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }

  if (!res.ok) {
    const b = (json ?? {}) as Partial<ApiErrorBody>;
    throw new ApiError(isErrorCode(b.code) ? b.code : "internal_error", b.message, b.details);
  }
  return json as T;
}

/** Waktu tunggu klien bawaan untuk aksi tulis (CONFIG.net.requestTimeoutMs). */
export const REQUEST_TIMEOUT_MS = CONFIG.net.requestTimeoutMs;
