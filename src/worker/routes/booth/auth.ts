// Masuk dan pendaftaran booth (explore.md A4, B7): OTP email, tanpa kata sandi. Akun per-event; pemilik = email yang
// tercatat pada booth. OTP login hanya dikirim bila email terdaftar, tetapi jawabannya SAMA (tidak membocorkan email).

import type { BoothSession, OtpRequestResult } from "@shared/api-types";
import { ApiError } from "@shared/errors";
import { boothOtpRequestSchema, boothOtpVerifySchema, boothRegisterSchema } from "@shared/schemas";
import { Hono } from "hono";
import type { AppContext, AppEnv } from "../../app-env";
import type { BoothRow, EventRow } from "../../db/schema";
import {
  clearBoothCookie,
  clearRegisterCookie,
  readRegisterCookie,
  setBoothCookie,
  setRegisterCookie,
  signBoothToken,
  signRegisterProof,
  verifyRegisterProof,
} from "../../lib/booth-session";
import { getDb } from "../../lib/db";
import { deliver, type EmailSender } from "../../lib/email";
import { eventState } from "../../lib/event";
import { parseBody, serviceDeps } from "../../lib/http";
import { emailIdentity, safeEqual, sessionSecret } from "../../lib/identity";
import { logEvent } from "../../lib/logger";
import { assertHuman, isLocalDev, type TurnstileVerifier } from "../../lib/turnstile";
import { resolveBooth } from "../../middleware/booth-session";
import { requireEvent } from "../../middleware/event-gate";
import { idempotency } from "../../middleware/idempotency";
import { rateLimit } from "../../middleware/rate-limit";
import {
  boothMe,
  findBoothByEmail,
  registerBooth,
  touchOwnerLogin,
} from "../../services/booth-portal";
import { consumeOtp, issueOtp } from "../../services/otp";

export interface BoothAuthDeps {
  turnstile?: TurnstileVerifier;
  email?: EmailSender;
}

async function startSession(c: AppContext, booth: BoothRow, email: string): Promise<void> {
  const secret = sessionSecret(c.env);
  const d = serviceDeps(c);
  const { token, maxAgeSec } = await signBoothToken(
    secret,
    { boothId: booth.id, eventId: booth.eventId, emailHash: await emailIdentity(secret, email) },
    d.now,
  );
  setBoothCookie(c, token, maxAgeSec);
  await touchOwnerLogin(getDb(c.env), booth.id, d.now);
  logEvent(c, {
    eventId: booth.eventId,
    category: "auth",
    action: "auth.login",
    actor: { type: "booth", id: booth.id },
    meta: { role: "booth" },
  });
}

export function createBoothAuthRoutes(deps: BoothAuthDeps = {}) {
  const otpLimit = rateLimit({ name: "booth-otp", limit: 6, windowSec: 60 });
  const registerKey = idempotency({ required: true });
  const base = new Hono<AppEnv>();
  base.use("/api/booth/*", requireEvent);

  base.get("/api/booth/me", async (c) => {
    const event = c.get("event") as EventRow;
    const booth = await resolveBooth(c);
    const body: BoothSession = {
      me: booth ? await boothMe(getDb(c.env), event, booth) : null,
      turnstileSiteKey: c.env.TURNSTILE_SITE_KEY ?? null,
    };
    c.header("Cache-Control", "no-store");
    return c.json(body);
  });

  base.post("/api/booth/otp/request", otpLimit, async (c) => {
    const event = c.get("event") as EventRow;
    const body = await parseBody(c, boothOtpRequestSchema);
    await assertHuman(c, body.turnstileToken, deps.turnstile);
    const db = getDb(c.env);
    const register = body.purpose === "register";
    const existing = await findBoothByEmail(db, event.id, body.email);

    if (register) {
      const state = eventState(event, c.get("now")());
      if (state.frozen) throw new ApiError("event_ended");
      if (!state.registrationAccepting) throw new ApiError("registration_closed");
      if (existing) throw new ApiError("email_in_use");
    } else if (!existing) {
      return c.json<OtpRequestResult>({ ok: true }); // jawaban sama: email tidak terbongkar
    }

    const secret = sessionSecret(c.env);
    let code: string;
    try {
      code = await issueOtp(db, serviceDeps(c), {
        secret,
        eventId: event.id,
        emailHash: await emailIdentity(secret, body.email),
        purpose: register ? "booth_register" : "booth_login",
      });
    } catch (e) {
      if (!register && e instanceof ApiError && e.code === "otp_cooldown") {
        return c.json<OtpRequestResult>({ ok: true });
      }
      throw e;
    }
    const sent = await deliver(c, deps.email, {
      to: body.email,
      subject: `${register ? "Kode pendaftaran" : "Kode masuk"} booth ${event.name}`,
      text: `Kode kamu: ${code}. Berlaku 10 menit. Jangan bagikan ke siapa pun.`,
    });
    logEvent(c, { eventId: event.id, category: "auth", action: "auth.otp_requested" });
    return c.json<OtpRequestResult>({
      ok: true,
      ...(!sent && isLocalDev(c) ? { devCode: code } : {}),
    });
  });

  base.post("/api/booth/otp/verify", otpLimit, async (c) => {
    const event = c.get("event") as EventRow;
    const body = await parseBody(c, boothOtpVerifySchema);
    const secret = sessionSecret(c.env);
    const emailHash = await emailIdentity(secret, body.email);
    const register = body.purpose === "register";
    try {
      await consumeOtp(getDb(c.env), serviceDeps(c), {
        secret,
        eventId: event.id,
        emailHash,
        code: body.code,
        purpose: register ? "booth_register" : "booth_login",
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

    if (register) {
      // Email terbukti milik pendaftar: bukti ini dibawa ke POST /api/booth/register (cookie HttpOnly).
      const { token, maxAgeSec } = await signRegisterProof(
        secret,
        { eventId: event.id, emailHash },
        c.get("now")(),
      );
      setRegisterCookie(c, token, maxAgeSec);
      return c.json({ ok: true });
    }
    const booth = await findBoothByEmail(getDb(c.env), event.id, body.email);
    if (!booth) throw new ApiError("login_failed");
    await startSession(c, booth, body.email);
    return c.json({ ok: true });
  });

  base.post("/api/booth/register", registerKey, async (c) => {
    const event = c.get("event") as EventRow;
    const state = eventState(event, c.get("now")());
    if (state.frozen) throw new ApiError("event_ended");
    if (!state.registrationAccepting) throw new ApiError("registration_closed");

    const body = await parseBody(c, boothRegisterSchema);
    const secret = sessionSecret(c.env);
    const token = readRegisterCookie(c);
    const proof = token ? await verifyRegisterProof(secret, token, c.get("now")()) : null;
    // Bukti harus untuk event ini DAN email yang sama dengan yang dikirim: tidak bisa mendaftarkan email lain.
    const emailHash = await emailIdentity(secret, body.email);
    if (!proof || proof.eid !== event.id || !safeEqual(proof.eh, emailHash)) {
      throw new ApiError("unauthorized");
    }

    const { email, ...input } = body;
    const booth = await registerBooth(getDb(c.env), serviceDeps(c), {
      eventId: event.id,
      email,
      input,
      late: state.registrationIsLate,
    });
    clearRegisterCookie(c);
    await startSession(c, booth, email);
    logEvent(c, {
      eventId: event.id,
      category: "booth",
      action: state.registrationIsLate ? "booth.registered_late" : "booth.registered",
      actor: { type: "booth", id: booth.id },
      target: { type: "booth", id: booth.id },
    });
    return c.json({ ok: true }, 201);
  });

  base.post("/api/booth/logout", (c) => {
    clearBoothCookie(c);
    return c.json({ ok: true });
  });

  return base;
}
