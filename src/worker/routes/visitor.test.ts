import { CONFIG } from "@shared/config";
import { describe, expect, it } from "vitest";
import { createAccessKeys } from "../test/access";
import { fakeEmail, liveHarness, loginWithOtp, PROD_ENV, visitorClient } from "../test/visitor";

const noCookies = (r: { res: Response }) => r.res.headers.getSetCookie();

describe("GET /api/visitor/me", () => {
  it("belum masuk: visitor null + konfigurasi login publik", async () => {
    const { h } = await liveHarness({}, { GOOGLE_CLIENT_ID: "cid", TURNSTILE_SITE_KEY: "site" });
    const r = await visitorClient(h).call("GET", "/api/visitor/me");
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({
      visitor: null,
      authMode: "google_or_email",
      googleClientId: "cid",
      turnstileSiteKey: "site",
      reviewed: [],
    });
  });

  it("tanpa event aktif: 409 no_active_event", async () => {
    const { h } = await liveHarness();
    await h.t.d1.exec("UPDATE events SET is_active = 0");
    expect((await visitorClient(h).call("GET", "/api/visitor/me")).status).toBe(409);
  });

  it("respons tidak di-cache (berisi sesi)", async () => {
    const { h } = await liveHarness();
    const r = await visitorClient(h).call("GET", "/api/visitor/me");
    expect(r.res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("login email OTP", () => {
  it("minta kode → verifikasi → cookie HttpOnly + sesi terbaca", async () => {
    const { h } = await liveHarness();
    const v = await loginWithOtp(h, "Sari@Example.com", "Sari");
    expect(v.visitor.displayName).toBe("Sari");
    const me = await v.call("GET", "/api/visitor/me");
    expect(me.json.visitor).toMatchObject({ provider: "email", displayName: "Sari" });
    expect(me.json.visitor.id).toBe(v.visitor.id);
  });

  it("cookie: HttpOnly, SameSite=Lax, masa berlaku sesuai konfigurasi; email tidak ada di cookie", async () => {
    const { h } = await liveHarness();
    const v = visitorClient(h);
    const rq = await v.call("POST", "/api/visitor/otp/request", { email: "a@b.id" });
    const ver = await v.call("POST", "/api/visitor/otp/verify", {
      email: "a@b.id",
      code: rq.json.devCode,
    });
    const sc = noCookies(ver)[0] ?? "";
    expect(sc).toMatch(/visitor_session=/);
    expect(sc).toMatch(/HttpOnly/i);
    expect(sc).toMatch(/SameSite=Lax/i);
    expect(sc).toMatch(new RegExp(`Max-Age=${CONFIG.auth.sessionDays * 86400}`));
    expect(sc).not.toContain("a@b.id");
    expect(JSON.stringify(ver.json)).not.toContain("a@b.id");
  });

  it("kode TIDAK pernah dikirim ke klien di produksi dan email dikirim lewat pengirim", async () => {
    const mail = fakeEmail();
    const { h } = await liveHarness({ email: mail.send });
    const v = visitorClient(h);
    const r = await v.call("POST", "/api/visitor/otp/request", { email: "x@y.id" });
    expect(r.json).toEqual({ ok: true }); // pengirim ada → tidak ada devCode
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0]?.to).toBe("x@y.id");
    expect(mail.sent[0]?.text).toMatch(/\d{6}/);
  });

  it("produksi tanpa penyedia email: gagal (bukan diam-diam 'terkirim') dan tanpa devCode", async () => {
    const { h } = await liveHarness();
    const r = await visitorClient(h).call(
      "POST",
      "/api/visitor/otp/request",
      { email: "x@y.id" },
      { env: PROD_ENV },
    );
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(r.json)).not.toMatch(/devCode/);
  });

  it("kode salah: otp_invalid; setelah batas percobaan kode benar pun ditolak", async () => {
    const { h } = await liveHarness();
    const v = visitorClient(h);
    const rq = await v.call("POST", "/api/visitor/otp/request", { email: "a@b.id" });
    const wrong = rq.json.devCode === "000000" ? "111111" : "000000";
    for (let i = 0; i < CONFIG.auth.otpMaxAttempts; i++) {
      const r = await v.call("POST", "/api/visitor/otp/verify", { email: "a@b.id", code: wrong });
      expect(r.json.code).toBe("otp_invalid");
    }
    // Pembatas laju per menit dilewati dulu (jendela baru) agar yang diuji adalah batas percobaan OTP.
    h.clk.t += 61_000;
    const ok = await v.call("POST", "/api/visitor/otp/verify", {
      email: "a@b.id",
      code: rq.json.devCode,
    });
    expect(ok.json.code).toBe("otp_invalid");
  });

  it("kedaluwarsa: otp_expired", async () => {
    const { h } = await liveHarness();
    const v = visitorClient(h);
    const rq = await v.call("POST", "/api/visitor/otp/request", { email: "a@b.id" });
    h.clk.t += CONFIG.auth.otpTtlMinutes * 60_000 + 1;
    const r = await v.call("POST", "/api/visitor/otp/verify", {
      email: "a@b.id",
      code: rq.json.devCode,
    });
    expect(r.json.code).toBe("otp_expired");
  });

  it("kode sekali pakai", async () => {
    const { h } = await liveHarness();
    const v = visitorClient(h);
    const rq = await v.call("POST", "/api/visitor/otp/request", { email: "a@b.id" });
    const body = { email: "a@b.id", code: rq.json.devCode };
    expect((await v.call("POST", "/api/visitor/otp/verify", body)).status).toBe(200);
    expect((await v.call("POST", "/api/visitor/otp/verify", body)).json.code).toBe("otp_invalid");
  });

  it("jeda antar permintaan (cooldown) dan batas per jam per email", async () => {
    const { h } = await liveHarness();
    const v = visitorClient(h);
    expect((await v.call("POST", "/api/visitor/otp/request", { email: "a@b.id" })).status).toBe(
      200,
    );
    const again = await v.call("POST", "/api/visitor/otp/request", { email: "a@b.id" });
    expect(again.json.code).toBe("otp_cooldown");

    // Email lain tidak terpengaruh.
    expect((await v.call("POST", "/api/visitor/otp/request", { email: "lain@b.id" })).status).toBe(
      200,
    );

    // Batas per jam: 5 permintaan (tiap kali setelah cooldown), yang ke-6 ditolak.
    for (let i = 1; i < CONFIG.auth.otpRequestsPerEmailPerHour; i++) {
      h.clk.t += CONFIG.net.otpCooldownSec * 1000 + 1;
      expect((await v.call("POST", "/api/visitor/otp/request", { email: "a@b.id" })).status).toBe(
        200,
      );
    }
    h.clk.t += CONFIG.net.otpCooldownSec * 1000 + 1;
    const over = await v.call("POST", "/api/visitor/otp/request", { email: "a@b.id" });
    expect(over.json.code).toBe("rate_limited");
  });

  it("email tidak valid: 400; kolom asing ditolak (strict)", async () => {
    const { h } = await liveHarness();
    const v = visitorClient(h);
    expect(
      (await v.call("POST", "/api/visitor/otp/request", { email: "bukan-email" })).status,
    ).toBe(400);
    expect(
      (await v.call("POST", "/api/visitor/otp/request", { email: "a@b.id", role: "admin" })).status,
    ).toBe(400);
  });

  it("identitas disimpan sebagai HMAC: email asli tidak ada di tabel mana pun", async () => {
    const { h } = await liveHarness();
    await loginWithOtp(h, "rahasia@contoh.id");
    const rows = (await h.t.d1.prepare("SELECT * FROM visitors").all()).results;
    const otps = (await h.t.d1.prepare("SELECT * FROM auth_otps").all()).results;
    expect(rows).toHaveLength(1); // memastikan kueri benar-benar membaca baris
    expect(JSON.stringify([rows, otps])).not.toContain("rahasia@contoh.id");
  });

  it("email yang sama = pengunjung yang sama (tidak ada baris ganda)", async () => {
    const { h } = await liveHarness();
    const a = await loginWithOtp(h, "dua@kali.id");
    h.clk.t += CONFIG.net.otpCooldownSec * 1000 + 1;
    const b = await loginWithOtp(h, "DUA@kali.id");
    expect(a.visitor.id).toBe(b.visitor.id);
  });

  it("pengunjung yang diblokir tidak bisa masuk", async () => {
    const { h, s } = await liveHarness();
    const a = await loginWithOtp(h, "buruk@kali.id");
    await h.call("PUT", `/api/admin/e/${s.event.id}/visitors/${a.visitor.id}/blocked`, {
      blocked: true,
      reason: "spam berulang",
    });
    h.clk.t += CONFIG.net.otpCooldownSec * 1000 + 1;
    const v = visitorClient(h);
    const rq = await v.call("POST", "/api/visitor/otp/request", { email: "buruk@kali.id" });
    const r = await v.call("POST", "/api/visitor/otp/verify", {
      email: "buruk@kali.id",
      code: rq.json.devCode,
    });
    expect(r.json.code).toBe("visitor_blocked");
  });
});

describe("Turnstile", () => {
  it("dengan kunci rahasia: tanpa token atau token ditolak → 403 turnstile_failed", async () => {
    const { h } = await liveHarness(
      { turnstile: async ({ token }) => token === "ok" },
      { TURNSTILE_SECRET: "sec" },
    );
    const v = visitorClient(h);
    const none = await v.call("POST", "/api/visitor/otp/request", { email: "a@b.id" });
    expect(none.status).toBe(403);
    expect(none.json.code).toBe("turnstile_failed");
    const bad = await v.call("POST", "/api/visitor/otp/request", {
      email: "a@b.id",
      turnstileToken: "salah",
    });
    expect(bad.json.code).toBe("turnstile_failed");
    const ok = await v.call("POST", "/api/visitor/otp/request", {
      email: "a@b.id",
      turnstileToken: "ok",
    });
    expect(ok.status).toBe(200);
  });

  it("produksi tanpa kunci rahasia: gagal tertutup (tidak dilewati)", async () => {
    const { h } = await liveHarness();
    const r = await visitorClient(h).call(
      "POST",
      "/api/visitor/otp/request",
      { email: "a@b.id" },
      { env: PROD_ENV },
    );
    expect(r.status).toBe(500);
  });
});

describe("mode login per event", () => {
  const setMode = (
    h: Awaited<ReturnType<typeof liveHarness>>["h"],
    eventId: string,
    mode: string,
  ) => h.call("PUT", `/api/admin/events/${eventId}`, { settings: { reviewerAuthMode: mode } });

  it("ticket_code: OTP dan Google ditolak; kode tiket yang sah bisa masuk, yang salah tidak", async () => {
    const { h, s } = await liveHarness({}, { GOOGLE_CLIENT_ID: "cid" });
    await setMode(h, s.event.id, "ticket_code");
    const v = visitorClient(h);
    expect((await v.call("POST", "/api/visitor/otp/request", { email: "a@b.id" })).json.code).toBe(
      "forbidden",
    );
    expect(
      (await v.call("POST", "/api/visitor/google", { credential: "x".repeat(30) })).json.code,
    ).toBe("forbidden");

    expect((await v.call("POST", "/api/visitor/ticket", { code: "KODE-1234" })).json.code).toBe(
      "login_failed",
    );
    const { ticketIdentity } = await import("../lib/identity");
    const secret = "dev-only-session-secret-not-for-production";
    await h.t.d1
      .prepare("INSERT INTO ticket_codes (event_id, code_hash) VALUES (?, ?)")
      .bind(s.event.id, await ticketIdentity(secret, "KODE-1234"))
      .run();
    const ok = await v.call("POST", "/api/visitor/ticket", {
      code: "kode-1234",
      displayName: "Tamu",
    });
    expect(ok.status).toBe(200);
    expect(ok.json.visitor.provider).toBe("ticket");
  });

  it("open_turnstile: login anonim hanya di mode ini", async () => {
    const { h, s } = await liveHarness();
    const v = visitorClient(h);
    expect((await v.call("POST", "/api/visitor/anonymous", {})).json.code).toBe("forbidden");
    await setMode(h, s.event.id, "open_turnstile");
    const ok = await v.call("POST", "/api/visitor/anonymous", { displayName: "Anon" });
    expect(ok.status).toBe(200);
    expect(ok.json.visitor.provider).toBe("anon");
    // dan OTP tidak tersedia di mode ini
    expect((await v.call("POST", "/api/visitor/otp/request", { email: "a@b.id" })).json.code).toBe(
      "forbidden",
    );
  });
});

describe("login Google", () => {
  const GOOGLE = { cid: "client-123", iss: "https://accounts.google.com" };
  async function setup(over: Record<string, unknown> = {}) {
    const keys = await createAccessKeys("g-1");
    const { h, s } = await liveHarness(
      { googleKeys: async () => [keys.jwk] },
      { GOOGLE_CLIENT_ID: GOOGLE.cid },
    );
    const credential = await keys.sign({
      iss: GOOGLE.iss,
      aud: GOOGLE.cid,
      sub: "sub-1",
      email: "Budi@Gmail.com",
      email_verified: true,
      name: "Budi Santoso",
      exp: 999_999,
      ...over,
    });
    return { h, s, credential, keys };
  }

  it("token sah: masuk dengan NAMA DEPAN saja; email tidak di respons", async () => {
    const { h, credential } = await setup();
    const v = visitorClient(h);
    const r = await v.call("POST", "/api/visitor/google", { credential });
    expect(r.status).toBe(200);
    expect(r.json.visitor).toMatchObject({ provider: "google", displayName: "Budi" });
    expect(JSON.stringify(r.json)).not.toMatch(/gmail/i);
  });

  it("identitas sama dengan OTP untuk email yang sama (anti suara ganda lintas penyedia)", async () => {
    const { h, credential } = await setup();
    const viaOtp = await loginWithOtp(h, "budi@gmail.com");
    const g = visitorClient(h);
    const r = await g.call("POST", "/api/visitor/google", { credential });
    expect(r.json.visitor.id).toBe(viaOtp.visitor.id);
  });

  it("ditolak: audience salah, email belum terverifikasi, issuer asing, kedaluwarsa, tanda tangan palsu", async () => {
    const bad = [
      { aud: "client-lain" },
      { email_verified: false },
      { iss: "https://evil.example" },
      { exp: 1 },
    ];
    for (const over of bad) {
      const { h, credential } = await setup(over);
      const r = await visitorClient(h).call("POST", "/api/visitor/google", { credential });
      expect(r.json.code, JSON.stringify(over)).toBe("login_failed");
    }
    const { h, credential } = await setup();
    const forged = `${credential.slice(0, -6)}AAAAAA`;
    expect(
      (await visitorClient(h).call("POST", "/api/visitor/google", { credential: forged })).json
        .code,
    ).toBe("login_failed");
  });

  it("issuer tanpa skema (accounts.google.com) juga diterima", async () => {
    const { h, credential } = await setup({ iss: "accounts.google.com" });
    expect(
      (await visitorClient(h).call("POST", "/api/visitor/google", { credential })).status,
    ).toBe(200);
  });

  it("tanpa GOOGLE_CLIENT_ID: tidak tersedia", async () => {
    const { h } = await liveHarness();
    const r = await visitorClient(h).call("POST", "/api/visitor/google", {
      credential: "x".repeat(40),
    });
    expect(r.status).toBe(403);
  });
});

describe("sesi", () => {
  it("logout menghapus cookie; sesi event lain tidak berlaku", async () => {
    const { h } = await liveHarness();
    const v = await loginWithOtp(h, "a@b.id");
    expect((await v.call("GET", "/api/visitor/me")).json.visitor).not.toBeNull();
    await v.call("POST", "/api/visitor/logout", undefined, { key: false });
    expect((await v.call("GET", "/api/visitor/me")).json.visitor).toBeNull();
  });

  it("cookie dirusak/dipalsukan: dianggap belum masuk (bukan galat)", async () => {
    const { h } = await liveHarness();
    const v = visitorClient(h);
    v.jar.set("visitor_session", "bukan.token");
    expect((await v.call("GET", "/api/visitor/me")).json.visitor).toBeNull();
    v.jar.set(
      "visitor_session",
      `${btoa(JSON.stringify({ sub: "x", eid: "y", exp: 9e9 }))}.${"0".repeat(64)}`,
    );
    expect((await v.call("GET", "/api/visitor/me")).json.visitor).toBeNull();
  });

  it("sesi kedaluwarsa setelah sessionDays", async () => {
    const { h } = await liveHarness();
    const v = await loginWithOtp(h, "a@b.id");
    h.clk.t += CONFIG.auth.sessionDays * 86_400_000 + 5000;
    expect((await v.call("GET", "/api/visitor/me")).json.visitor).toBeNull();
  });

  it("setelah event selesai login/logout ditolak 403 event_ended (hanya-baca)", async () => {
    const { h } = await liveHarness();
    h.clk.t = 9_000_000_000_001; // lewat akhir event (jendela diperpanjang oleh liveHarness)
    const r = await visitorClient(h).call("POST", "/api/visitor/otp/request", { email: "a@b.id" });
    expect(r.status).toBe(403);
    expect(r.json.code).toBe("event_ended");
  });
});
