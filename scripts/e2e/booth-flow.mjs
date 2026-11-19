// E2E portal booth (Tahap 8) di Chrome sungguhan terhadap dev server (workerd + D1 lokal).
// Prasyarat: npm i --no-save puppeteer-core; .dev.vars berisi DEV_ADMIN_EMAIL; migrasi lokal sudah diterapkan.
// Jalankan:   npx vite --port 5197 --strictPort   lalu   node scripts/e2e/booth-flow.mjs
// Catatan: menyemai event BARU lalu mengaktifkannya. Kode OTP dibaca dari `devCode` (hanya ada di dev lokal).

import os from "node:os";
import path from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.env.E2E_BASE ?? "http://localhost:5197";
const OUT = process.env.E2E_OUT ?? os.tmpdir();
const IMAGE = path.resolve("demo-assets/p0.jpg");
const DAY = 86_400_000;
const STAMP = Date.now();
let failed = 0;
const check = (name, ok, extra = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  → ${extra}` : ""}`);
};

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--no-sandbox"],
});
const MOBILE = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const allErrors = [];

async function newPage(viewport, ip) {
  const ctx = await browser.createBrowserContext(); // cookie terpisah = akun berbeda
  const page = await ctx.newPage();
  await page.setViewport(viewport);
  if (ip) await page.setExtraHTTPHeaders({ "cf-connecting-ip": ip });
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404") && !m.text().includes("401") && !m.text().includes("Failed to load resource")) {
      allErrors.push(m.text());
    }
  });
  page.on("pageerror", (e) => allErrors.push(String(e)));
  return page;
}

const bodyText = (p) => p.evaluate(() => document.body.innerText);
const tap = async (h) => {
  await h.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await h.click();
};
const btn = async (p, label) => {
  const [h] = await p.$$(`xpath/.//button[normalize-space()="${label}"]`);
  if (!h) throw new Error(`Tombol "${label}" tidak ada`);
  return h;
};
const fill = async (p, labelText, value) => {
  const [h] = await p.$$(`xpath/.//label[contains(normalize-space(),"${labelText}")]/following::*[self::input or self::textarea][1]`);
  if (!h) throw new Error(`Isian "${labelText}" tidak ada`);
  await h.evaluate((el, v) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
};
const waitText = async (p, t, timeout = 15000) => {
  try {
    await p.waitForFunction((x) => document.body.innerText.includes(x), { timeout }, t);
  } catch (e) {
    // Bantu diagnosis: tangkapan layar + cuplikan teks halaman saat menunggu teks yang tak kunjung muncul.
    await p.screenshot({ path: path.join(OUT, "booth-e2e-timeout.png"), fullPage: true }).catch(() => {});
    console.log(`TIMEOUT menunggu "${t}". Teks halaman:
${(await bodyText(p)).slice(0, 600)}`);
    throw e;
  }
};
const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

// ---------- Penyemaian lewat API admin ----------
const admin = await newPage({ width: 800, height: 600 });
await admin.goto(`${BASE}/api/event`);
const adm = (method, url, body) =>
  admin.evaluate(
    async (m, u, b) => {
      const r = await fetch(u, {
        method: m,
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: b ? JSON.stringify(b) : undefined,
      });
      const t = await r.text();
      return { status: r.status, json: t ? JSON.parse(t) : null };
    },
    method,
    url,
    body,
  );
const times = (phase) => {
  const t = Date.now();
  const o = { live: [-3, -2, -1, 30], ended: [-4, -3, -2, -1] }[phase];
  return {
    registrationOpenAt: t + o[0] * DAY,
    registrationCloseAt: t + o[1] * DAY,
    eventStartAt: t + o[2] * DAY,
    eventEndAt: t + o[3] * DAY,
  };
};
const publicBoothNames = async () =>
  (await adm("GET", "/api/snapshot")).json.booths.map((b) => b.name);

const ev = await adm("POST", "/api/admin/events", { name: `Portal Booth E2E ${STAMP}`, titleHighlight: "Booth", ...times("live") });
const EID = ev.json.event.id;
const base = `/api/admin/e/${EID}/booths`;
const OWNER = `pemilik-${STAMP}@contoh.id`;
const A = (await adm("POST", base, { name: "Kopi Rempah Nusantara", boothNo: "A12", tagline: "Hangat di lidah", email: OWNER })).json.booth;
const B = (await adm("POST", base, { name: "Es Teh Pak Budi" })).json.booth;
check("Seed: event + booth berpemilik + booth tanpa pemilik", !!EID && !!A && !!B);
await adm("POST", `/api/admin/events/${EID}/activate`);

// ---------- 1. Masuk ke portal (booth buatan admin dengan email pemilik) ----------
const owner = await newPage(MOBILE, "10.1.0.1");
await owner.goto(`${BASE}/booth`, { waitUntil: "networkidle0" });
await waitText(owner, "Masuk ke portal booth");
check("Belum masuk: form masuk, tanpa bagian portal", !(await bodyText(owner)).includes("Profil booth"));
await fill(owner, "Email", OWNER);
await tap(await btn(owner, "Kirim kode"));
await waitText(owner, "Mode pengembangan: kode");
const code = (await bodyText(owner)).match(/kode (\d{6})/)?.[1];
check("OTP: kode dev tampil dan terisi otomatis", !!code && (await owner.$eval("input[autocomplete='one-time-code']", (i) => i.value)) === code, code);
await tap(await btn(owner, "Verifikasi"));
await waitText(owner, "Kopi Rempah Nusantara");
await waitText(owner, "Profil booth");
const home = await bodyText(owner);
check("Portal: status, ringkasan, ulasan, profil, WhatsApp, bagikan", ["Booth tayang", "Ringkasan penilaian", "Ulasan masuk", "Profil booth", "WhatsApp (opsional)", "Bagikan booth"].every((s) => home.includes(s)));
check("Mobile: tanpa gulir horizontal", (await overflow(owner)) <= 0, `${await overflow(owner)}px`);
check("QR booth tampil (SVG berlabel)", (await owner.$("svg[role='img'][aria-label='QR menuju halaman booth']")) !== null);
await owner.screenshot({ path: path.join(OUT, "booth-portal-mobile.png"), fullPage: true });

// ---------- 2. Edit profil ----------
await fill(owner, "Tagline", "Hangat di lidah, ringan di kantong");
await tap(await btn(owner, "Simpan profil"));
await waitText(owner, "Profil tersimpan.");
const afterSave = await adm("GET", `${base}/${A.id}`);
check("Profil tersimpan di server", afterSave.json.booth.tagline === "Hangat di lidah, ringan di kantong");
check("Tagline baru tampil di snapshot publik", (await adm("GET", "/api/snapshot")).json.booths.find((b) => b.id === A.id)?.tagline?.includes("ringan di kantong"));

// ---------- 3. Foto, produk, WhatsApp ----------
const fileInput = await owner.$('input[type="file"]');
await fileInput.uploadFile(IMAGE);
await owner.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent === "Unggah"), { timeout: 20000 });
await tap(await btn(owner, "Unggah"));
await owner.waitForFunction(() => document.querySelectorAll("img").length > 0, { timeout: 15000 });
const photos = await adm("GET", `${base}/${A.id}/photos`);
check("Foto diunggah dari portal (WebP di R2) dan tampil", photos.json.photos.length === 1);

await fill(owner, "Nama produk", "Kopi Rempah Susu");
await fill(owner, "Harga", "18000");
await owner.evaluate(() => {
  const cb = [...document.querySelectorAll("input[type=checkbox]")].find((c) => c.closest("label")?.textContent.includes("syarat") || c.closest("label")?.textContent.includes("Saya"));
  cb?.click();
});
const addBtn = await btn(owner, "Tambah produk");
await tap(addBtn);
await waitText(owner, "Kopi Rempah Susu");
const prods = await adm("GET", `${base}/${A.id}/products`);
check("Produk ditambah dari portal", prods.json.products.length === 1 && prods.json.products[0].priceIdr === 18000);

await fill(owner, "Nomor WhatsApp", "0812-3456-7890");
await owner.evaluate(() => [...document.querySelectorAll("input[type=checkbox]")].find((c) => c.closest("label")?.textContent.includes("menghubungi") || c.closest("label")?.textContent.includes("dihubungi"))?.click());
await tap(await btn(owner, "Simpan nomor"));
await waitText(owner, "Nomor tersimpan: 6281234567890");
check("WhatsApp: tersimpan dengan persetujuan pemilik", true);

// ---------- 4. Pemilik diubah admin → sesi lama ditolak ----------
await adm("PUT", `${base}/${A.id}/owner`, { email: `baru-${STAMP}@contoh.id`, reason: "uji ganti pemilik" });
await owner.reload({ waitUntil: "networkidle0" });
await waitText(owner, "Masuk ke portal booth");
check("owner_changed: sesi lama berakhir dan portal meminta masuk lagi", (await bodyText(owner)).includes("Pemilik booth ini sudah diubah panitia"));
await owner.screenshot({ path: path.join(OUT, "booth-owner-changed.png"), fullPage: true });

// ---------- 5. Pendaftaran mandiri → pending → disetujui ----------
const reg = await newPage(MOBILE, "10.1.0.2");
await reg.goto(`${BASE}/register`, { waitUntil: "networkidle0" });
await waitText(reg, "Daftarkan booth");
check("Pendaftaran: reguler sudah ditutup → catatan susulan", (await bodyText(reg)).includes("Pendaftaran reguler sudah ditutup"));
await fill(reg, "Email", `daftar-${STAMP}@contoh.id`);
await tap(await btn(reg, "Kirim kode"));
await waitText(reg, "Mode pengembangan: kode");
await tap(await btn(reg, "Verifikasi"));
await waitText(reg, "terverifikasi");
check("Profil baru muncul setelah email terverifikasi; hanya nama yang wajib", (await btn(reg, "Kirim pendaftaran").then((b) => b.evaluate((x) => x.disabled))) === true);
await fill(reg, "Nama booth", "Batik Nusa Sejahtera");
await tap(await btn(reg, "Kirim pendaftaran"));
await waitText(reg, "Menunggu verifikasi panitia");
await waitText(reg, "Booth kamu menunggu verifikasi panitia");
check("Terdaftar: portal menampilkan status menunggu + login otomatis", true);
check("Mobile: tanpa gulir horizontal (portal pending)", (await overflow(reg)) <= 0, `${await overflow(reg)}px`);
await reg.screenshot({ path: path.join(OUT, "booth-registered-pending.png"), fullPage: true });

check("Pending: TIDAK tampil di daftar publik", !(await publicBoothNames()).includes("Batik Nusa Sejahtera"));
const queue = (await adm("GET", `${base}?status=pending`)).json.booths;
const mine = queue.find((b) => b.name === "Batik Nusa Sejahtera");
check("Antrean admin: ada, ditandai susulan, dibuat sendiri", !!mine && mine.isLate === true && mine.createdBy === "self");

await adm("PATCH", `${base}/${mine.id}`, { status: "revision", rejectReason: "Tambahkan deskripsi booth", reason: "uji revisi" });
await reg.reload({ waitUntil: "networkidle0" });
await waitText(reg, "Perlu diperbaiki");
check("Revisi: catatan panitia tampil dan tombol kirim ulang ada", (await bodyText(reg)).includes("Tambahkan deskripsi booth"));
await fill(reg, "Deskripsi singkat", "Batik tulis karya mahasiswa");
await tap(await btn(reg, "Simpan profil"));
await waitText(reg, "Profil tersimpan.");
await tap(await btn(reg, "Kirim ulang untuk diperiksa"));
await waitText(reg, "Menunggu verifikasi panitia");
check("Kirim ulang: kembali menunggu verifikasi", true);

await adm("PATCH", `${base}/${mine.id}`, { status: "approved", reason: "uji setuju" });
check("Disetujui: tampil di daftar publik", (await publicBoothNames()).includes("Batik Nusa Sejahtera"));
await reg.reload({ waitUntil: "networkidle0" });
await waitText(reg, "Booth tayang");

// ---------- 6. Event selesai: hanya-baca ----------
await adm("PUT", `/api/admin/events/${EID}`, times("ended"));
await reg.reload({ waitUntil: "networkidle0" });
await waitText(reg, "hanya bisa dibaca").catch(() => {});
const ended = await bodyText(reg);
check("Event selesai: banner hanya-baca", ended.includes("Event sudah selesai") || ended.includes("hanya-baca") || ended.includes("hanya bisa dibaca"));
const nameDisabled = await reg.evaluate(() => {
  const l = [...document.querySelectorAll("label")].find((x) => x.textContent.includes("Nama booth"));
  const i = l?.parentElement?.querySelector("input");
  return i?.matches(":disabled");
});
check("Event selesai: isian profil dikunci", nameDisabled === true);
const write = await reg.evaluate(async () => {
  const r = await fetch("/api/booth/me", { method: "PUT", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ tagline: "terlambat" }) });
  return { status: r.status, body: await r.json() };
});
check("Event selesai: server menolak penulisan (403 event_ended)", write.status === 403 && write.body.code === "event_ended");
const lateReg = await newPage(MOBILE, "10.1.0.3");
await lateReg.goto(`${BASE}/register`, { waitUntil: "networkidle0" });
await waitText(lateReg, "Acara sudah selesai");
check("Event selesai: pendaftaran tidak dibuka lagi", true);

check("Tanpa galat konsol/JS", allErrors.length === 0, allErrors.slice(0, 3).join(" | "));
await browser.close();
console.log(failed === 0 ? "\nSEMUA LULUS" : `\n${failed} PEMERIKSAAN GAGAL`);
console.log("Tangkapan layar:", OUT);
process.exit(failed === 0 ? 0 : 1);
