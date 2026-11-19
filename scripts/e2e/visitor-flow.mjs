// E2E halaman pengunjung (Tahap 5) di Chrome sungguhan, viewport HP, terhadap dev server (workerd + D1 + R2 lokal).
// Prasyarat (sekali): npm i --no-save puppeteer-core; .dev.vars berisi DEV_ADMIN_EMAIL; migrasi lokal sudah diterapkan.
// Jalankan:   npx vite --port 5197 --strictPort   lalu   node scripts/e2e/visitor-flow.mjs
// Environment: CHROME_PATH, E2E_BASE (bawaan http://localhost:5197), E2E_OUT (folder tangkapan layar).
// Catatan: menyemai event BARU lalu menjadikannya aktif (event aktif sebelumnya digantikan).

import os from "node:os";
import path from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.env.E2E_BASE ?? "http://localhost:5197";
const OUT = process.env.E2E_OUT ?? os.tmpdir();
const DAY = 86_400_000;
const TITLE = `Penilaian Booth Terfavorit E2E ${Date.now()}`;
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

async function newPage(viewport = MOBILE, context = browser) {
  const page = await context.newPage();
  await page.setViewport(viewport);
  page.errors = [];
  page.on("console", (m) => {
    // Galat 404 dari gambar yang SENGAJA digagalkan bukan galat aplikasi.
    if (m.type() === "error" && !m.text().includes("404")) page.errors.push(m.text());
  });
  page.on("pageerror", (e) => page.errors.push(String(e)));
  return page;
}

// ---------- Penyemaian lewat API admin (dari halaman asal yang sama; bypass admin hanya di localhost) ----------
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
const upload = (url, hue) =>
  seedPage.evaluate(
    async (u, h) => {
      const make = (w, ht) => {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = ht;
        const x = c.getContext("2d");
        const g = x.createLinearGradient(0, 0, w, ht);
        g.addColorStop(0, `hsl(${h} 70% 55%)`);
        g.addColorStop(1, `hsl(${(h + 60) % 360} 70% 35%)`);
        x.fillStyle = g;
        x.fillRect(0, 0, w, ht);
        x.fillStyle = "rgba(255,255,255,.4)";
        x.beginPath();
        x.arc(w / 2, ht / 2, ht / 4, 0, 7);
        x.fill();
        return new Promise((res) => c.toBlob(res, "image/webp", 0.8));
      };
      const f = new FormData();
      f.append("full", await make(1280, 960), "f.webp");
      f.append("thumb", await make(480, 360), "t.webp");
      const r = await fetch(u, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: f,
      });
      return { status: r.status, json: await r.json() };
    },
    url,
    hue,
  );

const times = (phase) => {
  const t = Date.now();
  const o = {
    upcoming: [-2, -1, 1, 2],
    live: [-3, -2, -1, 1],
    ended: [-4, -3, -2, -1],
  }[phase];
  return {
    registrationOpenAt: t + o[0] * DAY,
    registrationCloseAt: t + o[1] * DAY,
    eventStartAt: t + o[2] * DAY,
    eventEndAt: t + o[3] * DAY,
  };
};

const ev = await adm("POST", "/api/admin/events", {
  name: TITLE,
  titleHighlight: "Terfavorit",
  ...times("live"),
});
check("Seed: event dibuat", ev.status === 201, `status ${ev.status}`);
const EID = ev.json.event.id;
const base = `/api/admin/e/${EID}/booths`;

const A = (
  await adm("POST", base, {
    name: "Kopi Rempah Nusantara",
    boothNo: "A12",
    tagline: "Hangat di lidah",
    description: "Kopi dengan rempah pilihan.",
  })
).json.booth;
await adm("PATCH", `${base}/${A.id}`, {
  about: "Kami meracik kopi rempah sejak 2019. ".repeat(14),
  teamName: "Prodi Gizi",
});
const B = (await adm("POST", base, { name: "Es Teh Pak Budi" })).json.booth;
const C = (
  await adm("POST", base, { name: "Roti Bakar Mas Agus", boothNo: "C3", description: "Roti bakar." })
).json.booth;
for (const [i, b] of [A, A, C].entries()) {
  const r = await upload(`${base}/${b.id}/media?kind=photo`, 20 + i * 70);
  if (r.status !== 201) console.log("upload foto gagal", r.status, JSON.stringify(r.json));
}
for (let i = 0; i < 3; i++) {
  const r = await upload(`/api/admin/e/${EID}/media?kind=hero&slot=${i}`, 150 + i * 60);
  if (r.status !== 201) console.log("upload hero gagal", r.status, JSON.stringify(r.json));
}
const cats = ["Minuman", "Makanan", "Camilan"];
for (let i = 0; i < 10; i++) {
  await adm("POST", `${base}/${A.id}/products`, {
    name: i === 0 ? "Kopi Rempah Susu" : `Produk ${i + 1}`,
    priceIdr: 9000 + i * 1000,
    category: cats[i % 3],
    termsConfirmed: true,
    ...(i === 0 ? { comparePriceIdr: 24000, badge: "limited" } : {}),
  });
}
await adm("PUT", `${base}/${A.id}/whatsapp`, {
  number: "0812-3456-7890",
  consentConfirmedByAdmin: true,
});
const act = await adm("POST", `/api/admin/events/${EID}/activate`);
check("Seed: event diaktifkan", act.status === 200, `status ${act.status}`);

const snap = await (await fetch(`${BASE}/api/snapshot`)).json();
const cCover = snap.booths.find((b) => b.id === C.id)?.coverKey;
check("Seed: snapshot publik berisi 3 booth", snap.booths.length === 3);

// ---------- Beranda (live) ----------
const page = await newPage();
// Foto booth C digagalkan (404) untuk menguji gambar gagal dimuat.
await page.setRequestInterception(true);
page.on("request", (req) => {
  if (cCover && req.url().includes(`/media/`) && req.url().includes(C.id)) {
    return req.respond({ status: 404, body: "tidak ada" });
  }
  return req.continue();
});

// Seperti jari: gulir elemen ke tengah layar dulu (bilah bawah HP yang fixed bisa menutupi tepi bawah).
const tap = async (handle) => {
  await handle.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await handle.click();
};
const overflow = () =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const body = () => page.evaluate(() => document.body.innerText);
// "Rusak" = sudah selesai dimuat tetapi tanpa piksel. Gambar lazy di luar layar belum dimuat (bukan rusak).
const brokenImgs = () =>
  page.evaluate(() =>
    [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src),
  );
// Gulir seluruh halaman agar gambar lazy dimuat (dan yang gagal sempat ditangani), lalu kembali ke atas.
const settle = async () => {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 15000 }).catch(() => {});
};

await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
await page.waitForSelector("h1");
await settle();
const h1 = await page.$eval("h1", (e) => e.textContent);
check("Beranda: judul utama = nama resmi acara", h1 === TITLE, h1);
check("Beranda: kata sorotan pada blok", (await page.$("h1 mark")) !== null);
const t0 = await body();
check("Beranda: lencana VOTING DIBUKA + CTA", t0.includes("VOTING DIBUKA") && t0.includes("Yuk, cobain jelajah booth"));
check("Beranda: '3 booth ikut serta'", t0.includes("3 booth ikut serta"));
check("Beranda: tanpa gulir horizontal", (await overflow()) <= 0, `selisih ${await overflow()}px`);
check("Beranda: kolase hero 3 foto", (await page.$eval("[data-collage]", (e) => e.dataset.collage).catch(() => null)) === "3");
check("Beranda: judul tab = nama acara", (await page.title()) === TITLE, await page.title());
check("Beranda: tanpa lencana peringkat / '#1'", !/peringkat|#\d/i.test(t0));
check("Beranda: bagian sorotan + kaki halaman ada", t0.includes("Sorotan") && (await page.$("footer")) !== null);

const cards = await page.$$eval("section[aria-labelledby='semua'] a[href^='/b/']", (as) =>
  as.map((a) => {
    const r = a.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  }),
);
check("Beranda: 3 kartu booth", cards.length === 3, JSON.stringify(cards));
check("Beranda: ukuran kartu SERAGAM (lengkap, hanya-nama, foto gagal)", new Set(cards.map((c) => `${c.w}x${c.h}`)).size === 1);
check("Beranda: tinggi kartu ≥ 44px (sasaran sentuh)", cards.every((c) => c.h >= 44));
check("Beranda: tak ada gambar rusak", (await brokenImgs()).length === 0, (await brokenImgs()).join(", "));
check("Beranda: booth foto-gagal memakai bingkai, bukan gambar rusak", (await page.$$("section[aria-labelledby='semua'] [data-photo-frame]")).length >= 1);
await page.screenshot({ path: path.join(OUT, "visitor-home-top.png") });
await page.screenshot({ path: path.join(OUT, "visitor-home-full.png"), fullPage: true });

// Keadilan: urutan berbeda antar pengunjung (konteks baru = penyimpanan baru = seed baru).
const orders = new Set();
for (let i = 0; i < 8; i++) {
  const ctx = await browser.createBrowserContext();
  const p = await newPage(MOBILE, ctx);
  await p.goto(`${BASE}/`, { waitUntil: "networkidle0" });
  await p.waitForSelector("section[aria-labelledby='semua'] a[href^='/b/']");
  orders.add((await p.$$eval("section[aria-labelledby='semua'] a[href^='/b/']", (as) => as.map((a) => a.getAttribute("href")))).join(","));
  await ctx.close();
}
check("Keadilan: urutan booth berbeda antar pengunjung", orders.size > 1, `${orders.size} urutan berbeda dari 8 pengunjung`);
const stable = async () => (await page.$$eval("section[aria-labelledby='semua'] a[href^='/b/']", (as) => as.map((a) => a.getAttribute("href")))).join(",");
const before = await stable();
await page.reload({ waitUntil: "networkidle0" });
await page.waitForSelector("section[aria-labelledby='semua'] a[href^='/b/']");
check("Keadilan: urutan stabil untuk pengunjung yang sama saat reload", (await stable()) === before);

// ---------- Pratinjau tautan (HTML mentah dari Worker) ----------
const rawHome = await (await fetch(`${BASE}/`)).text();
check("Meta /: og:title = nama acara", rawHome.includes(`property="og:title" content="${TITLE}"`));
const ogImg = rawHome.match(/property="og:image" content="([^"]+)"/)?.[1];
check("Meta /: og:image absolut", !ogImg || /^https?:\/\//.test(ogImg), ogImg ?? "(tanpa gambar OG, wajar)");
const rawA = await (await fetch(`${BASE}/b/${A.id}`)).text();
check("Meta /b/A: judul memuat nama booth + acara", rawA.includes("Kopi Rempah Nusantara") && rawA.includes(TITLE));
check("Meta /b/A: tanpa nomor WhatsApp", !/628123456789|0812-?3456/.test(rawA));
const rawB = await (await fetch(`${BASE}/b/${B.id}`)).text();
check("Meta /b/B (hanya-nama): tetap ada og:title", /property="og:title" content="[^"]*Es Teh Pak Budi/.test(rawB));

// ---------- Halaman booth A (lengkap) ----------
await page.goto(`${BASE}/b/${A.id}`, { waitUntil: "networkidle0" });
await page.waitForSelector("h1");
await settle();
const bodyA = await body();
check("Booth A: nama, tagline, nomor, tim", bodyA.includes("Kopi Rempah Nusantara") && bodyA.includes("Hangat di lidah") && bodyA.includes("Booth A12") && bodyA.includes("Prodi Gizi"));
check("Booth A: slideshow 2 foto dengan penghitung", (await page.$("section[aria-roledescription='carousel']")) !== null && bodyA.includes("1/2"));
check("Booth A: produk andalan + etalase + kenalan", (await page.$("#andalan")) !== null && bodyA.includes("Yang bisa kamu bawa pulang") && bodyA.includes("Kenalan sama booth ini"));
check("Booth A: tanpa gulir horizontal", (await overflow()) <= 0, `selisih ${await overflow()}px`);
check("Booth A: tak ada gambar rusak", (await brokenImgs()).length === 0, (await brokenImgs()).join(", "));
check("Booth A: bilah bawah HP berisi 'Yuk, kasih bintang!'", await page.$eval("nav[aria-label] a[href='#nilai']", (a) => getComputedStyle(a.closest("nav")).position === "fixed").catch(() => false));
check("Booth A: HTML tanpa nomor WhatsApp", !/628123456789|0812-?3456/.test(await page.content()));
const showShown = (await page.$$("[data-visual-mode] > li")).length;
check("Etalase: 6 produk dulu", showShown === 6, `${showShown}`);
const moreBtn = await page.$$("xpath/.//button[starts-with(normalize-space(),'Tampilkan lebih banyak')]");
check("Etalase: tombol 'Tampilkan lebih banyak' ada", moreBtn.length === 1);
await tap(moreBtn[0]);
check("Etalase: klik menambah produk", (await page.$$("[data-visual-mode] > li")).length > 6);
check("Etalase: chip kategori muncul (> 8 produk)", (await page.$$("xpath/.//button[normalize-space()='Semua']")).length === 1);

// Slideshow berjalan sendiri (animasi CSS) dan bisa dijeda.
const counter = () => page.evaluate(() => document.querySelector("section[aria-roledescription='carousel']")?.textContent.match(/\d\/\d/)?.[0]);
const c1 = await counter();
await page.waitForFunction((was) => document.querySelector("section[aria-roledescription='carousel']")?.textContent.match(/\d\/\d/)?.[0] !== was, { timeout: 9000 }, c1).then(() => check("Slideshow: maju otomatis", true), () => check("Slideshow: maju otomatis", false));
await page.click("button[aria-label='Jeda slideshow']");
const c2 = await counter();
await new Promise((r) => setTimeout(r, 6500));
check("Slideshow: tombol jeda menahan pergantian", (await counter()) === c2);

// Tautan produk (?p=) menyorot, bagikan, incaran, WhatsApp.
const sharedHref = await page.$$eval("a[href^='/go/wa/']", (as) => as.map((a) => a.getAttribute("href")));
check("WhatsApp: tombol menuju /go/wa (bukan nomor)", sharedHref.length > 0 && sharedHref.every((h) => /^\/go\/wa\/[\w-]+/.test(h)), sharedHref[0] ?? "");
const wa = await fetch(`${BASE}${sharedHref[0]}`, { redirect: "manual" });
const loc = wa.headers.get("location") ?? "";
check("WhatsApp: /go/wa → 302 ke wa.me dengan pesan terisi", wa.status === 302 && loc.startsWith("https://wa.me/6281234567890?text="), `${wa.status} ${loc.slice(0, 70)}`);
check("WhatsApp: pengalihan tidak di-cache", (wa.headers.get("cache-control") ?? "").includes("no-store"));

const saveBtns = await page.$$("xpath/.//button[contains(normalize-space(),'Simpan ke incaran')]");
await tap(saveBtns[0]);
await page.waitForFunction(() => document.body.innerText.includes("Incaranku (1)"), { timeout: 4000 }).then(() => check("Incaran: tombol melayang 'Incaranku (1)' muncul", true), () => check("Incaran: tombol melayang 'Incaranku (1)' muncul", false));
await page.reload({ waitUntil: "networkidle0" });
await page.waitForSelector("h1");
check("Incaran: bertahan setelah reload", (await body()).includes("Incaranku (1)"));

await settle(); // setelah reload: tunggu produk/gambar selesai agar tata letak tidak bergeser saat diklik
const shareBtn = await page.$$("xpath/.//button[normalize-space()='Bagikan']");
await tap(shareBtn[0]);
await page.waitForSelector("dialog[open] input", { timeout: 4000 }).catch(() => {});
const shareVal = await page.$eval("dialog[open] input", (i) => i.value).catch(() => "");
check(
  "Bagikan: dialog berisi tautan booth + sumber share",
  shareVal.includes(`/b/${A.id}`) && shareVal.includes("src=share"),
  shareVal ||
    (await page.evaluate(() => {
      const dialogs = [...document.querySelectorAll("dialog")].map(
        (d) => `${d.open ? "BUKA" : "tutup"}:${(d.textContent ?? "").trim().slice(0, 24)}`,
      );
      const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Bagikan");
      const r = b?.getBoundingClientRect();
      const top = r ? document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) : null;
      return `dialog=[${dialogs.join(" | ")}] tombol@${r ? `${Math.round(r.x)},${Math.round(r.y)}` : "?"} teratas=${top?.tagName}.${(top?.textContent ?? "").trim().slice(0, 20)}`;
    })),
);
await page.screenshot({ path: path.join(OUT, "visitor-booth-A-share.png") });
await page.keyboard.press("Escape");

await page.goto(`${BASE}/b/${A.id}`, { waitUntil: "networkidle0" });
await page.waitForSelector("h1");
await settle();
await page.screenshot({ path: path.join(OUT, "visitor-booth-A-top.png") });
await page.screenshot({ path: path.join(OUT, "visitor-booth-A-full.png"), fullPage: true });

// ---------- Booth B (hanya nama) ----------
await page.goto(`${BASE}/b/${B.id}`, { waitUntil: "networkidle0" });
await page.waitForSelector("h1");
await settle();
const bodyB = await body();
check("Booth B: halaman utuh dengan nama", (await page.$eval("h1", (e) => e.textContent)) === "Es Teh Pak Budi");
check("Booth B: hero satu kolom (tanpa foto)", (await page.$eval("[data-hero-layout]", (e) => e.dataset.heroLayout)) === "text");
check("Booth B: tanpa slideshow, andalan, etalase, kenalan, WA", !(await page.$("section[aria-roledescription='carousel']")) && !(await page.$("#andalan")) && !bodyB.includes("Yang bisa kamu bawa pulang") && !bodyB.includes("Kenalan sama") && !(await page.$("a[href^='/go/wa/']")));
check("Booth B: ulasan = ajakan, bukan '0'", bodyB.includes("Belum ada ulasan, jadi yang pertama dong!"));
check("Booth B: tanpa gulir horizontal & tanpa gambar rusak", (await overflow()) <= 0 && (await brokenImgs()).length === 0);
check("Booth B: tak ada teks undefined/null/NaN", !/\b(undefined|null|NaN)\b/.test(bodyB));
await page.screenshot({ path: path.join(OUT, "visitor-booth-B-full.png"), fullPage: true });

// ---------- Booth C (foto 404) ----------
await page.goto(`${BASE}/b/${C.id}`, { waitUntil: "networkidle0" });
await page.waitForSelector("h1");
await settle();
await page.waitForFunction(() => document.querySelector("[data-hero-layout]")?.dataset.heroLayout === "text", { timeout: 5000 }).then(() => check("Booth C: foto 404 → hero beralih ke satu kolom", true), () => check("Booth C: foto 404 → hero beralih ke satu kolom", false));
check("Booth C: tanpa gambar rusak setelah foto gagal", (await brokenImgs()).length === 0, (await brokenImgs()).join(", "));
await page.screenshot({ path: path.join(OUT, "visitor-booth-C.png"), fullPage: true });

// ---------- Status event mengubah teks dan CTA ----------
async function setPhase(phase) {
  const r = await adm("PUT", `/api/admin/events/${EID}`, times(phase));
  return r.status;
}
check("Jadwal → belum mulai (admin API)", (await setPhase("upcoming")) === 200);
await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
await page.waitForSelector("h1");
const tUp = await body();
check("Belum mulai: lencana, hitung mundur, CTA", tUp.includes("VOTING SEGERA DIBUKA") && tUp.includes("Voting dibuka dalam") && tUp.includes("Intip booth-nya"));
await page.goto(`${BASE}/b/${A.id}`, { waitUntil: "networkidle0" });
await page.waitForSelector("h1");
check("Belum mulai: kartu penilaian menampilkan hitung mundur", (await body()).includes("Voting dibuka dalam"));

check("Jadwal → selesai (admin API)", (await setPhase("ended")) === 200);
await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
await page.waitForSelector("h1");
const tEnd = await body();
check("Selesai: lencana, banner hanya-baca, CTA 'Lihat semua booth'", tEnd.includes("EVENT UDAH SELESAI") && tEnd.includes("Event telah berakhir. Tampilan ini hanya-baca.") && tEnd.includes("Lihat semua booth"));
await page.screenshot({ path: path.join(OUT, "visitor-home-ended.png") });
await page.goto(`${BASE}/b/${A.id}`, { waitUntil: "networkidle0" });
await page.waitForSelector("h1");
await settle();
const endA = await body();
check("Selesai: booth tanpa ajakan bintang, tanpa WA, tanpa simpan", !endA.includes("Yuk, kasih bintang!") && !(await page.$("a[href^='/go/wa/']")) && !endA.includes("Simpan ke incaran"));
check("Selesai: kartu penilaian 'udah ditutup'", endA.includes("Penilaian udah ditutup"));
const waEnded = await fetch(`${BASE}${sharedHref[0]}`, { redirect: "manual" });
check("Selesai: /go/wa tidak lagi mengalihkan ke nomor", !(waEnded.headers.get("location") ?? "").includes("wa.me/6281234567890"), `${waEnded.status}`);

// ---------- Desktop ----------
const desk = await newPage({ width: 1280, height: 900 });
await desk.goto(`${BASE}/b/${A.id}`, { waitUntil: "networkidle0" });
await desk.waitForSelector("h1");
check("Desktop booth A: tanpa gulir horizontal", (await desk.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0);
await desk.screenshot({ path: path.join(OUT, "visitor-booth-A-desktop.png") });
check("Booth A desktop: tombol 'Yuk, kasih bintang' tidak ada setelah selesai", !(await desk.evaluate(() => document.body.innerText)).includes("Yuk, kasih bintang!"));

// ---------- Galat konsol ----------
const errs = [...page.errors, ...desk.errors];
check("Tanpa galat konsol/JS di seluruh alur", errs.length === 0, errs.slice(0, 3).join(" | "));

await browser.close();
console.log(failed === 0 ? "\nSEMUA LULUS" : `\n${failed} PEMERIKSAAN GAGAL`);
console.log(`Tangkapan layar: ${OUT}`);
process.exit(failed === 0 ? 0 : 1);
