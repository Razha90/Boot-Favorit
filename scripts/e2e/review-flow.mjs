// E2E alur penilaian (Tahap 6) di Chrome sungguhan, viewport HP, terhadap dev server (workerd + D1 lokal).
// Prasyarat: npm i --no-save puppeteer-core; .dev.vars berisi DEV_ADMIN_EMAIL; migrasi lokal sudah diterapkan.
// Jalankan:   npx vite --port 5197 --strictPort   lalu   node scripts/e2e/review-flow.mjs
// Catatan: menyemai event BARU lalu mengaktifkannya. Kode OTP dibaca dari `devCode` (hanya ada di dev lokal).

import os from "node:os";
import path from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.env.E2E_BASE ?? "http://localhost:5197";
const OUT = process.env.E2E_OUT ?? os.tmpdir();
const DAY = 86_400_000;
const TITLE = `Penilaian Booth E2E ${Date.now()}`;
let failed = 0;
const check = (name, ok, extra = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  → ${extra}` : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--no-sandbox"],
});
const MOBILE = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const allErrors = [];

async function newPage(viewport, ip) {
  const ctx = await browser.createBrowserContext(); // cookie terpisah = pengunjung berbeda
  const page = await ctx.newPage();
  await page.setViewport(viewport);
  // Tiap pengunjung punya "IP" sendiri: pembatas login per-IP di dev jatuh ke satu kunci bila header tak ada.
  if (ip) await page.setExtraHTTPHeaders({ "cf-connecting-ip": ip });
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404") && !m.text().includes("Failed to load resource")) {
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
const btn = async (p, label, exact = true) => {
  const sel = exact ? `normalize-space()="${label}"` : `contains(normalize-space(),"${label}")`;
  const [h] = await p.$$(`xpath/.//button[${sel}]`);
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
const waitText = (p, t, timeout = 15000) =>
  p.waitForFunction((x) => document.body.innerText.includes(x), { timeout }, t);
const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

// ---------- Penyemaian lewat API admin ----------
const seedPage = await newPage({ width: 800, height: 600 });
await seedPage.goto(`${BASE}/api/event`);
const adm = (method, url, body) =>
  seedPage.evaluate(
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
  const o = {
    live: [-3, -2, -1, 30],
    ended: [-4, -3, -2, -1],
  }[phase];
  return {
    registrationOpenAt: t + o[0] * DAY,
    registrationCloseAt: t + o[1] * DAY,
    eventStartAt: t + o[2] * DAY,
    eventEndAt: t + o[3] * DAY,
  };
};

const ev = await adm("POST", "/api/admin/events", { name: TITLE, titleHighlight: "Booth", ...times("live") });
const EID = ev.json.event.id;
const base = `/api/admin/e/${EID}/booths`;
const A = (await adm("POST", base, { name: "Kopi Rempah Nusantara", boothNo: "A12", tagline: "Hangat di lidah" })).json.booth;
const B = (await adm("POST", base, { name: "Es Teh Pak Budi" })).json.booth;
const C = (await adm("POST", base, { name: "Roti Bakar Mas Agus", boothNo: "C3" })).json.booth;
check("Seed: event + 3 booth", !!EID && !!A && !!B && !!C);
await adm("POST", `/api/admin/events/${EID}/activate`);
const url = (b) => `${BASE}/b/${b.id}`;

// ---------- 1. Masuk lewat email OTP ----------
const ani = await newPage(MOBILE, "10.0.0.1");
await ani.goto(url(B), { waitUntil: "networkidle0" });
await waitText(ani, "Masuk dulu, yuk");
check("Belum masuk: kotak masuk tampil, tanpa form bintang", !(await bodyText(ani)).includes("Berapa bintang buat booth ini?"));
await fill(ani, "Email kamu", "ani@contoh.id");
await tap(await btn(ani, "Kirim kode"));
await waitText(ani, "Mode lokal: kodenya");
const devHint = (await bodyText(ani)).match(/kodenya (\d{6})/)?.[1];
check("OTP: kode dev tampil dan terisi otomatis", !!devHint && (await ani.$eval("input[autocomplete='one-time-code']", (i) => i.value)) === devHint, devHint);
await fill(ani, "Nama panggilan", "Ani");
await tap(await btn(ani, "Masuk"));
await waitText(ani, "Masuk sebagai Ani");
await waitText(ani, "Berapa bintang buat booth ini?"); // form memuat ulasan lama dulu (kerangka sesaat)
check("Masuk: 'Masuk sebagai Ani' + form penilaian", true);
check("Mobile: tanpa gulir horizontal (form)", (await overflow(ani)) <= 0, `${await overflow(ani)}px`);
await ani.screenshot({ path: path.join(OUT, "review-form-mobile.png"), fullPage: true });

// ---------- 2. Kirim review ----------
check("Tombol kirim mati sebelum bintang dipilih", await (await btn(ani, "Kirim penilaian")).evaluate((b) => b.disabled));
await tap(await ani.$("button[role='radio'][aria-label='5 dari 5 bintang']"));
const [seru] = await ani.$$(`xpath/.//button[@aria-pressed][normalize-space()="Seru"]`);
await tap(seru);
await fill(ani, "Cerita singkat", "Es tehnya segar, penjualnya ramah banget!");
await tap(await btn(ani, "Kirim penilaian"));
await waitText(ani, "Makasih banyak!");
const thanks = await bodyText(ani);
check("Terima kasih: kemajuan 1 dari 3 booth + saran booth lain", thanks.includes("Kamu sudah menilai 1 dari 3 booth.") && thanks.includes("Kopi Rempah Nusantara"));
await ani.screenshot({ path: path.join(OUT, "review-thanks-mobile.png"), fullPage: true });

// ---------- 3. Tampil di halaman, sesi bertahan, edit ----------
await ani.goto(url(B), { waitUntil: "networkidle0" });
await waitText(ani, "Masuk sebagai Ani");
const page1 = await bodyText(ani);
check("Sesi bertahan setelah reload; form berlabel 'Perbarui penilaian' dan terisi", page1.includes("Perbarui penilaian") && (await ani.$eval("textarea", (t) => t.value)).includes("Es tehnya segar"));
check("Ulasan tampil di daftar dengan nama depan + kategori", page1.includes("Es tehnya segar, penjualnya ramah banget!") && page1.includes("Seru"));
check("'Sering disebut: Seru (1)'", page1.includes("Sering disebut: Seru (1)"));
check("Rating booth: 1 ulasan", page1.includes("(1)") || page1.includes("1 ulasan"));

await tap(await ani.$("button[role='radio'][aria-label='3 dari 5 bintang']"));
await tap(await btn(ani, "Perbarui penilaian"));
await waitText(ani, "Makasih banyak!");
await ani.goto(url(B), { waitUntil: "networkidle0" });
await waitText(ani, "Masuk sebagai Ani");
const detail = await ani.evaluate(async (id) => (await (await fetch(`/api/booths/${id}`)).json()).booth, B.id);
check("Edit = menimpa (tetap 1 ulasan), rata-rata 3", detail.ratingCount === 1 && detail.ratingAverage === 3, `count=${detail.ratingCount} avg=${detail.ratingAverage}`);

// ---------- 4. Filter kata ----------
const budi = await newPage(MOBILE, "10.0.0.2");
await budi.goto(url(B), { waitUntil: "networkidle0" });
await fill(budi, "Email kamu", "budi@contoh.id");
await tap(await btn(budi, "Kirim kode"));
await waitText(budi, "Mode lokal: kodenya");
await tap(await btn(budi, "Masuk"));
await waitText(budi, "Berapa bintang buat booth ini?");
await tap(await budi.$("button[role='radio'][aria-label='1 dari 5 bintang']"));
await fill(budi, "Cerita singkat", "dasar bangsat, jelek banget");
await tap(await btn(budi, "Kirim penilaian"));
await waitText(budi, "Makasih banyak!");
check("Komentar berat: pesan netral 'kami periksa dulu', tanpa menyebut kata", (await bodyText(budi)).includes("Komentarnya kami periksa dulu sebelum tampil.") && !(await bodyText(budi)).match(/filter|kata kasar|terlarang/i));

const citra = await newPage(MOBILE, "10.0.0.3");
await citra.goto(url(B), { waitUntil: "networkidle0" });
await fill(citra, "Email kamu", "citra@contoh.id");
await tap(await btn(citra, "Kirim kode"));
await waitText(citra, "Mode lokal: kodenya");
await fill(citra, "Nama panggilan", "Citra");
await tap(await btn(citra, "Masuk"));
await waitText(citra, "Berapa bintang buat booth ini?");
await tap(await citra.$("button[role='radio'][aria-label='4 dari 5 bintang']"));
await fill(citra, "Cerita singkat", "tehnya enak tapi antrean anjir lama");
await tap(await btn(citra, "Kirim penilaian"));
await waitText(citra, "Makasih banyak!");

const pub = new (class {})();
const publicPage = await newPage(MOBILE, "10.0.0.9");
await publicPage.goto(url(B), { waitUntil: "networkidle0" });
await waitText(publicPage, "Es tehnya segar");
const pubText = await bodyText(publicPage);
check("Komentar berat TIDAK tampil di halaman publik", !pubText.includes("bangsat") && !pubText.includes("jelek banget"));
check("Komentar ringan tampil DISAMARKAN", pubText.includes("a***r") && !pubText.includes("anjir"));
const api = await publicPage.evaluate(async (id) => (await (await fetch(`/api/booths/${id}`)).json()).booth, B.id);
check("Bintang komentar yang ditahan tetap terhitung (3 ulasan)", api.ratingCount === 3, `count=${api.ratingCount}`);
const rawReviews = await publicPage.evaluate(async (id) => (await fetch(`/api/booths/${id}/reviews`)).text(), B.id);
check("JSON publik tidak memuat komentar yang ditahan", !rawReviews.includes("bangsat"));
void pub;

// ---------- 5. Laporan ----------
await ani.goto(url(B), { waitUntil: "networkidle0" });
await waitText(ani, "a***r");
const reportBtns = await ani.$$(`xpath/.//button[normalize-space()="Laporkan"]`);
check("Tombol 'Laporkan' ada pada ulasan orang lain", reportBtns.length >= 1);
// laporkan ulasan Citra (yang disamarkan)
const citraCard = await ani.evaluateHandle(() => [...document.querySelectorAll("article")].find((a) => a.innerText.includes("a***r")));
const [lapor] = await citraCard.asElement().$$(`xpath/.//button[normalize-space()="Laporkan"]`);
await tap(lapor);
await ani.waitForSelector("dialog[open]");
const [alasan] = await ani.$$(`xpath/.//dialog//button[normalize-space()="Kata kasar atau tidak pantas"]`);
await alasan.click();
await ani.evaluate(() => [...document.querySelectorAll("dialog[open] button")].find((b) => b.innerText.trim() === "Kirim laporan")?.click());
await waitText(ani, "Makasih, laporanmu kami terima.");
check("Laporan terkirim; ulasan TETAP tayang (laporan tidak menyembunyikan)", (await bodyText(ani)).includes("a***r"));

// ---------- 6. Admin memutuskan ----------
const admin = await newPage({ width: 1280, height: 900 });
await admin.goto(`${BASE}/admin/e/${EID}/moderation`, { waitUntil: "networkidle0" });
await waitText(admin, "Antrean laporan (1)");
check("Admin: antrean berisi laporan + teks asli", (await bodyText(admin)).includes("tehnya enak tapi antrean anjir lama"));
check("Admin: tab 'Ditahan' (1)", (await bodyText(admin)).includes("Ditahan (1)"));
const reasonBtn = await admin.$(`xpath/.//button[normalize-space()="Sembunyikan komentar"]`);
check("Aksi mati sampai alasan diisi", await reasonBtn.evaluate((b) => b.disabled));
await fill(admin, "Alasan", "umpatan, sesuai laporan");
await tap(await btn(admin, "Sembunyikan komentar"));
await waitText(admin, "Tidak ada laporan yang menunggu");
await admin.screenshot({ path: path.join(OUT, "review-admin-queue.png") });
await publicPage.goto(url(B), { waitUntil: "networkidle0" });
await waitText(publicPage, "Es tehnya segar");
check("Setelah diputuskan: komentar tersembunyi dari publik", !(await bodyText(publicPage)).includes("a***r"));
const after = await publicPage.evaluate(async (id) => (await (await fetch(`/api/booths/${id}`)).json()).booth, B.id);
check("Bintang tetap terhitung setelah komentar disembunyikan", after.ratingCount === 3, `count=${after.ratingCount}`);

// tab Ditahan: setujui komentar Budi
await tap(await btn(admin, "Ditahan", false));
await waitText(admin, "dasar bangsat, jelek banget");
check("Admin melihat TEKS ASLI komentar yang ditahan + sinyal", (await bodyText(admin)).includes("Teks asli"));
await fill(admin, "Alasan", "ternyata konteksnya wajar");
await tap(await btn(admin, "Setujui / pulihkan"));
await waitText(admin, "Tidak ada komentar yang ditahan");
check("Admin: komentar ditahan disetujui dan keluar dari daftar", true);

// tab Daftar kata: uji kalimat + tambah istilah
await tap(await btn(admin, "Daftar kata"));
await waitText(admin, "Uji kalimat");
await fill(admin, "Uji kalimat", "booth ini payah banget");
await tap(await btn(admin, "Uji"));
await waitText(admin, "Lolos · tayang apa adanya");
await fill(admin, "Istilah", "payah");
await fill(admin, "Alasan", "sering dipakai menghina");
await tap(await btn(admin, "Tambah istilah"));
await sleep(800);
await fill(admin, "Uji kalimat", "booth ini payah banget");
await tap(await btn(admin, "Uji"));
await waitText(admin, "Tayang disamarkan");
check("Daftar kata: istilah baru langsung berlaku (tanpa deploy)", (await bodyText(admin)).includes("Tertangkap: payah"));
await admin.screenshot({ path: path.join(OUT, "review-admin-terms.png") });

// ---------- 7. Booth menilai diri sendiri ----------
await adm("PUT", `${base}/${B.id}/owner`, { email: "pemilik@teh.id" });
const owner = await newPage(MOBILE, "10.0.0.7");
await owner.goto(url(B), { waitUntil: "networkidle0" });
await fill(owner, "Email kamu", "pemilik@teh.id");
await tap(await btn(owner, "Kirim kode"));
await waitText(owner, "Mode lokal: kodenya");
await tap(await btn(owner, "Masuk"));
await waitText(owner, "Berapa bintang buat booth ini?");
await tap(await owner.$("button[role='radio'][aria-label='5 dari 5 bintang']"));
await tap(await btn(owner, "Kirim penilaian"));
await waitText(owner, "Kamu nggak bisa menilai booth sendiri.");
check("Booth tidak bisa menilai dirinya sendiri (pesan jelas)", true);

// ---------- 8. Event selesai: hanya-baca ----------
const t = times("ended");
await adm("PUT", `/api/admin/events/${EID}`, t);
await ani.goto(url(B), { waitUntil: "networkidle0" });
await waitText(ani, "Penilaian udah ditutup");
const end = await bodyText(ani);
check("Selesai: tanpa form/masuk, ada 'ditutup'; tombol lapor hilang", !end.includes("Berapa bintang") && !end.includes("Masuk dulu") && (await ani.$$(`xpath/.//button[normalize-space()="Laporkan"]`)).length === 0);
const late = await ani.evaluate(async (id) => {
  const r = await fetch(`/api/booths/${id}/review`, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ stars: 1 }) });
  return { status: r.status, code: (await r.json()).code };
}, B.id);
check("Selesai: API menolak review baru (403 event_ended)", late.status === 403 && late.code === "event_ended", JSON.stringify(late));
check("Selesai: ulasan lama tetap terbaca", end.includes("Es tehnya segar"));
await ani.screenshot({ path: path.join(OUT, "review-booth-ended.png"), fullPage: true });

check("Tanpa galat konsol/JS di seluruh alur", allErrors.length === 0, allErrors.slice(0, 3).join(" | "));
await browser.close();
console.log(failed === 0 ? "\nSEMUA LULUS" : `\n${failed} PEMERIKSAAN GAGAL`);
console.log(`Tangkapan layar: ${OUT}`);
process.exit(failed === 0 ? 0 : 1);
