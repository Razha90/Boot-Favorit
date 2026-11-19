// E2E Data Grid, Log, Poster QR, dan Ekspor Hasil (Tahap 9) di Chrome sungguhan terhadap dev server.
// Prasyarat: npm i --no-save puppeteer-core; .dev.vars berisi DEV_ADMIN_EMAIL; migrasi lokal sudah diterapkan.
// Jalankan:   npx vite --port 5197 --strictPort   lalu   node scripts/e2e/data-flow.mjs
// Catatan: menyemai event berstatus SELESAI dan mengaktifkannya untuk membuktikan Data Grid berfungsi penuh setelah event selesai.

import os from "node:os";
import path from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.env.E2E_BASE ?? "http://localhost:5197";
const OUT = process.env.E2E_OUT ?? os.tmpdir();
const DAY = 86_400_000;
const STAMP = Date.now();
let failed = 0;
const check = (name, ok, extra = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  → ${extra}` : ""}`);
};

// ---------- Penyemaian via API (node fetch) ----------
const adm = async (method, p, body) => {
  const r = await fetch(`${BASE}${p}`, {
    method,
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  return { status: r.status, json: t ? JSON.parse(t) : null };
};

const now = Date.now();
// Awalnya live sebentar agar pengunjung bisa mengirim review, lalu langsung diakhiri (phase: "ended").
const ev = await adm("POST", "/api/admin/events", {
  name: `Data Grid E2E ${STAMP}`,
  titleHighlight: "Grid",
  registrationOpenAt: now - 5 * DAY,
  registrationCloseAt: now - 3 * DAY,
  eventStartAt: now - 2 * DAY,
  eventEndAt: now + DAY,
});
const EID = ev.json.event.id;
await adm("PUT", `/api/admin/events/${EID}`, { settings: { reviewerAuthMode: "open_turnstile" } });
await adm("POST", `/api/admin/events/${EID}/activate`);

const mkBooth = async (name, no, status = "approved") => {
  const b = (await adm("POST", `/api/admin/e/${EID}/booths`, { name, boothNo: no })).json.booth;
  if (status !== "approved") {
    await adm("PATCH", `/api/admin/e/${EID}/booths/${b.id}`, { status });
  }
  return b;
};

const A = await mkBooth("Booth Alpha", "A1");
const B = await mkBooth("Booth Beta", "B1");
const C = await mkBooth("Booth Gamma", "C1", "pending");

const prod = await adm("POST", `/api/admin/e/${EID}/booths/${A.id}/products`, {
  name: "Es Kopi Susu",
  priceIdr: 15000,
  termsConfirmed: true,
});
if (prod.status >= 400) throw new Error(`Seed produk gagal: ${prod.status} ${JSON.stringify(prod.json)}`);

let vSeq = 0;
async function addReview(boothId, stars, comment) {
  const i = ++vSeq;
  const ip = `10.9.${i >> 8}.${i & 255}`;
  const login = await fetch(`${BASE}/api/visitor/anonymous`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "cf-connecting-ip": ip },
    body: JSON.stringify({ displayName: `Penguji${i}` }),
  });
  const cookie = (login.headers.getSetCookie()[0] ?? "").split(";")[0];
  await fetch(`${BASE}/api/booths/${boothId}/review`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
      cookie,
      "cf-connecting-ip": ip,
    },
    body: JSON.stringify({ stars, comment }),
  });
}

for (let i = 0; i < 3; i++) await addReview(A.id, 5, `Review Alpha ${i + 1}`);
for (let i = 0; i < 3; i++) await addReview(B.id, 4, `Review Beta ${i + 1}`);

// Akhiri event supaya teruji Data Grid berfungsi penuh setelah event selesai (BUILD-PLAN Tahap 9)
await adm("PUT", `/api/admin/events/${EID}`, { eventEndAt: now - 60_000 });
check("Seed: event selesai + 3 booth + produk + 6 review", !!EID && !!A && !!B && !!C);

// ---------- Browser ----------
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--no-sandbox"],
});
const errors = [];
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 860 });
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().includes("404") && !m.text().includes("Failed to load resource")) {
    errors.push(m.text());
    console.log("CONSOLE_ERR:", m.text());
  }
});
page.on("pageerror", (e) => {
  errors.push(String(e));
  console.log("PAGE_ERR:", String(e));
});

const bodyText = () => page.evaluate(() => document.body.innerText);
const waitText = async (t, timeout = 12000) => {
  try {
    await page.waitForFunction((x) => document.body.innerText.includes(x), { timeout }, t);
  } catch (e) {
    await page.screenshot({ path: path.join(OUT, "data-e2e-timeout.png"), fullPage: true }).catch(() => {});
    console.log(`TIMEOUT "${t}". Teks:\n${(await bodyText()).slice(0, 800)}`);
    throw e;
  }
};
const btn = async (label) => {
  const [h] = await page.$$(`xpath/.//button[normalize-space()="${label}"]`);
  if (!h) throw new Error(`Tombol "${label}" tidak ditemukan`);
  return h;
};

// ---------- 1. Halaman Event Admin: tautan navigasi + Ekspor Hasil CSV ----------
await page.goto(`${BASE}/admin/e/${EID}`, { waitUntil: "networkidle0" });
await waitText("Data Grid");
const navText = await bodyText();
check("Halaman event admin punya tautan Data Grid, Log aktivitas, Poster QR", navText.includes("Data Grid") && navText.includes("Log aktivitas") && navText.includes("Poster QR"));
check("ResultsCard menampilkan tombol Ekspor hasil CSV", navText.includes("Ekspor hasil CSV"));

// ---------- 2. Data Grid (/admin/e/:id/data) setelah event selesai ----------
await page.click(`a[href="/admin/e/${EID}/data"]`);
await page.waitForSelector('input[aria-label="Cari cepat"]', { timeout: 10000 }).catch(async (e) => {
  console.log("URL:", page.url(), "BODY:", (await bodyText()).slice(0, 800));
  throw e;
});
await waitText("Booth Gamma");
check("Data Grid terbuka setelah event selesai", (await bodyText()).includes("Booth Gamma"));

// Ekspor CSV server
const csvCheck = await page.evaluate(async () => {
  const a = document.querySelector('a[href*="/export"]');
  if (!a) return { ok: false };
  const r = await fetch(a.getAttribute("href"));
  const text = await r.text();
  return { ok: r.status === 200 && text.includes("Booth Alpha"), ct: r.headers.get("content-type") };
});
check("Ekspor CSV Data Grid mengembalikan 200 + isi booth", csvCheck.ok, csvCheck.ct);

// "+ Booth" langsung membuat booth
await (await btn("+ Booth")).click();
await page.type('input[aria-label="+ Booth"]', "Booth Instan E2E");
await (await btn("Tambah")).click();
await waitText("Booth Instan E2E");
check("+ Booth langsung membuat booth baru", true);

// Aksi massal: pilih Booth Gamma (pending) → Setujui → dialog Simpan dengan alasan
const gammaCb = await page.$('input[type="checkbox"][aria-label="Pilih Booth Gamma"]');
await gammaCb.click();
await (await btn("Setujui")).click();
await waitText("1 perubahan belum disimpan");
await (await btn("Simpan…")).click();
await waitText("Simpan perubahan");
await page.type("dialog textarea", "Disetujui lewat uji E2E");
await page.click('dialog button[type="button"].bg-primary');
await page.waitForFunction(() => !document.body.innerText.includes("1 perubahan belum disimpan"), { timeout: 10000 });
check("Simpan massal menyetujui Booth Gamma + alasan wajib", true);

// Tab Produk, Pengunjung, Peringkat
await (await btn("Produk")).click();
await waitText("Es Kopi Susu");
check("Tab Produk menampilkan Es Kopi Susu", true);

await (await btn("Pengunjung")).click();
await waitText("Penguji1");
check("Tab Pengunjung menampilkan Penguji1", true);

await (await btn("Peringkat")).click();
await waitText("Booth Alpha");
check("Tab Peringkat menampilkan Booth Alpha", true);

// Tab Review: sunting bintang review Alpha sehingga peringkat berubah + cek pratinjau dampak peringkat
await (await btn("Review")).click();
await waitText("Review Alpha 1");
const starButtons = await page.$$('xpath/.//tr[contains(., "Booth Alpha")]//button[contains(., "★ 5")]');
check("Review Alpha tampil dengan bintang 5", starButtons.length >= 3, `${starButtons.length}`);
// Buka sel bintang review Alpha (Enter pada sel fokus) dan ubah dari 5 → 1 agar rata-rata Alpha turun di bawah Beta
for (let k = 0; k < 2; k++) {
  const [sb] = await page.$$('xpath/.//tr[contains(., "Booth Alpha")]//button[contains(., "★ 5")]');
  await sb.evaluate((el) => el.scrollIntoView({ block: "center", inline: "center" }));
  await sb.click();
  await page.keyboard.press("Enter");
  await page.waitForSelector('fieldset [role="radio"]');
  const [oneStar] = await page.$$('fieldset [role="radio"][aria-label="1 dari 5 bintang"]');
  await oneStar.click();
}
await waitText("2 perubahan belum disimpan");
await (await btn("Simpan…")).click();
await waitText("Pratinjau dampak peringkat");
const dlgText = await page.$eval("dialog", (d) => d.innerText);
check("Dialog simpan menampilkan pratinjau dampak peringkat (Alpha turun, Beta naik)", dlgText.includes("Booth Alpha: #1 → #2") && dlgText.includes("Booth Beta: #2 → #1"), dlgText);
await page.type("dialog textarea", "Koreksi bintang E2E");
await page.click('dialog button[type="button"].bg-primary');
await page.waitForFunction(() => !document.body.innerText.includes("2 perubahan belum disimpan"), { timeout: 10000 });
await page.waitForSelector('span[title*="Asli:"]', { timeout: 10000 });
check("Review disunting + penanda '*' muncul di tabel", (await page.$$('span[title*="Asli:"]')).length >= 1);
await page.screenshot({ path: path.join(OUT, "t9-data-grid.png"), fullPage: true });

// Klik Riwayat pada baris pertama → ke halaman Log dengan ?target=
await (await btn("Booth")).click();
await page.waitForSelector('button[role="tab"][aria-selected="true"]');
await waitText("Booth Gamma");
await page.click('a[href*="/logs?target="]');
await page.waitForFunction(() => location.pathname.endsWith("/logs"), { timeout: 10000 });
await waitText("Analytics Engine belum terhubung");
check("Tautan Riwayat membuka halaman Log terfilter target", page.url().includes("/logs?target="));
check("Halaman Log menampilkan status Analytics Engine di dev", (await bodyText()).includes("Analytics Engine belum terhubung"));

// ---------- 3. Poster QR ----------
await page.goto(`${BASE}/admin/e/${EID}/posters`, { waitUntil: "networkidle0" });
await waitText("Poster QR");
await waitText("Booth Alpha");
const qrCount = await page.$$eval('svg[role="img"]', (els) => els.length);
check("Poster QR merender QR untuk semua booth tayang + poster pendaftaran", qrCount >= 5, `${qrCount}`);
await page.select("select", "a5");
const hasA5 = await page.$$eval("style", (els) => els.some((s) => s.textContent?.includes("size: a5 portrait")));
check("Pemilih ukuran kertas A5 memperbarui @page", hasA5);
await page.screenshot({ path: path.join(OUT, "t9-posters.png") });

check("Tanpa galat konsol atau pageerror di browser", errors.length === 0, errors.join(" | "));
await browser.close();
console.log(`\nTotal gagal: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
