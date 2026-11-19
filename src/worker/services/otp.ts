// OTP email pengunjung (explore.md A6, B7, B9): kode 6 digit, tersimpan sebagai HMAC, kedaluwarsa, percobaan
// terbatas, jeda antar permintaan, dan batas per jam per email (mencegah email-bombing dan biaya email).

import { CONFIG } from "@shared/config";
import { ApiError } from "@shared/errors";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { authOtps } from "../db/schema";
import type { Db } from "../lib/db";
import { hmacHex, safeEqual } from "../lib/identity";
import type { Deps } from "./visitors";

const PURPOSE = "visitor" as const;
const HOUR_MS = 3_600_000;

/** Enam digit seragam (tanpa bias modulo). */
export function randomCode(): string {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0xffffffff / 1_000_000) * 1_000_000;
  let n: number;
  do {
    crypto.getRandomValues(buf);
    n = buf[0] ?? 0;
  } while (n >= limit);
  return String(n % 1_000_000).padStart(6, "0");
}

const codeHash = (secret: string, emailHash: string, code: string) =>
  hmacHex(secret, `otp:${emailHash}:${code}`);

/** Membuat dan menyimpan kode baru. Melempar `otp_cooldown`/`rate_limited` bila terlalu sering. */
export async function issueOtp(
  db: Db,
  d: Deps,
  o: { secret: string; eventId: string; emailHash: string },
): Promise<string> {
  const recent = await db
    .select({ createdAt: authOtps.createdAt })
    .from(authOtps)
    .where(
      and(
        eq(authOtps.eventId, o.eventId),
        eq(authOtps.purpose, PURPOSE),
        eq(authOtps.emailHash, o.emailHash),
        gt(authOtps.createdAt, d.now - HOUR_MS),
      ),
    )
    .orderBy(desc(authOtps.createdAt));

  const last = recent[0];
  if (last && d.now - last.createdAt < CONFIG.net.otpCooldownSec * 1000) {
    throw new ApiError("otp_cooldown");
  }
  if (recent.length >= CONFIG.auth.otpRequestsPerEmailPerHour) throw new ApiError("rate_limited");

  const code = randomCode();
  await db.insert(authOtps).values({
    id: d.newId(),
    eventId: o.eventId,
    purpose: PURPOSE,
    emailHash: o.emailHash,
    codeHash: await codeHash(o.secret, o.emailHash, code),
    expiresAt: d.now + CONFIG.auth.otpTtlMinutes * 60_000,
    createdAt: d.now,
  });
  return code;
}

/** Memeriksa kode terbaru. Sukses menghapus semua kode email itu (sekali pakai). */
export async function consumeOtp(
  db: Db,
  d: Deps,
  o: { secret: string; eventId: string; emailHash: string; code: string },
): Promise<void> {
  const row = await db
    .select()
    .from(authOtps)
    .where(
      and(
        eq(authOtps.eventId, o.eventId),
        eq(authOtps.purpose, PURPOSE),
        eq(authOtps.emailHash, o.emailHash),
      ),
    )
    .orderBy(desc(authOtps.createdAt))
    .get();

  if (!row) throw new ApiError("otp_invalid");
  if (row.expiresAt <= d.now) throw new ApiError("otp_expired");
  if (row.attempts >= CONFIG.auth.otpMaxAttempts) throw new ApiError("otp_invalid");

  const ok = safeEqual(row.codeHash, await codeHash(o.secret, o.emailHash, o.code));
  if (!ok) {
    await db
      .update(authOtps)
      .set({ attempts: sql`${authOtps.attempts} + 1` })
      .where(eq(authOtps.id, row.id));
    throw new ApiError("otp_invalid");
  }
  await db
    .delete(authOtps)
    .where(
      and(
        eq(authOtps.eventId, o.eventId),
        eq(authOtps.purpose, PURPOSE),
        eq(authOtps.emailHash, o.emailHash),
      ),
    );
}
