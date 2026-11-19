// Pembatas laju jendela tetap (explore.md B9).
// CATATAN JUJUR: penghitung berada di memori satu isolate Worker, jadi ini pembatas "sebisanya",
// bukan jaminan global. Batas yang harus tegas (OTP, review) memakai Workers Rate Limiting binding
// atau Durable Object, dipasang di Tahap 6 lewat antarmuka yang sama.

import { ApiError } from "@shared/errors";
import { createMiddleware } from "hono/factory";
import type { AppContext, AppEnv } from "../app-env";
import { logEvent } from "../lib/logger";

export interface LimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export class FixedWindowLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();
  private lastPrune = 0;

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  hit(key: string, now: number): LimitResult {
    this.prune(now);
    let w = this.windows.get(key);
    if (!w || now >= w.resetAt) {
      w = { count: 0, resetAt: now + this.windowMs };
      this.windows.set(key, w);
    }
    w.count += 1;
    return {
      allowed: w.count <= this.limit,
      remaining: Math.max(0, this.limit - w.count),
      retryAfterSec: Math.max(1, Math.ceil((w.resetAt - now) / 1000)),
    };
  }

  /** Buang jendela kedaluwarsa agar memori tidak membesar. */
  private prune(now: number): void {
    if (now - this.lastPrune < this.windowMs) return;
    this.lastPrune = now;
    for (const [k, w] of this.windows) if (now >= w.resetAt) this.windows.delete(k);
  }

  get size(): number {
    return this.windows.size;
  }
}

/** Kunci bawaan: alamat klien. Hanya dipakai di memori; tidak pernah ditulis ke log. */
const clientKey = (c: AppContext) => c.req.header("cf-connecting-ip") ?? "unknown";

export function rateLimit(opts: {
  /** Nama pembatas (muncul di log, bukan data pribadi) */
  name: string;
  limit: number;
  windowSec: number;
  key?: (c: AppContext) => string;
}) {
  const limiter = new FixedWindowLimiter(opts.limit, opts.windowSec * 1000);
  return createMiddleware<AppEnv>(async (c, next) => {
    const r = limiter.hit((opts.key ?? clientKey)(c), c.get("now")());
    if (!r.allowed) {
      logEvent(c, {
        eventId: c.get("event")?.id ?? "-",
        category: "spam",
        action: "spam.rate_limited",
        level: "warn",
        meta: { limiter: opts.name },
      });
      c.header("Retry-After", String(r.retryAfterSec));
      throw new ApiError("rate_limited");
    }
    await next();
  });
}
