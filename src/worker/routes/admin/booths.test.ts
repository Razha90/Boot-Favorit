import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { boothStats, booths, events } from "../../db/schema";
import { adminHarness } from "../../test/admin";
import { TIMES } from "../../test/fixtures";

async function setup() {
  const h = adminHarness();
  const event = (await h.call("POST", "/api/admin/events", { name: "Expo 2026", ...TIMES })).json
    .event as { id: string };
  const base = `/api/admin/e/${event.id}/booths`;
  return { h, event, base };
}

describe("POST booths: admin membuat booth (A16)", () => {
  it("hanya dengan nama: langsung tayang, tanpa pemilik, bukan susulan", async () => {
    const { h, event, base } = await setup();
    const r = await h.call("POST", base, { name: "  Kopi Rempah  " });
    expect(r.status).toBe(201);
    expect(r.json.booth).toMatchObject({
      name: "Kopi Rempah",
      email: null,
      ownerState: "none",
      status: "approved",
      isLate: false,
      createdBy: "admin",
      approvedBy: "admin@unimed.test",
      completeness: "name_only",
      photoCount: 0,
      productCount: 0,
      reviewCount: 0,
      average: null,
    });
    // baris booth_stats dibuat dan kunci cache event naik
    expect(await h.t.db.select().from(boothStats)).toHaveLength(1);
    const ev = await h.t.db.select().from(events).where(eq(events.id, event.id)).get();
    expect(ev?.statsVersion).toBe(1);
  });

  it("jalur admin tidak terikat penutupan pendaftaran maupun event selesai", async () => {
    const { h, base } = await setup();
    h.clk.t = 2500; // pendaftaran reguler sudah ditutup
    expect((await h.call("POST", base, { name: "Susulan A" })).json.booth.isLate).toBe(false);
    h.clk.t = 9999; // event selesai
    const r = await h.call("POST", base, { name: "Setelah Selesai" });
    expect(r.status).toBe(201);
  });

  it("dengan email: status pemilik 'diundang' dan tidak ada email terkirim", async () => {
    const { h, base } = await setup();
    const r = await h.call("POST", base, { name: "Mie Ayam", email: "Pemilik@Contoh.ID" });
    expect(r.json.booth).toMatchObject({ email: "pemilik@contoh.id", ownerState: "invited" });
  });

  it("banyak booth tanpa pemilik boleh; email ganda 409; nama kosong 400", async () => {
    const { h, base } = await setup();
    await h.call("POST", base, { name: "A" });
    await h.call("POST", base, { name: "B" });
    await h.call("POST", base, { name: "C", email: "x@contoh.id" });
    expect((await h.call("POST", base, { name: "D", email: "x@contoh.id" })).json.code).toBe(
      "email_in_use",
    );
    expect((await h.call("POST", base, { name: "  " })).status).toBe(400);
    expect((await h.call("POST", base, { name: "Z", email: "bukan-email" })).status).toBe(400);
  });

  it("klik ganda dengan kunci sama membuat tepat satu booth", async () => {
    const { h, base } = await setup();
    const key = crypto.randomUUID();
    const a = await h.call("POST", base, { name: "Sekali" }, { key });
    const b = await h.call("POST", base, { name: "Sekali" }, { key });
    expect(b.headers.get("Idempotent-Replay")).toBe("true");
    expect(b.json.booth.id).toBe(a.json.booth.id);
    expect(await h.t.db.select().from(booths)).toHaveLength(1);
  });

  it("event tidak ada → 404", async () => {
    const { h } = await setup();
    expect((await h.call("POST", "/api/admin/e/nope/booths", { name: "X" })).status).toBe(404);
  });
});

describe("POST booths/import: impor CSV (B26)", () => {
  const rows = (n: number, prefix = "Booth") =>
    Array.from({ length: n }, (_, i) => ({ name: `${prefix} ${i + 1}` }));

  it("baris yang hanya bernama (tanpa kolom email sama sekali) semuanya dibuat dan tayang", async () => {
    const { h, base } = await setup();
    const r = await h.call("POST", `${base}/import`, { rows: rows(3) });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ created: 3, skipped: 0, errors: 0 });
    const all = await h.t.db.select().from(booths);
    expect(
      all.every((b) => b.status === "approved" && b.email === null && b.createdBy === "admin"),
    ).toBe(true);
    expect(await h.t.db.select().from(boothStats)).toHaveLength(3);
  });

  it("email, nomor, tagline, dan deskripsi opsional dibawa; status pemilik mengikuti email", async () => {
    const { h, base } = await setup();
    const r = await h.call("POST", `${base}/import`, {
      rows: [
        { name: "Lengkap", boothNo: "A1", email: "a@contoh.id", tagline: "t", description: "d" },
        { name: "Tanpa Email", boothNo: "A2", email: "" },
      ],
    });
    expect(r.json.created).toBe(2);
    const list = (await h.call("GET", base)).json.booths as {
      name: string;
      ownerState: string;
      boothNo: string;
    }[];
    expect(list.find((b) => b.name === "Lengkap")).toMatchObject({
      ownerState: "invited",
      boothNo: "A1",
    });
    expect(list.find((b) => b.name === "Tanpa Email")).toMatchObject({ ownerState: "none" });
  });

  it("galat per baris: email sudah dipakai dan email ganda dalam file; baris lain tetap dibuat", async () => {
    const { h, base } = await setup();
    await h.call("POST", base, { name: "Lama", email: "dipakai@contoh.id" });
    const r = await h.call("POST", `${base}/import`, {
      rows: [
        { name: "Baru 1", email: "dipakai@contoh.id" },
        { name: "Baru 2", email: "unik@contoh.id" },
        { name: "Baru 3", email: "UNIK@contoh.id" },
        { name: "Baru 4" },
      ],
    });
    expect(r.json.created).toBe(2);
    expect(
      r.json.results.map((x: { status: string; reason?: string }) => x.reason ?? x.status),
    ).toEqual(["email_in_use", "created", "email_duplicate_in_file", "created"]);
  });

  it("nama kembar dilewati secara bawaan (mencegah ganda); 'create' tetap membuat", async () => {
    const { h, base } = await setup();
    await h.call("POST", base, { name: "Kopi Rempah" });
    const skip = await h.call("POST", `${base}/import`, {
      rows: [{ name: "kopi rempah" }, { name: "Baru" }, { name: "BARU" }],
    });
    expect(skip.json).toMatchObject({ created: 1, skipped: 2 });

    const force = await h.call("POST", `${base}/import`, {
      rows: [{ name: "Kopi Rempah" }],
      onDuplicateName: "create",
    });
    expect(force.json.created).toBe(1);
  });

  it("mengunggah file yang sama dua kali (kunci berbeda) tidak menggandakan booth", async () => {
    const { h, base } = await setup();
    await h.call("POST", `${base}/import`, { rows: rows(4) });
    const again = await h.call("POST", `${base}/import`, { rows: rows(4) });
    expect(again.json).toMatchObject({ created: 0, skipped: 4 });
    expect(await h.t.db.select().from(booths)).toHaveLength(4);
  });

  it("klik ganda dengan kunci sama: respons diputar ulang, tetap satu kali impor", async () => {
    const { h, base } = await setup();
    const key = crypto.randomUUID();
    await h.call("POST", `${base}/import`, { rows: rows(2) }, { key });
    const replay = await h.call("POST", `${base}/import`, { rows: rows(2) }, { key });
    expect(replay.headers.get("Idempotent-Replay")).toBe("true");
    expect(await h.t.db.select().from(booths)).toHaveLength(2);
  });

  it("batas baris: 500 diterima, 501 dan kosong ditolak", async () => {
    const { h, base } = await setup();
    expect((await h.call("POST", `${base}/import`, { rows: rows(501) })).status).toBe(400);
    expect((await h.call("POST", `${base}/import`, { rows: [] })).status).toBe(400);
    expect((await h.call("POST", `${base}/import`, { rows: rows(500) })).json.created).toBe(500);
  });

  it("satu potongan gagal tidak membatalkan potongan lain; potongan yang gagal batal seluruhnya", async () => {
    const { h, base } = await setup();
    // Jebakan: sisipan nama 'BOOM' membuat batch() potongannya gagal (seperti galat D1 di tengah jalan).
    h.t.sqlite.exec(
      "CREATE TRIGGER boom BEFORE INSERT ON booths WHEN NEW.name = 'BOOM' BEGIN SELECT RAISE(ABORT, 'boom'); END",
    );
    const input = rows(120);
    input[60] = { name: "BOOM" }; // potongan ke-2 (indeks 50–99) berisi baris bermasalah
    const r = await h.call("POST", `${base}/import`, { rows: input });
    const byStatus = (s: string) =>
      r.json.results.filter((x: { status: string }) => x.status === s).length;
    expect(byStatus("created")).toBe(70); // potongan 1 (50) dan 3 (20)
    expect(byStatus("error")).toBe(50); // seluruh potongan 2, atomik
    expect(r.json.results[60]).toMatchObject({ status: "error", reason: "chunk_failed" });
    expect(await h.t.db.select().from(booths)).toHaveLength(70);
    // booth_stats ikut batal bersama potongannya
    expect(await h.t.db.select().from(boothStats)).toHaveLength(70);
  });

  it("menaikkan stats_version sekali, bukan per baris", async () => {
    const { h, event, base } = await setup();
    await h.call("POST", `${base}/import`, { rows: rows(60) });
    const ev = await h.t.db.select().from(events).where(eq(events.id, event.id)).get();
    expect(ev?.statsVersion).toBe(1);
  });
});

describe("PATCH booth", () => {
  async function withBooth(over: Record<string, unknown> = {}) {
    const s = await setup();
    const booth = (await s.h.call("POST", s.base, { name: "Kopi", ...over })).json.booth as {
      id: string;
      version: number;
    };
    return { ...s, booth, url: `${s.base}/${booth.id}` };
  }

  it("booth tanpa pemilik: ubah tanpa alasan; melengkapi mengubah tingkat kelengkapan", async () => {
    const { h, url } = await withBooth();
    const r = await h.call("PATCH", url, {
      boothNo: "A12",
      tagline: "Hangat",
      description: "Kopi dengan rempah",
      about: "Cerita panjang",
      teamName: "Prodi Gizi",
    });
    expect(r.status).toBe(200);
    expect(r.json.booth).toMatchObject({
      boothNo: "A12",
      teamName: "Prodi Gizi",
      completeness: "partial",
    });
  });

  it("null atau kosong menghapus isian; tidak disebut = tidak berubah", async () => {
    const { h, url } = await withBooth({ boothNo: "A1", tagline: "x" });
    const r = await h.call("PATCH", url, { tagline: "" });
    expect(r.json.booth).toMatchObject({ tagline: null, boothNo: "A1" });
  });

  it("booth berpemilik aktif: perubahan wajib beralasan (≥ 5 karakter)", async () => {
    const { h, t, booth, url } = await (async () => {
      const s = await withBooth({ email: "o@contoh.id" });
      // simulasikan pemilik pernah login
      await s.h.t.db.update(booths).set({ ownerLastLoginAt: 1 }).where(eq(booths.id, s.booth.id));
      return { ...s, t: s.h.t };
    })();
    void t;
    const no = await h.call("PATCH", url, { name: "Ganti" });
    expect(no.status).toBe(400);
    expect(no.json.code).toBe("reason_required");
    const short = await h.call("PATCH", url, { name: "Ganti", reason: "abc" });
    expect(short.json.code).toBe("reason_required");
    const ok = await h.call("PATCH", url, { name: "Ganti", reason: "perbaikan ejaan" });
    expect(ok.status).toBe(200);
    expect(ok.json.booth.name).toBe("Ganti");
    expect(booth.id).toBeTruthy();
  });

  it("menolak versi usang (kontrol konkurensi)", async () => {
    const { h, booth, url } = await withBooth();
    await h.call("PATCH", url, { name: "Satu" });
    const stale = await h.call("PATCH", url, { name: "Dua", version: booth.version });
    expect(stale.status).toBe(409);
    expect(stale.json.code).toBe("version_conflict");
  });

  it("status: tolak/revisi wajib alasan penolakan; setujui membersihkan alasan", async () => {
    const { h, url } = await withBooth();
    expect((await h.call("PATCH", url, { status: "rejected" })).json.code).toBe("reason_required");
    const rej = await h.call("PATCH", url, {
      status: "rejected",
      rejectReason: "Foto tidak pantas",
    });
    expect(rej.json.booth).toMatchObject({ status: "rejected", rejectReason: "Foto tidak pantas" });
    const app = await h.call("PATCH", url, { status: "approved" });
    expect(app.json.booth).toMatchObject({
      status: "approved",
      rejectReason: null,
      approvedBy: "admin@unimed.test",
    });
  });

  it("tanpa perubahan nyata tidak menulis apa pun (versi tetap)", async () => {
    const { h, booth, url } = await withBooth();
    const r = await h.call("PATCH", url, { name: "Kopi" });
    expect(r.json.booth.version).toBe(booth.version);
  });

  it("booth milik event lain tidak bisa diakses lewat event ini", async () => {
    const { h, booth } = await withBooth();
    const other = (await h.call("POST", "/api/admin/events", { name: "Lain", ...TIMES })).json
      .event;
    const r = await h.call("GET", `/api/admin/e/${other.id}/booths/${booth.id}`);
    expect(r.status).toBe(404);
  });
});

describe("pemilik (A16)", () => {
  async function owned() {
    const s = await setup();
    const booth = (await s.h.call("POST", s.base, { name: "Kopi" })).json.booth as { id: string };
    return { ...s, booth, url: `${s.base}/${booth.id}/owner` };
  }

  it("menambah pemilik belakangan: status 'diundang', tanpa mengirim apa pun", async () => {
    const { h, url } = await owned();
    const r = await h.call("PUT", url, { email: "Baru@Contoh.ID" });
    expect(r.json.booth).toMatchObject({ email: "baru@contoh.id", ownerState: "invited" });
  });

  it("melepas pemilik (email kosong) mengembalikan ke tanpa pemilik dan mereset login", async () => {
    const { h, booth, url } = await owned();
    await h.call("PUT", url, { email: "a@contoh.id" });
    await h.t.db.update(booths).set({ ownerLastLoginAt: 123 }).where(eq(booths.id, booth.id));
    // pemilik aktif: wajib alasan
    expect((await h.call("PUT", url, { email: "" })).json.code).toBe("reason_required");
    const r = await h.call("PUT", url, { email: "", reason: "pemilik mengundurkan diri" });
    expect(r.json.booth).toMatchObject({ email: null, ownerState: "none" });
    const row = await h.t.db.select().from(booths).where(eq(booths.id, booth.id)).get();
    expect(row?.ownerLastLoginAt).toBeNull();
  });

  it("mengganti pemilik mereset status login; email yang dipakai booth lain ditolak", async () => {
    const { h, base, booth, url } = await owned();
    await h.call("POST", base, { name: "Lain", email: "dipakai@contoh.id" });
    await h.call("PUT", url, { email: "a@contoh.id" });
    await h.t.db.update(booths).set({ ownerLastLoginAt: 5 }).where(eq(booths.id, booth.id));
    const dup = await h.call("PUT", url, { email: "dipakai@contoh.id", reason: "pindah pemilik" });
    expect(dup.json.code).toBe("email_in_use");
    const ok = await h.call("PUT", url, { email: "b@contoh.id", reason: "pindah pemilik" });
    expect(ok.json.booth.ownerState).toBe("invited");
  });

  it("email yang sama dengan sekarang: tidak ada perubahan", async () => {
    const { h, url } = await owned();
    await h.call("PUT", url, { email: "a@contoh.id" });
    const again = await h.call("PUT", url, { email: "a@contoh.id" });
    expect(again.status).toBe(200);
  });
});

describe("WhatsApp atas nama pemilik", () => {
  async function b() {
    const s = await setup();
    const booth = (await s.h.call("POST", s.base, { name: "Kopi" })).json.booth as { id: string };
    return { ...s, url: `${s.base}/${booth.id}/whatsapp`, id: booth.id };
  }

  it("menyimpan nomor ternormalisasi hanya dengan konfirmasi persetujuan; nomor tidak muncul di tampilan", async () => {
    const { h, id, url } = await b();
    const noConsent = await h.call("PUT", url, { number: "0812-3456-7890" });
    expect(noConsent.status).toBe(400);
    const r = await h.call("PUT", url, { number: "0812-3456-7890", consentConfirmedByAdmin: true });
    expect(r.json.booth).toMatchObject({ hasWhatsapp: true, whatsappConsentBy: "admin" });
    expect(JSON.stringify(r.json)).not.toContain("6281234567890");
    const row = await h.t.db.select().from(booths).where(eq(booths.id, id)).get();
    expect(row?.whatsappE164).toBe("6281234567890");
    expect(row?.whatsappConsentBy).toBe("admin");
  });

  it("nomor tidak valid ditolak; kosong menghapus nomor dan persetujuan", async () => {
    const { h, id, url } = await b();
    expect(
      (await h.call("PUT", url, { number: "123", consentConfirmedByAdmin: true })).status,
    ).toBe(400);
    await h.call("PUT", url, { number: "+62 812 3456 7890", consentConfirmedByAdmin: true });
    const r = await h.call("PUT", url, { number: "" });
    expect(r.json.booth.hasWhatsapp).toBe(false);
    const row = await h.t.db.select().from(booths).where(eq(booths.id, id)).get();
    expect(row).toMatchObject({
      whatsappE164: null,
      whatsappConsentAt: null,
      whatsappConsentBy: null,
    });
  });
});

describe("GET booths (daftar dan filter)", () => {
  it("memfilter menurut pemilik, kelengkapan, status, dan pencarian; terurut nama", async () => {
    const { h, base } = await setup();
    await h.call("POST", base, { name: "Zeta" });
    await h.call("POST", base, { name: "Alfa", email: "a@contoh.id", boothNo: "A1" });
    await h.call("POST", base, { name: "Beta", boothNo: "B2" });
    const names = async (qs: string) =>
      ((await h.call("GET", `${base}${qs}`)).json.booths as { name: string }[]).map((b) => b.name);

    expect(await names("")).toEqual(["Alfa", "Beta", "Zeta"]);
    expect(await names("?owner=none")).toEqual(["Beta", "Zeta"]);
    expect(await names("?owner=invited")).toEqual(["Alfa"]);
    expect(await names("?completeness=name_only")).toEqual(["Zeta"]);
    expect(await names("?completeness=partial")).toEqual(["Alfa", "Beta"]);
    expect(await names("?q=bet")).toEqual(["Beta"]);
    expect(await names("?q=b2")).toEqual(["Beta"]);
    expect(await names("?status=pending")).toEqual([]);
    expect((await h.call("GET", `${base}?owner=salah`)).status).toBe(400);
  });
});
