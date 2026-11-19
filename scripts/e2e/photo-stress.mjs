// Uji stres foto (explore.md A16, B26, B27): booth tiba-tiba mengunggah foto di tengah event. Foto ekstrem (panorama,
// potret tinggi, sangat kecil, sangat besar, rusak) disuntikkan lewat intersepsi permintaan, TANPA menyentuh database.
// Memeriksa beranda, halaman booth, Layar Besar, dan dialog di HP + desktop: tanpa gulir mendatar, kartu seragam,
// gambar tidak keluar dari wadahnya, tanpa gambar rusak, dan tanpa lonjakan tata letak (CLS).
//
//   npm i --no-save puppeteer-core pngjs      (dev server hidup: npx vite --port 5197 --strictPort)
//   node scripts/e2e/photo-stress.mjs
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import puppeteer from "puppeteer-core";
import { PNG } from "pngjs";

const BASE = process.env.E2E_BASE ?? "http://localhost:5197";
const OUT = process.env.E2E_OUT ?? join(process.cwd(), "tmp-photo-stress");
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
mkdirSync(OUT, { recursive: true });

// ---------- gambar sintetis ----------
const SHAPES = {
  wide: [4000, 300],
  tall: [300, 4000],
  tiny: [16, 16],
  huge: [3000, 2000],
  normal: [480, 360],
  square: [480, 480],
  logowide: [1200, 90],
  logotall: [90, 600],
};
const cache = new Map();
function png(name) {
  if (cache.has(name)) return cache.get(name);
  const [w, h] = SHAPES[name];
  const img = new PNG({ width: Math.min(w, 800), height: Math.min(h, 800) }); // dimensi nyata dipertahankan lewat rasio
  // Rasio asli dipertahankan dengan menskalakan ke maks 800 px; ukuran kecil tetap kecil.
  const scale = Math.min(1, 800 / Math.max(w, h));
  const W = Math.max(1, Math.round(w * scale));
  const H = Math.max(1, Math.round(h * scale));
  const out = new PNG({ width: W, height: H });
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (W * y + x) << 2;
      const border = x < 4 || y < 4 || x >= W - 4 || y >= H - 4;
      const stripe = (Math.floor(x / 20) + Math.floor(y / 20)) % 2;
      out.data[i] = border ? 20 : stripe ? 230 : 120;
      out.data[i + 1] = border ? 35 : stripe ? 120 : 190;
      out.data[i + 2] = border ? 43 : stripe ? 70 : 230;
      out.data[i + 3] = 255;
    }
  const buf = PNG.sync.write(out);
  cache.set(name, buf);
  void img;
  return buf;
}

const keyOf = (name) => `stress/${name}`;
const photo = (name) => ({ keyFull: `${keyOf(name)}-full.webp`, keyThumb: `${keyOf(name)}-thumb.webp` });

// Pola foto per booth di beranda (indeks → bentuk); `null` = tanpa foto; "broken" = berkas 404
// BASELINE=1: tanpa foto sama sekali (pembanding CLS); selisih CLS foto-vs-baseline itulah yang disebabkan foto.
const BASELINE = process.env.BASELINE === "1";
const PATTERN = BASELINE
  ? Array(10).fill(null)
  : ["wide", "tall", "tiny", "huge", "broken", null, "normal", "square", "wide", null];
const LONG = "Kedai Mie Ayam Pangsit Goreng Spesial Mak Ijah Sejak Seribu Sembilan Ratus";

const problems = [];
const note = (ok, msg) => {
  console.log(`${ok ? "  ok  " : " GAGAL"} ${msg}`);
  if (!ok) problems.push(msg);
};

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });

async function open(viewport, path, { seed, patchEvent = true } = {}) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.evaluateOnNewDocument(
    (seedValue) => {
      if (seedValue) localStorage.setItem("visitor-seed", seedValue);
      window.__cls = 0;
      window.__clsSources = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (e.hadRecentInput) continue;
          window.__cls += e.value;
          window.__clsSources.push(
            `${e.value.toFixed(3)} ${e.sources.map((s) => (s.node ? `${s.node.tagName}.${String(s.node.className).slice(0, 40)}` : "?")).join(" + ")}`,
          );
        }
      }).observe({ type: "layout-shift", buffered: true });
    },
    seed ?? null,
  );
  await page.setRequestInterception(true);
  const snapCache = {};
  page.on("request", async (req) => {
    const url = new URL(req.url());
    try {
      if (url.pathname.startsWith("/media/stress/")) {
        const name = url.pathname.split("/").pop().replace(/-(thumb|full)\.webp$/, "");
        await new Promise((r) => setTimeout(r, 250)); // jaringan lambat: gambar datang terlambat
        if (name === "broken") return req.respond({ status: 404, body: "no" });
        return req.respond({ status: 200, contentType: "image/png", body: png(name) });
      }
      if (url.pathname === "/api/snapshot") {
        const real = await (await fetch(BASE + url.pathname + url.search)).json();
        const base = real.booths;
        const booths = PATTERN.map((shape, i) => {
          const src = base[i % base.length];
          const real_ = i < base.length;
          const p = shape ? photo(shape) : null;
          return {
            ...src,
            id: real_ ? src.id : `fake-${i}`,
            name: i === 7 ? LONG : real_ ? src.name : `Booth Uji ${i + 1}`,
            teamName: i % 2 === 0 ? "Fakultas Matematika dan Ilmu Pengetahuan Alam" : null,
            coverThumbKey: p?.keyThumb ?? null,
            coverKey: p?.keyFull ?? null,
            priceFrom: i % 3 === 0 ? 12000 : null,
          };
        });
        snapCache.booths = booths;
        return req.respond({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ...real,
            booths,
            ranking: booths.map((b, i) => ({
              boothId: b.id,
              rank: i + 1,
              score: 4 - i * 0.1,
              average: 4,
              reviewCount: 5,
            })),
            stats: { ...real.stats, boothCount: booths.length },
          }),
        });
      }
      if (patchEvent && !BASELINE && url.pathname === "/api/event") {
        const real = await (await fetch(BASE + url.pathname)).json();
        real.event.media = {
          logoKey: `${keyOf("logowide")}-full.webp`,
          ogImageKey: null,
          heroKeys: [`${keyOf("tall")}-thumb.webp`, `${keyOf("wide")}-thumb.webp`, `${keyOf("huge")}-thumb.webp`],
        };
        return req.respond({ status: 200, contentType: "application/json", body: JSON.stringify(real) });
      }
      const m = url.pathname.match(/^\/api\/booths\/([^/]+)$/);
      if (m) {
        const real = await (await fetch(BASE + url.pathname)).json();
        const shapes = ["wide", "tall", "tiny", "huge", "normal", "broken"];
        real.booth.photos = BASELINE ? [] : shapes.map(photo);
        real.booth.coverThumbKey = BASELINE ? null : photo("wide").keyThumb;
        real.booth.coverKey = BASELINE ? null : photo("wide").keyFull;
        real.booth.teamName = "Fakultas Matematika dan Ilmu Pengetahuan Alam";
        real.booth.tagline = "Tagline yang cukup panjang untuk menguji pembungkusan teks di layar sempit";
        return req.respond({ status: 200, contentType: "application/json", body: JSON.stringify(real) });
      }
      const pm = url.pathname.match(/^\/api\/booths\/([^/]+)\/products$/);
      if (pm) {
        const shapes = ["wide", "tall", "tiny", "huge", "normal", "broken", null, "square"];
        const products = shapes.map((s, i) => ({
          id: `p${i}`,
          name: i === 3 ? "Produk dengan nama yang sangat panjang sekali untuk menguji kartu produk" : `Produk ${i + 1}`,
          description: i % 2 ? "Deskripsi singkat produk." : null,
          category: i % 3 ? "Minuman" : null,
          priceIdr: 8000 + i * 1500,
          comparePriceIdr: i === 2 ? 20000 : null,
          badge: i === 1 ? "new" : null,
          thumbKey: s && !BASELINE ? photo(s).keyThumb : null,
          fullKey: s && !BASELINE ? photo(s).keyFull : null,
        }));
        return req.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ products, hasWhatsapp: false }) });
      }
    } catch (e) {
      errors.push(`intersepsi: ${e}`);
    }
    return req.continue();
  });
  await page.goto(BASE + path, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 1800));
  return { page, errors, snapCache };
}

const overflowX = (page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const cls = (page) => page.evaluate(() => window.__cls);
const clsWhy = (page) => page.evaluate(() => window.__clsSources.slice(0, 4).join(" || "));
const brokenImgs = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("img")].filter((i) => i.complete && i.naturalWidth === 0 && i.getBoundingClientRect().width > 0).length,
  );

for (const vp of [
  { name: "HP 390", width: 390, height: 844 },
  { name: "tablet 768", width: 768, height: 1024 },
  { name: "laptop 1366", width: 1366, height: 800 },
  { name: "lebar 1920", width: 1920, height: 1080 },
]) {
  console.log(`\n=== Beranda · ${vp.name}`);
  const { page, errors } = await open(vp, "/");
  note((await overflowX(page)) <= 0, `tanpa gulir mendatar (selisih ${await overflowX(page)}px)`);
  note((await brokenImgs(page)) === 0, "tanpa gambar rusak yang tampak");

  const grid = await page.evaluate(() => {
    const lis = [...document.querySelectorAll("ul[data-visual-mode] > li")];
    const rows = new Map();
    for (const li of lis) {
      const top = Math.round(li.getBoundingClientRect().top + scrollY);
      (rows.get(top) ?? rows.set(top, []).get(top)).push(li.getBoundingClientRect().height);
    }
    const heights = lis.map((l) => Math.round(l.getBoundingClientRect().height));
    const visuals = [...document.querySelectorAll("[data-card-visual]")].map((v) => {
      const r = v.getBoundingClientRect();
      return Math.round((r.width / r.height) * 100) / 100;
    });
    const escapes = [...document.querySelectorAll("ul[data-visual-mode] > li")]
      .flatMap((li) => {
        const c = li.getBoundingClientRect();
        return [...li.querySelectorAll("img")].filter((i) => {
          const r = i.getBoundingClientRect();
          return r.width > 0 && (r.right > c.right + 1 || r.left < c.left - 1 || r.bottom > c.bottom + 1 || r.top < c.top - 1);
        });
      }).length;
    return {
      mode: document.querySelector("ul[data-visual-mode]")?.getAttribute("data-visual-mode"),
      count: lis.length,
      rowSpread: Math.max(...[...rows.values()].map((h) => Math.max(...h) - Math.min(...h))),
      uniform: new Set(heights).size,
      ratios: [...new Set(visuals)],
      escapes,
    };
  });
  note(grid.count === PATTERN.length, `${grid.count} kartu dirender (mode ${grid.mode})`);
  note(grid.rowSpread <= 1, `tinggi kartu seragam per baris (selisih ${grid.rowSpread}px, ${grid.uniform} tinggi berbeda)`);
  note(grid.ratios.length <= 1 && (grid.ratios[0] === undefined || Math.abs(grid.ratios[0] - 1.33) < 0.03), `slot visual semua 4:3 (${grid.ratios.join(", ")})`);
  note(grid.escapes === 0, "gambar tidak keluar dari kartu");

  const hero = await page.evaluate(() => {
    const c = document.querySelector("[data-collage]");
    if (!c) return null;
    const box = c.getBoundingClientRect();
    return { w: Math.round(box.width), imgs: c.querySelectorAll("img").length, overflowing: c.scrollWidth > c.clientWidth + 1 && getComputedStyle(c).overflowX === "visible" };
  });
  note(hero === null || hero.imgs > 0, `kolase hero dengan foto ekstrem: ${hero ? `${hero.imgs} foto` : "tidak ada"}`);

  const logo = await page.evaluate(() => {
    const img = document.querySelector("footer img");
    if (!img) return null;
    const r = img.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth };
  });
  note(!logo || (logo.h <= 80 && logo.w <= logo.vw - 32), `logo footer wajar (${logo?.w}x${logo?.h})`);

  note((await cls(page)) < 0.1, `lonjakan tata letak (CLS) ${(await cls(page)).toFixed(3)} < 0.1 ${(await cls(page)) >= 0.1 ? await clsWhy(page) : ""}`);
  note(errors.length === 0, `tanpa galat JS${errors.length ? `: ${errors[0]}` : ""}`);
  await page.screenshot({ path: join(OUT, `home-${vp.width}.png`), fullPage: true });
  await page.close();
}

// Sorotan: sampel beberapa urutan (benih pengunjung berbeda → booth sorotan berbeda)
console.log("\n=== Sorotan (beberapa booth) · laptop & HP");
for (const vp of [{ width: 1366, height: 800 }, { width: 390, height: 844 }]) {
  const heights = new Set();
  for (const seed of ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"]) {
    const { page } = await open(vp, "/", { seed });
    const r = await page.evaluate(() => {
      const a = document.querySelector("article[data-layout]");
      if (!a) return null;
      const b = a.getBoundingClientRect();
      const inner = [...a.querySelectorAll("h2, p, a, button, b")].filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && (r.right > b.right + 1 || r.bottom > b.bottom + 1);
      }).length;
      return { layout: a.getAttribute("data-layout"), h: Math.round(b.height), inner, over: document.documentElement.scrollWidth - innerWidth };
    });
    if (r) {
      heights.add(`${r.layout}:${r.h}`);
      note(r.inner === 0 && r.over <= 0, `sorotan ${r.layout} (${vp.width}px, benih ${seed}): isi di dalam kotak, tinggi ${r.h}px`);
    }
    await page.close();
  }
  console.log(`   tinggi sorotan: ${[...heights].join(" | ")}`);
}

// Halaman booth: slideshow campuran, produk campuran
for (const vp of [{ name: "HP 390", width: 390, height: 844 }, { name: "laptop 1366", width: 1366, height: 800 }]) {
  console.log(`\n=== Halaman booth · ${vp.name}`);
  const snap = await (await fetch(`${BASE}/api/snapshot`)).json();
  const id = snap.booths[0].id;
  const { page, errors } = await open(vp, `/b/${id}`);
  await new Promise((r) => setTimeout(r, 1200));
  note((await overflowX(page)) <= 0, `tanpa gulir mendatar (selisih ${await overflowX(page)}px)`);
  note((await brokenImgs(page)) === 0, "tanpa gambar rusak yang tampak");
  const info = await page.evaluate(() => {
    const ss = document.querySelector("[data-hero-layout='photo']");
    const frame = ss?.querySelector("li, figure, div[class*='aspect']");
    const imgs = [...document.querySelectorAll("section img")];
    const cards = [...document.querySelectorAll("section ul[data-visual-mode] > li")];
    const rows = new Map();
    for (const c of cards) {
      const r = c.getBoundingClientRect();
      const k = Math.round(r.top + scrollY);
      (rows.get(k) ?? rows.set(k, []).get(k)).push(r.height);
    }
    const hs = [...rows.values()].map((h) => Math.max(...h) - Math.min(...h));
    const escapes = imgs.filter((i) => {
      const r = i.getBoundingClientRect();
      return r.width > innerWidth + 1;
    }).length;
    return { hasSlideshow: !!ss, products: cards.length, productSpread: hs.length ? Math.max(...hs) : 0, escapes, firstFrame: frame ? `${Math.round(frame.getBoundingClientRect().width)}x${Math.round(frame.getBoundingClientRect().height)}` : null };
  });
  note(info.hasSlideshow, "slideshow tampil (ada foto valid di antara foto ekstrem)");
  note(info.productSpread <= 1, `kartu produk campuran seragam per baris (${info.products} kartu, selisih terbesar ${info.productSpread}px)`);
  note(info.escapes === 0, "gambar tidak lebih lebar dari layar");
  note((await cls(page)) < 0.1, `CLS ${(await cls(page)).toFixed(3)} < 0.1 ${(await cls(page)) >= 0.1 ? await clsWhy(page) : ""}`);
  note(errors.length === 0, `tanpa galat JS${errors.length ? `: ${errors[0]}` : ""}`);
  await page.screenshot({ path: join(OUT, `booth-${vp.width}.png`), fullPage: true });
  // dialog Bagikan + panel Sematan dengan booth berfoto
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim().startsWith("Sematkan"))?.click());
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Bagikan")?.click());
  await new Promise((r) => setTimeout(r, 700));
  note((await overflowX(page)) <= 0, "dialog Bagikan: tanpa gulir mendatar");
  await page.screenshot({ path: join(OUT, `share-${vp.width}.png`) });
  await page.close();
}

// Layar Besar
console.log("\n=== Layar Besar 1920x1080");
{
  const { page, errors } = await open({ width: 1920, height: 1080 }, "/screen");
  note((await overflowX(page)) <= 0, "tanpa gulir mendatar");
  const vOver = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  note(vOver <= 2, `tanpa gulir tegak di layar besar (selisih ${vOver}px)`);
  note(errors.length === 0, `tanpa galat JS${errors.length ? `: ${errors[0]}` : ""}`);
  await page.screenshot({ path: join(OUT, "screen-1920.png") });
  await page.close();
}

await browser.close();
console.log(`\nSelesai. Masalah: ${problems.length}`);
for (const p of problems) console.log(` - ${p}`);
console.log(`Tangkapan layar: ${OUT}`);
process.exit(problems.length ? 1 : 0);
