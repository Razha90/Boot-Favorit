// E2E Tahap 7 di Chrome sungguhan: bagian 03 live (WebSocket), Layar Besar, umumkan hasil, animasi pemenang.
// Prasyarat: npx vite --port 5197 --strictPort; npm i --no-save puppeteer-core; .dev.vars berisi DEV_ADMIN_EMAIL.
// Menyemai event BARU dan mengaktifkannya. Pengunjung anonim dibuat lewat API (mode terbuka) agar skenario berskala.

import os from "node:os";
import path from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.env.E2E_BASE ?? "http://localhost:5197";
const OUT = process.env.E2E_OUT ?? os.tmpdir();
const DAY = 86_400_000;
let failed = 0;
const check = (name, ok, extra = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  → ${extra}` : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- API (Node) ----------
const adm = async (method, p, body) => {
  const r = await fetch(`${BASE}${p}`, {
    method,
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  return { status: r.status, json: t ? JSON.parse(t) : null };
};
let visitorSeq = 0;
async function visitor() {
  const i = ++visitorSeq;
  const ip = `10.7.${i >> 8}.${i & 255}`;
  const r = await fetch(`${BASE}/api/visitor/anonymous`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "cf-connecting-ip": ip },
    body: JSON.stringify({ displayName: `Tamu${i}` }),
  });
  return { ip, cookie: (r.headers.getSetCookie()[0] ?? "").split(";")[0] };
}
async function review(booth, stars, comment) {
  const v = await visitor();
  const r = await fetch(`${BASE}/api/booths/${booth.id}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID(), cookie: v.cookie, "cf-connecting-ip": v.ip },
    body: JSON.stringify({ stars, ...(comment ? { comment } : {}) }),
  });
  return r.status;
}

const now = Date.now();
const times = (phase) => {
  const o = phase === "live" ? [-3, -2, -1, 30] : [-4, -3, -2, -1];
  return { registrationOpenAt: now + o[0] * DAY, registrationCloseAt: now + o[1] * DAY, eventStartAt: now + o[2] * DAY, eventEndAt: now + o[3] * DAY };
};
const NAME = `Penilaian Tahap 7 ${now}`;
const ev = await adm("POST", "/api/admin/events", { name: NAME, titleHighlight: "Tahap", ...times("live") });
const EID = ev.json.event.id;
await adm("PUT", `/api/admin/events/${EID}`, { settings: { reviewerAuthMode: "open_turnstile" } });
const mk = async (name, no) => (await adm("POST", `/api/admin/e/${EID}/booths`, { name, boothNo: no })).json.booth;
const A = await mk("Booth A", "A1");
const B = await mk("Booth B", "B1");
const C = await mk("Booth C", "C1");
await adm("POST", `/api/admin/events/${EID}/activate`);
for (const [b, s] of [[A, 4], [B, 3], [C, 2]]) for (let i = 0; i < 3; i++) await review(b, s, `Ulasan awal ${b.name} ${i}`);

// ---------- Browser ----------
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--no-sandbox"],
});
const MOBILE = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const errors = [];
async function page(viewport) {
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  await p.setViewport(viewport);
  p.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404") && !m.text().includes("Failed to load resource")) errors.push(m.text());
  });
  p.on("pageerror", (e) => errors.push(String(e)));
  return p;
}
const text = (p) => p.evaluate(() => document.body.innerText);
const waitText = (p, t, timeout = 12000) => p.waitForFunction((x) => document.body.innerText.includes(x), { timeout }, t);
const waitNoText = (p, t, timeout = 12000) => p.waitForFunction((x) => !document.body.innerText.includes(x), { timeout }, t);
const tap = async (h) => {
  await h.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await h.click();
};
const btn = async (p, label) => {
  const [h] = await p.$$(`xpath/.//button[normalize-space()="${label}"]`);
  if (!h) throw new Error(`Tombol "${label}" tidak ada`);
  return h;
};
const rankingNames = (p) => p.$$eval("section[aria-labelledby='peringkat'] ol li h3, section[aria-labelledby='peringkat'] ol li span.truncate", (els) => els.map((e) => e.textContent.trim()));

// ---------- 1. Bagian 03 di halaman event (mobile) ----------
const home = await page(MOBILE);
await home.goto(`${BASE}/`, { waitUntil: "networkidle0" });
await waitText(home, "Peringkat saat ini");
const order = await home.evaluate(() => [...document.querySelectorAll("main section")].map((s) => s.getAttribute("aria-labelledby")));
check("Bagian 03 SELALU paling bawah (sorotan → semua → peringkat)", JSON.stringify(order) === JSON.stringify(["sorotan", "semua", "peringkat"]), order.join(","));
const cardsText = await home.$eval("section[aria-labelledby='semua']", (s) => s.innerText);
check("Kartu booth tidak memuat peringkat atau skor", !/peringkat|skor/i.test(cardsText));
const rank0 = await home.$$eval("section[aria-labelledby='peringkat'] ol li", (lis) => lis.map((l) => l.innerText.replace(/\s+/g, " ")));
check("Peringkat awal: A, B, C", /Booth A/.test(rank0[0] ?? "") && /Booth B/.test(rank0[1] ?? "") && /Booth C/.test(rank0[2] ?? ""), rank0.map((r) => r.slice(0, 30)).join(" | "));
await waitText(home, "LIVE", 10000).then(() => check("Penanda LIVE muncul (WebSocket tersambung)", true), () => check("Penanda LIVE muncul (WebSocket tersambung)", false));
check("Masthead statistik: 'N ulasan · M booth · rata-rata X'", /9 ulasan · 3 booth · rata-rata \d,\d\d/.test(await text(home)));
await home.evaluate(() => document.querySelector("section[aria-labelledby='peringkat']")?.scrollIntoView());
await home.screenshot({ path: path.join(OUT, "t7-home-standings.png") });

// ---------- 2. Pembaruan live tanpa muat ulang ----------
await review(C, 5, "Review live nomor satu dari uji");
await waitText(home, "Review live nomor satu dari uji", 9000).then(() => check("Ulasan baru muncul di 'Ulasan terbaru' TANPA muat ulang (≤ 9 dtk)", true), () => check("Ulasan baru muncul di 'Ulasan terbaru' TANPA muat ulang (≤ 9 dtk)", false));
const cardC = await home.$eval("section[aria-labelledby='semua']", (s) => [...s.querySelectorAll("li")].find((l) => l.innerText.includes("Booth C"))?.innerText ?? "");
check("Jumlah ulasan pada kartu booth C ikut naik (4)", /\(4\)/.test(cardC), cardC.replace(/\s+/g, " "));

// lonjakan 8 review → hanya satu pembaruan; "+N ulasan baru"
for (let i = 0; i < 8; i++) await review(C, 4, `Lonjakan ${i}`);
await waitText(home, "ulasan baru", 9000).then(() => check("Lonjakan ditampilkan sebagai '+N ulasan baru' (bukan 8 pesan)", true), () => check("Lonjakan ditampilkan sebagai '+N ulasan baru' (bukan 8 pesan)", false));
const feedItems = await home.$$eval("section[aria-labelledby='peringkat'] ul[aria-live] li", (l) => l.length);
check("Feed ulasan terbaru dibatasi 5 item", feedItems === 5, `${feedItems}`);

// pergantian peringkat 1 → toast
for (let i = 0; i < 10; i++) await review(B, 5);
await waitText(home, "Booth B naik ke peringkat 1", 12000).then(() => check("Toast 'Booth B naik ke peringkat 1' muncul saat peringkat 1 berganti", true), () => check("Toast 'Booth B naik ke peringkat 1' muncul saat peringkat 1 berganti", false));
const rank1 = await home.$$eval("section[aria-labelledby='peringkat'] ol li", (lis) => lis.map((l) => l.innerText.replace(/\s+/g, " ")));
check("Peringkat berubah di layar tanpa muat ulang: B di atas", /Booth B/.test(rank1[0] ?? ""), rank1[0]?.slice(0, 30));

// ---------- 3. Admin menyembunyikan peringkat: hilang tanpa muat ulang ----------
await adm("PUT", `/api/admin/events/${EID}/ranking-mode`, { mode: "hidden" });
await waitNoText(home, "Peringkat saat ini", 9000).then(() => check("Peringkat disembunyikan admin: hilang dari halaman TANPA muat ulang", true), () => check("Peringkat disembunyikan admin: hilang dari halaman TANPA muat ulang", false));
const hiddenJson = await home.evaluate(async () => (await (await fetch("/api/snapshot")).text()));
check("Server tidak mengirim peringkat/skor sama sekali saat disembunyikan", hiddenJson.includes('"ranking":null') && !hiddenJson.includes('"score"'));
check("Ulasan terbaru tetap tampil saat peringkat disembunyikan", (await text(home)).includes("Ulasan terbaru"));
await adm("PUT", `/api/admin/events/${EID}/ranking-mode`, { mode: "visible" });

// ---------- 4. Layar Besar ----------
const big = await page({ width: 1280, height: 720 });
await big.goto(`${BASE}/screen`, { waitUntil: "networkidle0" });
await waitText(big, "Booth Sorotan", 10000);
check("Layar Besar: panel pertama Sorotan; tanpa tombol/tautan", (await big.$$("a, button")).length === 0);
await waitText(big, "LIVE", 10000).then(() => check("Layar Besar: slot WebSocket tersambung (LIVE)", true), () => check("Layar Besar: slot WebSocket tersambung (LIVE)", false));
await big.screenshot({ path: path.join(OUT, "t7-screen-spotlight.png") });
const panelSeq = [await big.$eval("header span.font-hand", (e) => e.textContent)];
for (let i = 0; i < 3; i++) {
  const before = panelSeq[panelSeq.length - 1];
  await big.waitForFunction((b) => document.querySelector("header span.font-hand")?.textContent !== b, { timeout: 20000 }, before).catch(() => {});
  panelSeq.push(await big.$eval("header span.font-hand", (e) => e.textContent));
  if (panelSeq.at(-1) === "Semua booth") await big.screenshot({ path: path.join(OUT, "t7-screen-booths.png") });
  if (panelSeq.at(-1) === "Peringkat saat ini") await big.screenshot({ path: path.join(OUT, "t7-screen-ranking.png") });
}
check("Layar Besar berganti panel otomatis: Sorotan → Semua booth → Ulasan terbaru → Peringkat (terakhir)", JSON.stringify(panelSeq) === JSON.stringify(["Booth Sorotan", "Semua booth", "Ulasan terbaru", "Peringkat saat ini"]), panelSeq.join(" → "));

// ---------- 5. Event selesai → umumkan hasil lewat UI admin ----------
await adm("PUT", `/api/admin/events/${EID}`, times("ended"));
const admin = await page({ width: 1280, height: 1000 });
await admin.goto(`${BASE}/admin/e/${EID}`, { waitUntil: "networkidle0" });
await waitText(admin, "Hasil dan tampilan");
await waitText(admin, "Booth B");
check("Admin: kartu 'Hasil dan tampilan' menampilkan peringkat terkini", (await text(admin)).includes("Booth B"));
await tap(await btn(admin, "Umumkan hasil"));
await admin.waitForSelector("dialog[open]");
await admin.evaluate(() => [...document.querySelectorAll("dialog[open] button")].find((b) => b.innerText.trim() === "Umumkan hasil")?.click());
await waitText(admin, "Hasil sudah diumumkan");
check("Admin: umumkan hasil → 'Hasil sudah diumumkan'", true);
await admin.screenshot({ path: path.join(OUT, "t7-admin-results.png"), fullPage: true });

// animasi di Layar Besar (target screen)
await admin.select("select[id]", "screen").catch(() => {});
await tap(await btn(admin, "Putar animasi pemenang"));
await admin.waitForSelector("dialog[open]");
await admin.evaluate(() => [...document.querySelectorAll("dialog[open] button")].find((b) => b.innerText.trim() === "Putar animasi pemenang")?.click());
await big.waitForSelector("dialog[open]", { timeout: 12000 }).then(() => check("Layar Besar memutar animasi pemenang segera setelah admin menekan tombol", true), () => check("Layar Besar memutar animasi pemenang segera setelah admin menekan tombol", false));
await sleep(600);
check("Animasi di layar dimulai dengan hitung mundur", /^[123]$/m.test(await big.evaluate(() => document.querySelector("dialog[open]")?.innerText ?? "")));
await big.screenshot({ path: path.join(OUT, "t7-screen-reveal-count.png") });
await sleep(4000);
await big.screenshot({ path: path.join(OUT, "t7-screen-reveal-place.png") });
const bigDialog = await big.evaluate(() => document.querySelector("dialog[open]")?.innerText ?? "");
check("Setelah hitung mundur tampil juara 3 dahulu", /Juara 3/.test(bigDialog), bigDialog.replace(/\s+/g, " ").slice(0, 60));
check("Layar Besar: tanpa tombol saat animasi", (await big.$$("dialog[open] button, dialog[open] a")).length === 0 || (await big.$$eval("dialog[open] button", (b) => b.every((x) => x.getAttribute("aria-label") === null && x.className.includes("opacity-0")))));

// halaman pengunjung: target 'screen' tidak memutar di sini; buka baru → animasi putar-ulang otomatis
const visitorPage = await page(MOBILE);
await visitorPage.goto(`${BASE}/`, { waitUntil: "networkidle0" });
await visitorPage.waitForSelector("dialog[open]", { timeout: 10000 }).then(() => check("Pengunjung membuka halaman setelah hasil diumumkan: animasi diputar OTOMATIS", true), () => check("Pengunjung membuka halaman setelah hasil diumumkan: animasi diputar OTOMATIS", false));
await sleep(500);
await visitorPage.screenshot({ path: path.join(OUT, "t7-visitor-reveal.png") });
const optBox = await visitorPage.$("dialog[open] input[type='checkbox']");
check("Kotak 'Jangan putar otomatis lagi di perangkat ini' tersedia sejak awal", !!optBox);
await optBox?.click();
await tap(await btn(visitorPage, "Lewati"));
await visitorPage.waitForFunction(() => !document.querySelector("dialog[open]"), { timeout: 5000 });
const ended = await text(visitorPage);
const replayBtn = await visitorPage.$(`button[aria-label="Putar ulang animasi pemenang"]`);
check("Mode hanya-baca: banner berakhir + hasil akhir + tombol terbang putar ulang", ended.includes("Event telah berakhir") && ended.includes("Hasil akhir") && !!replayBtn);
const tiers = await visitorPage.$$eval("[data-tier]", (n) => n.map((x) => x.getAttribute("data-tier")));
check("Hasil akhir: juara 1-3 berbingkai khusus, sisanya baris", JSON.stringify(tiers.slice(0, 3)) === JSON.stringify(["1", "2", "3"]), tiers.join(","));
await visitorPage.evaluate(() => document.querySelector("section[aria-labelledby='peringkat']")?.scrollIntoView());
await visitorPage.screenshot({ path: path.join(OUT, "t7-visitor-results.png") });
const noOverflow = await visitorPage.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check("Mobile: tanpa gulir horizontal pada halaman hasil", noOverflow <= 0, `${noOverflow}px`);

await visitorPage.reload({ waitUntil: "networkidle0" });
await sleep(1500);
check("Setelah memilih 'jangan putar otomatis': muat ulang TIDAK memutar animasi", !(await visitorPage.$("dialog[open]")));
const replayBtnAfter = await visitorPage.$(`button[aria-label="Putar ulang animasi pemenang"]`);
if (!replayBtnAfter) throw new Error('Tombol terbang "Putar ulang animasi pemenang" tidak ada');
await tap(replayBtnAfter);
await visitorPage.waitForSelector("dialog[open]", { timeout: 5000 }).then(() => check("'Putar ulang animasi pemenang' memutar manual", true), () => check("'Putar ulang animasi pemenang' memutar manual", false));

// /results
const resPage = await page(MOBILE);
await resPage.goto(`${BASE}/results`, { waitUntil: "networkidle0" });
await resPage.waitForSelector("dialog[open]", { timeout: 8000 }).catch(() => {});
await resPage.keyboard.press("Escape");
await resPage.waitForFunction(() => !document.querySelector("dialog[open]"), { timeout: 5000 });
check("Halaman /results: Esc menutup animasi; daftar hasil seluruh booth", (await resPage.$$("[data-tier]")).length === 3, `${(await resPage.$$("[data-tier]")).length}`);

check("Tanpa galat konsol/JS di seluruh alur", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
console.log(failed === 0 ? "\nSEMUA LULUS" : `\n${failed} PEMERIKSAAN GAGAL`);
console.log(`Tangkapan layar: ${OUT}`);
process.exit(failed === 0 ? 0 : 1);
