// Login dan sesi pengunjung (explore.md A6, B7, B9). Pengunjung WAJIB memverifikasi email (kode OTP lewat email,
// atau Google); tidak ada login anonim/kode tiket dan TIDAK ADA logout pengunjung (anti kecurangan: identitas =
// HMAC email terverifikasi, jadi ganti akun berarti memerlukan email lain yang juga terverifikasi).
// Turnstile pada tiap login. Sesi = cookie HttpOnly bertanda tangan, terikat ke event.

import type { OtpRequestResult, ReviewerAuthMode, VisitorMe } from "@shared/api-types";
import { ApiError } from "@shared/errors";
import { googleLoginSchema, otpRequestSchema, otpVerifySchema } from "@shared/schemas";
import { Hono } from "hono";
import type { AppContext, AppEnv } from "../app-env";
import type { EventRow } from "../db/schema";
import { getDb } from "../lib/db";
import { deliver, type EmailSender } from "../lib/email";
import {
  fetchGoogleKeys,
  firstName,
  type GoogleKeyFetcher,
  verifyGoogleCredential,
} from "../lib/google";
import { parseBody, serviceDeps } from "../lib/http";
import { emailIdentity, sessionSecret } from "../lib/identity";
import { logEvent } from "../lib/logger";
import { setVisitorCookie, signVisitorToken } from "../lib/session";
import { assertHuman, isLocalDev, type TurnstileVerifier } from "../lib/turnstile";
import { requireEvent } from "../middleware/event-gate";
import { rateLimit } from "../middleware/rate-limit";
import { loadVisitor } from "../middleware/visitor-session";
import { consumeOtp, issueOtp } from "../services/otp";
import { ratingsVisible } from "../services/public";
import { myReviews } from "../services/reviews";
import { upsertVisitor } from "../services/visitors";

export interface VisitorDeps {
  turnstile?: TurnstileVerifier;
  email?: EmailSender;
  googleKeys?: GoogleKeyFetcher;
}

/** Satu-satunya mode: email terverifikasi (OTP atau Google). Nilai lama di pengaturan event diabaikan. */
export const authModeOf = (_e: EventRow): ReviewerAuthMode => "google_or_email";

function requireActiveEvent(c: AppContext): EventRow {
  const event = c.get("event");
  if (!event) throw new ApiError("no_active_event");
  return event;
}

async function startSession(
  c: AppContext,
  o: {
    provider: "google" | "email" | "ticket" | "anon";
    identityHash: string;
    displayName: string | null;
  },
) {
  const event = c.get("event") as EventRow;
  const d = serviceDeps(c);
  const visitor = await upsertVisitor(getDb(c.env), d, { eventId: event.id, ...o });
  if (visitor.blocked === 1) throw new ApiError("visitor_blocked");
  const { token, maxAgeSec } = await signVisitorToken(
    sessionSecret(c.env),
    visitor.id,
    event.id,
    d.now,
  );
  setVisitorCookie(c, token, maxAgeSec);
  logEvent(c, {
    eventId: event.id,
    category: "auth",
    action: "auth.login",
    actor: { type: "visitor", id: visitor.id },
    meta: { provider: o.provider },
  });
  return visitor;
}

const me = (v: {
  id: string;
  displayName: string | null;
  provider: "google" | "email" | "ticket" | "anon";
}) => ({
  id: v.id,
  displayName: v.displayName,
  provider: v.provider,
});

export function createVisitorRoutes(deps: VisitorDeps = {}) {
  const loginLimit = rateLimit({ name: "visitor-login", limit: 20, windowSec: 60 });
  const otpLimit = rateLimit({ name: "visitor-otp", limit: 6, windowSec: 60 });
  const base = new Hono<AppEnv>();

  base.use("/api/visitor/*", requireEvent);

  base.get("/api/visitor/me", loadVisitor, async (c) => {
    const event = c.get("event") as EventRow;
    const v = c.get("visitor");
    const show = ratingsVisible(event);
    const reviewed = v
      ? (await myReviews(getDb(c.env), event.id, v.id)).map((r) => ({
          boothId: r.boothId,
          stars: show ? r.stars : null,
        }))
      : [];
    const body: VisitorMe = {
      visitor: v ? me(v) : null,
      authMode: authModeOf(event),
      googleClientId: c.env.GOOGLE_CLIENT_ID ?? null,
      turnstileSiteKey: c.env.TURNSTILE_SITE_KEY ?? null,
      reviewed,
    };
    c.header("Cache-Control", "no-store");
    return c.json(body);
  });

  base.post("/api/visitor/google", loginLimit, async (c) => {
    requireActiveEvent(c);
    const body = await parseBody(c, googleLoginSchema);
    await assertHuman(c, body.turnstileToken, deps.turnstile);
    const clientId = c.env.GOOGLE_CLIENT_ID;
    if (!clientId) throw new ApiError("forbidden", "google_not_configured");
    const g = await verifyGoogleCredential(body.credential, {
      clientId,
      now: c.get("now")(),
      getKeys: deps.googleKeys ?? fetchGoogleKeys,
    });
    // Identitas = HMAC(email): satu orang satu identitas walau berganti Google/OTP (anti suara ganda).
    const identityHash = await emailIdentity(sessionSecret(c.env), g.email);
    const v = await startSession(c, {
      provider: "google",
      identityHash,
      displayName: firstName(g.name),
    });
    return c.json({ visitor: me(v) });
  });

  base.post("/api/visitor/otp/request", otpLimit, async (c) => {
    const event = requireActiveEvent(c);
    const body = await parseBody(c, otpRequestSchema);
    await assertHuman(c, body.turnstileToken, deps.turnstile);
    const secret = sessionSecret(c.env);
    const emailHash = await emailIdentity(secret, body.email);
    const d = serviceDeps(c);
    const code = await issueOtp(getDb(c.env), d, { secret, eventId: event.id, emailHash });
    const sent = await deliver(c, deps.email, {
      to: body.email,
      subject: `Kode masuk ${event.name}`,
      text: `Kode kamu: ${code}. Berlaku 10 menit. Jangan bagikan ke siapa pun.`,
    });
    logEvent(c, { eventId: event.id, category: "auth", action: "auth.otp_requested" });
    const res: OtpRequestResult = {
      ok: true,
      ...(!sent && isLocalDev(c) ? { devCode: code } : {}),
    };
    return c.json(res);
  });

  base.post("/api/visitor/otp/verify", otpLimit, async (c) => {
    const event = requireActiveEvent(c);
    const body = await parseBody(c, otpVerifySchema);
    const secret = sessionSecret(c.env);
    const emailHash = await emailIdentity(secret, body.email);
    try {
      await consumeOtp(getDb(c.env), serviceDeps(c), {
        secret,
        eventId: event.id,
        emailHash,
        code: body.code,
      });
    } catch (e) {
      logEvent(c, {
        eventId: event.id,
        category: "auth",
        action: "auth.otp_failed",
        level: "warn",
      });
      throw e;
    }
    const v = await startSession(c, {
      provider: "email",
      identityHash: emailHash,
      displayName: body.displayName,
    });
    return c.json({ visitor: me(v) });
  });

  return base;
}
