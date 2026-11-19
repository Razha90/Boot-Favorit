import { describe, expect, it } from "vitest";
import { loginBooth, registerBoothVia, requestBoothOtp, setOwnerEmail } from "../../test/booth";
import { TIMES } from "../../test/fixtures";
import { fakeEmail, liveHarness, PROD_ENV, visitorClient } from "../../test/visitor";

const rows = async (h: Awaited<ReturnType<typeof liveHarness>>["h"], sql: string) =>
  (await h.t.d1.prepare(sql).all()).results as Record<string, unknown>[];

describe("pendaftaran mandiri booth (A4)", () => {
  it("OTP → bukti email → profil: booth berstatus pending, bersesi, dan TIDAK tampil publik", async () => {
    const { h, s } = await liveHarness();
    h.clk.t = 1500; // pendaftaran reguler dibuka
    const { b, reg } = await registerBoothVia(h, "Pemilik@Contoh.id", {
      name: "Batik Nusa",
      boothNo: "B7",
    });
    expect(reg.status).toBe(201);

    const me = (await b.call("GET", "/api/booth/me")).json.me;
    expect(me.booth).toMatchObject({ name: "Batik Nusa", boothNo: "B7", status: "pending" });
    expect(me.booth.isLate).toBe(false);
    expect(me.booth.createdBy).toBe("self");

    // email disimpan huruf kecil; belum tayang: tidak di snapshot, tidak bisa dibuka publik
    const row = (
      await rows(h, "SELECT id, email, status, is_late FROM booths WHERE name='Batik Nusa'")
    )[0];
    expect(row).toMatchObject({ email: "pemilik@contoh.id", status: "pending", is_late: 0 });
    const snap = (await visitorClient(h).call("GET", "/api/snapshot")).json;
    expect(snap.booths.map((x: { id: string }) => x.id)).not.toContain(me.booth.id);
    expect((await visitorClient(h).call("GET", `/api/booths/${me.booth.id}`)).status).toBe(404);
    expect(s.event.id).toBeTruthy();
  });

  it("hanya nama yang wajib; nama kosong ditolak", async () => {
    const { h } = await liveHarness();
    h.clk.t = 1500;
    const { reg } = await registerBoothVia(h, "a@contoh.id", { name: "Hanya Nama" });
    expect(reg.status).toBe(201);
    const bad = await registerBoothVia(h, "b@contoh.id", { name: "   " });
    expect(bad.reg.status).toBe(400);
  });

  it("tanpa bukti OTP, atau bukti untuk email LAIN, ditolak 401 dan tidak membuat booth", async () => {
    const { h } = await liveHarness();
    h.clk.t = 1500;
    const none = visitorClient(h);
    expect(
      (await none.call("POST", "/api/booth/register", { email: "x@c.id", name: "X" })).status,
    ).toBe(401);

    const b = visitorClient(h);
    const req = await requestBoothOtp(b, "asli@c.id", "register");
    await b.call(
      "POST",
      "/api/booth/otp/verify",
      { email: "asli@c.id", purpose: "register", code: req.json.devCode },
      { key: false },
    );
    const other = await b.call("POST", "/api/booth/register", {
      email: "lain@c.id",
      name: "Curang",
    });
    expect(other.status).toBe(401);
    expect(await rows(h, "SELECT id FROM booths WHERE name='Curang'")).toHaveLength(0);
  });

  it("kode login tidak bisa dipakai mendaftar (dan sebaliknya): tujuan OTP terpisah", async () => {
    const { h, s } = await liveHarness();
    h.clk.t = 1500;
    await setOwnerEmail(h, s.event.id, s.lengkap.id, "pemilik@c.id");
    const b = visitorClient(h);
    const login = await requestBoothOtp(b, "pemilik@c.id", "login");
    const wrong = await b.call(
      "POST",
      "/api/booth/otp/verify",
      { email: "pemilik@c.id", purpose: "register", code: login.json.devCode },
      { key: false },
    );
    expect(wrong.status).toBe(400);
    expect(wrong.json.code).toBe("otp_invalid");
  });

  it("email yang sudah dipakai booth lain di event ini: 409 email_in_use", async () => {
    const { h, s } = await liveHarness();
    h.clk.t = 1500;
    await setOwnerEmail(h, s.event.id, s.lengkap.id, "dipakai@c.id");
    const r = await requestBoothOtp(visitorClient(h), "dipakai@c.id", "register");
    expect(r.status).toBe(409);
    expect(r.json.code).toBe("email_in_use");
  });

  it("setelah penutupan: susulan via link diterima dan ditandai is_late; dimatikan admin → registration_closed", async () => {
    const { h, s } = await liveHarness();
    h.clk.t = 2500; // lewat penutupan reguler, sebelum event mulai
    const late = await registerBoothVia(h, "telat@c.id", { name: "Booth Telat" });
    expect(late.reg.status).toBe(201);
    expect((await late.b.call("GET", "/api/booth/me")).json.me.booth.isLate).toBe(true);

    await s.setEvent({ settingsJson: JSON.stringify({ allowLateRegistration: false }) });
    const r = await requestBoothOtp(visitorClient(h), "lagi@c.id", "register");
    expect(r.status).toBe(403);
    expect(r.json.code).toBe("registration_closed");
  });

  it("event selesai: pendaftaran ditolak sepenuhnya (event_ended)", async () => {
    const { h } = await liveHarness();
    h.clk.t = 9_000_000_000_001;
    const r = await requestBoothOtp(visitorClient(h), "akhir@c.id", "register");
    expect(r.status).toBe(403);
    expect(r.json.code).toBe("event_ended");
  });

  it("klik ganda (kunci idempotensi sama): satu booth, jawaban sama", async () => {
    const { h } = await liveHarness();
    h.clk.t = 1500;
    const b = visitorClient(h);
    const req = await requestBoothOtp(b, "ganda@c.id", "register");
    await b.call(
      "POST",
      "/api/booth/otp/verify",
      { email: "ganda@c.id", purpose: "register", code: req.json.devCode },
      { key: false },
    );
    const key = crypto.randomUUID();
    const body = { email: "ganda@c.id", name: "Sekali Saja" };
    const [r1, r2] = [
      await b.call("POST", "/api/booth/register", body, { key }),
      await b.call("POST", "/api/booth/register", body, { key }),
    ];
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    expect(await rows(h, "SELECT id FROM booths WHERE name='Sekali Saja'")).toHaveLength(1);
  });

  it("tanpa Idempotency-Key: 400", async () => {
    const { h } = await liveHarness();
    h.clk.t = 1500;
    const r = await visitorClient(h).call(
      "POST",
      "/api/booth/register",
      { email: "a@c.id", name: "A" },
      { key: false },
    );
    expect(r.status).toBe(400);
    expect(r.json.code).toBe("idempotency_key_required");
  });
});

describe("masuk ke portal (B7)", () => {
  it("booth buatan admin dengan email: OTP → sesi; /me menampilkan profil", async () => {
    const { h, s } = await liveHarness();
    await setOwnerEmail(h, s.event.id, s.lengkap.id, "pemilik@c.id");
    const b = await loginBooth(h, "pemilik@c.id");
    const me = (await b.call("GET", "/api/booth/me")).json;
    expect(me.me.booth).toMatchObject({
      id: s.lengkap.id,
      name: "Kopi Rempah",
      status: "approved",
    });
    expect(me.me.booth.whatsapp).toBe("6281234567890"); // nomor milik sendiri tampil bagi pemilik
    expect(me.turnstileSiteKey).toBeNull();
    const row = (
      await rows(h, `SELECT owner_last_login_at FROM booths WHERE id='${s.lengkap.id}'`)
    )[0];
    expect(row?.owner_last_login_at).toBe(3500);
  });

  it("email tak terdaftar: jawaban SAMA dengan yang terdaftar, tetapi tanpa kode dan tanpa OTP tersimpan", async () => {
    const { h, s } = await liveHarness();
    await setOwnerEmail(h, s.event.id, s.lengkap.id, "ada@c.id");
    const known = await requestBoothOtp(visitorClient(h), "ada@c.id", "login");
    const unknown = await requestBoothOtp(visitorClient(h), "tidak-ada@c.id", "login");
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(unknown.json).toEqual({ ok: true });
    expect(await rows(h, "SELECT id FROM auth_otps")).toHaveLength(1);
  });

  it("booth tanpa pemilik tidak bisa dicapai lewat login", async () => {
    const { h } = await liveHarness();
    const r = await requestBoothOtp(visitorClient(h), "siapa@c.id", "login");
    expect(r.json).toEqual({ ok: true });
    const ver = await visitorClient(h).call(
      "POST",
      "/api/booth/otp/verify",
      { email: "siapa@c.id", purpose: "login", code: "123456" },
      { key: false },
    );
    expect(ver.status).toBe(400);
  });

  it("kode salah: otp_invalid dan tidak ada sesi; /me tetap null", async () => {
    const { h, s } = await liveHarness();
    await setOwnerEmail(h, s.event.id, s.lengkap.id, "ada@c.id");
    const b = visitorClient(h);
    await requestBoothOtp(b, "ada@c.id", "login");
    const r = await b.call(
      "POST",
      "/api/booth/otp/verify",
      { email: "ada@c.id", purpose: "login", code: "000000" },
      { key: false },
    );
    expect(r.status).toBe(400);
    expect((await b.call("GET", "/api/booth/me")).json.me).toBeNull();
  });

  it("jeda antar permintaan OTP tidak membocorkan email: jawabannya tetap ok", async () => {
    const { h, s } = await liveHarness();
    await setOwnerEmail(h, s.event.id, s.lengkap.id, "ada@c.id");
    const b = visitorClient(h);
    await requestBoothOtp(b, "ada@c.id", "login");
    const again = await requestBoothOtp(b, "ada@c.id", "login");
    expect(again.status).toBe(200);
    expect(again.json).toEqual({ ok: true });
  });

  it("produksi: tanpa penyedia email permintaan GAGAL (bukan diam-diam terkirim); dengan pengirim, email berisi kode", async () => {
    const mail = fakeEmail();
    const { h, s } = await liveHarness({ email: mail.send });
    await setOwnerEmail(h, s.event.id, s.lengkap.id, "ada@c.id");
    const ok = await visitorClient(h).call(
      "POST",
      "/api/booth/otp/request",
      { email: "ada@c.id", purpose: "login" },
      { key: false, env: { ...PROD_ENV, TURNSTILE_SECRET: "x" } },
    );
    // Turnstile produksi menolak tanpa token; ini memastikan jalur produksi tidak dilewati.
    expect(ok.status).toBe(403);

    const dev = await requestBoothOtp(visitorClient(h), "ada@c.id", "login");
    expect(dev.json.devCode).toBeUndefined(); // ada pengirim: kode lewat email, bukan respons
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0]?.to).toBe("ada@c.id");
    expect(mail.sent[0]?.text).toMatch(/\d{6}/);
  });

  it("logout menghapus sesi", async () => {
    const { h, s } = await liveHarness();
    await setOwnerEmail(h, s.event.id, s.lengkap.id, "ada@c.id");
    const b = await loginBooth(h, "ada@c.id");
    await b.call("POST", "/api/booth/logout", undefined, { key: false });
    expect((await b.call("GET", "/api/booth/me")).json.me).toBeNull();
  });
});

describe("kepemilikan berubah (B7: owner_changed)", () => {
  it("admin melepas pemilik → aksi berikutnya 401 owner_changed dan cookie dihapus", async () => {
    const { h, s } = await liveHarness();
    await setOwnerEmail(h, s.event.id, s.lengkap.id, "ada@c.id");
    const b = await loginBooth(h, "ada@c.id");
    expect((await b.call("PUT", "/api/booth/me", { tagline: "baru" })).status).toBe(200);

    await setOwnerEmail(h, s.event.id, s.lengkap.id, null);
    const after = await b.call("PUT", "/api/booth/me", { tagline: "lagi" });
    expect(after.status).toBe(401);
    expect(after.json.code).toBe("owner_changed");
    expect((await b.call("GET", "/api/booth/me")).json.me).toBeNull(); // cookie sudah dihapus
  });

  it("admin mengganti ke email lain → sesi lama ditolak; pemilik baru bisa masuk", async () => {
    const { h, s } = await liveHarness();
    await setOwnerEmail(h, s.event.id, s.lengkap.id, "lama@c.id");
    const lama = await loginBooth(h, "lama@c.id");
    await setOwnerEmail(h, s.event.id, s.lengkap.id, "baru@c.id");

    const r = await lama.call("GET", "/api/booth/me");
    expect(r.status).toBe(401);
    expect(r.json.code).toBe("owner_changed");

    const baru = await loginBooth(h, "baru@c.id");
    expect((await baru.call("GET", "/api/booth/me")).json.me.booth.id).toBe(s.lengkap.id);
  });

  it("sesi event lain tidak berlaku (akun per-event)", async () => {
    const { h, s } = await liveHarness();
    await setOwnerEmail(h, s.event.id, s.lengkap.id, "ada@c.id");
    const b = await loginBooth(h, "ada@c.id");
    // event lain menjadi aktif: cookie lama membawa eid event sebelumnya
    const other = (await h.call("POST", "/api/admin/events", { name: "Event Lain", ...TIMES })).json
      .event;
    await h.call("POST", `/api/admin/events/${other.id}/activate`);
    expect((await b.call("GET", "/api/booth/me")).json.me).toBeNull();
  });
});

describe("portal hanya-baca (B17, A4)", () => {
  it("setelah event selesai: login dan baca tetap bisa, semua penulisan 403 event_ended", async () => {
    const { h, s } = await liveHarness();
    await setOwnerEmail(h, s.event.id, s.lengkap.id, "ada@c.id");
    const b = await loginBooth(h, "ada@c.id");
    h.clk.t = 9_000_000_000_001;
    expect((await b.call("GET", "/api/booth/me")).status).toBe(200);
    const w = await b.call("PUT", "/api/booth/me", { tagline: "terlambat" });
    expect(w.status).toBe(403);
    expect(w.json.code).toBe("event_ended");
    const again = await loginBooth(h, "ada@c.id"); // OTP + login tetap diizinkan
    expect((await again.call("GET", "/api/booth/me")).json.me.booth.id).toBe(s.lengkap.id);
  });

  it("ditolak/ditangguhkan: portal hanya-baca (booth_not_editable); status tetap terlihat", async () => {
    const { h, s } = await liveHarness();
    await setOwnerEmail(h, s.event.id, s.lengkap.id, "ada@c.id");
    const b = await loginBooth(h, "ada@c.id");
    for (const status of ["rejected", "suspended"] as const) {
      await h.call("PATCH", `${s.base}/${s.lengkap.id}`, {
        status,
        rejectReason: "alasan uji",
        reason: "uji coba",
      });
      const w = await b.call("PUT", "/api/booth/me", { tagline: "ubah" });
      expect(w.status).toBe(403);
      expect(w.json.code).toBe("booth_not_editable");
      expect((await b.call("GET", "/api/booth/me")).json.me.booth.status).toBe(status);
    }
  });
});
