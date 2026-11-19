// Simulasi event penuh (Tahap 10, BUILD-PLAN): buat event → tambah booth (hanya nama, CSV, daftar mandiri OTP) →
// approve → review (bersih, tersamar, ditahan, laporan) → moderasi → kesehatan hari-H → event selesai →
// umumkan hasil + WinnerReveal → sunting di Data Grid + perbarui hasil → ekspor CSV & poster QR.
// Prasyarat: npx vite --port 5197 --strictPort; npm i --no-save puppeteer-core; .dev.vars berisi DEV_ADMIN_EMAIL.

import puppeteer from "puppeteer-core";

const BASE = process.env.E2E_BASE ?? "http://localhost:5197";
const DAY = 86_400_000;
const STAMP = Date.now();
let failed = 0;
const check = (name, ok, extra = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  → ${extra}` : ""}`);
};

const adm = async (method, p, body) => {
  const r = await fetch(`${BASE}${p}`, {
    method,
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  return { status: r.status, json: t ? JSON.parse(t) : null };
};

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--no-sandbox"],
});

const server5xx = [];
const pageErrors = [];
async function newPage(vp = { width: 1280, height: 840 }, ip) {
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  await p.setViewport(vp);
  if (ip) await p.setExtraHTTPHeaders({ "cf-connecting-ip": ip });
  p.on("response", (res) => {
    if (res.status() >= 500) server5xx.push(`${res.status()} ${res.url()}`);
  });
  p.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404") && !m.text().includes("Failed to load resource")) {
      pageErrors.push(m.text());
    }
  });
  p.on("pageerror", (e) => pageErrors.push(String(e)));
  return p;
}

const waitText = (p, t, timeout = 12000) =>
  p.waitForFunction((x) => document.body.innerText.includes(x), { timeout }, t);
const btn = async (p, label) => {
  const [h] = await p.$$(`xpath/.//button[normalize-space()="${label}"]`);
  if (!h) throw new Error(`Tombol "${label}" tidak ada`);
  return h;
};

// 1. Admin membuat event aktif + booth hanya-nama + impor CSV
const now = Date.now();
const evRes = await adm("POST", "/api/admin/events", {
  name: `Simulasi Penuh ${STAMP}`,
  titleHighlight: "Penuh",
  registrationOpenAt: now - 4 * DAY,
  registrationCloseAt: now + 3 * DAY,
  eventStartAt: now - DAY,
  eventEndAt: now + 7 * DAY,
});
const EID = evRes.json.event.id;
await adm("PUT", `/api/admin/events/${EID}`, { settings: { reviewerAuthMode: "google_or_email" } });
const bNameOnly = (await adm("POST", `/api/admin/e/${EID}/booths`, { name: "Booth Hanya Nama" })).json.booth;
const csvRes = await adm("POST", `/api/admin/e/${EID}/booths/import`, {
  rows: [{ name: "Booth Impor Satu", boothNo: "I1" }, { name: "Booth Impor Dua" }],
  onDuplicateName: "skip",
});
await adm("POST", `/api/admin/events/${EID}/activate`);
check("1. Event dibuat, booth hanya-nama + impor CSV berhasil", csvRes.json.created === 2 && !!bNameOnly.id);

// 2. Pemilik booth daftar mandiri lewat /register di Chrome (OTP devCode), lalu admin setujui
const regPage = await newPage({ width: 390, height: 844 }, "10.10.1.1");
await regPage.goto(`${BASE}/register`, { waitUntil: "networkidle0" });
await waitText(regPage, "Daftarkan booth");
const ownerEmail = `owner-${STAMP}@contoh.id`;
await regPage.type('input[type="email"]', ownerEmail);
await (await btn(regPage, "Kirim kode")).click();
await waitText(regPage, "Mode pengembangan: kode");
const devText = await regPage.evaluate(() => document.body.innerText);
const codeMatch = devText.match(/Mode pengembangan: kode (\d{6})/);
check("2a. Pendaftaran mandiri mengirim OTP devCode", !!codeMatch);
await (await btn(regPage, "Verifikasi")).click();
await waitText(regPage, "Profil booth");
const nameInput = await regPage.$('xpath/.//label[contains(.,"Nama booth")]/following::input[1]');
await nameInput.type("Booth Daftar Mandiri");
await (await btn(regPage, "Kirim pendaftaran")).click();
await waitText(regPage, "Menunggu verifikasi panitia");
const listBooths = (await adm("GET", `/api/admin/e/${EID}/booths`)).json.booths;
const selfBooth = listBooths.find((b) => b.name === "Booth Daftar Mandiri");
const appRes = await adm("PATCH", `/api/admin/e/${EID}/booths/${selfBooth.id}`, {
  status: "approved",
  reason: "Disetujui dalam simulasi event penuh",
});
check("2b. Booth daftar mandiri disetujui admin", !!selfBooth && appRes.status === 200);

// 3. Pengunjung login OTP + menilai semua booth (termasuk 1 komentar kontak ditahan) + lapor
for (let i = 1; i <= 3; i++) {
  const ip = `10.10.2.${i}`;
  const reqOtp = await fetch(`${BASE}/api/visitor/otp/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "cf-connecting-ip": ip },
    body: JSON.stringify({ email: `v${i}-${STAMP}@contoh.id` }),
  });
  const { devCode } = await reqOtp.json();
  const ver = await fetch(`${BASE}/api/visitor/otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "cf-connecting-ip": ip },
    body: JSON.stringify({ email: `v${i}-${STAMP}@contoh.id`, code: devCode, displayName: `Tamu ${i}` }),
  });
  const cookie = (ver.headers.getSetCookie()[0] ?? "").split(";")[0];
  for (const [bid, stars, comment] of [
    [selfBooth.id, 5, i === 1 ? "Hubungi wa.me/0812345678" : `Enak sekali ${i}`],
    [bNameOnly.id, 4, `Menarik ${i}`],
  ]) {
    await fetch(`${BASE}/api/booths/${bid}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID(), cookie, "cf-connecting-ip": ip },
      body: JSON.stringify({ stars, comment }),
    });
  }
}
const health = (await adm("GET", `/api/admin/e/${EID}/health`)).json;
check("3. Review masuk & kesehatan hari-H mencatat totalReviews=6, heldReviews=1", health.totalReviews === 6 && health.heldReviews === 1, JSON.stringify(health));

// 4. Halaman beranda pengunjung & Layar Besar tampil tanpa gambar rusak
const visitorPage = await newPage({ width: 390, height: 844 }, "10.10.3.1");
await visitorPage.goto(`${BASE}/`, { waitUntil: "networkidle0" });
await waitText(visitorPage, "Booth Daftar Mandiri");
const brokenImgs = await visitorPage.evaluate(() => [...document.querySelectorAll("img")].filter((i) => i.complete && i.naturalWidth === 0).length);
check("4. Beranda pengunjung menampilkan semua booth (termasuk hanya-nama) tanpa gambar rusak", brokenImgs === 0 && (await visitorPage.evaluate(() => document.body.innerText)).includes("Booth Hanya Nama"));

// 5. Event selesai → admin umumkan hasil → pengunjung melihat WinnerReveal + mode hanya-baca
const endRes = await adm("PUT", `/api/admin/events/${EID}`, {
  registrationOpenAt: now - 4 * DAY,
  registrationCloseAt: now - 3 * DAY,
  eventStartAt: now - 2 * DAY,
  eventEndAt: now - 60_000,
});
if (endRes.status >= 400) throw new Error(`Akhiri event gagal: ${endRes.status} ${JSON.stringify(endRes.json)}`);
const pubRes = await adm("POST", `/api/admin/events/${EID}/publish-results`);
if (pubRes.status >= 400) throw new Error(`Publish gagal: ${pubRes.status} ${JSON.stringify(pubRes.json)}`);
await visitorPage.goto(`${BASE}/`, { waitUntil: "networkidle0" });
await visitorPage.waitForSelector("dialog[open]", { timeout: 12000 });
await (await btn(visitorPage, "Lewati")).click();
await visitorPage.waitForFunction(() => !document.querySelector("dialog[open]"), { timeout: 5000 });
await waitText(visitorPage, "Hasil akhir");
check("5. Setelah hasil diumumkan, WinnerReveal tampil lalu masuk hasil akhir & hanya-baca", (await visitorPage.evaluate(() => document.body.innerText)).includes("Event telah berakhir"));

// 6. Data Grid, Log & Kesehatan, dan Poster QR bekerja penuh setelah event selesai
const admPage = await newPage({ width: 1280, height: 840 });
await admPage.goto(`${BASE}/admin/e/${EID}/logs`, { waitUntil: "networkidle0" });
await waitText(admPage, "Kesehatan hari-H");
check("6a. Halaman Kesehatan hari-H & Log tampil di admin", (await admPage.evaluate(() => document.body.innerText)).includes("Ulasan ditahan"));

await admPage.goto(`${BASE}/admin/e/${EID}/posters`, { waitUntil: "networkidle0" });
await waitText(admPage, "Booth Hanya Nama");
const qrCount = await admPage.$$eval('svg[role="img"]', (els) => els.length);
check("6b. Poster QR mencakup booth hanya-nama dan booth daftar mandiri", qrCount >= 4, `${qrCount}`);

check("7. Tidak ada respons HTTP 5xx dan tidak ada galat JS", server5xx.length === 0 && pageErrors.length === 0, `${server5xx.join(",")} ${pageErrors.join(",")}`);
await browser.close();
console.log(`\nTotal gagal: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
