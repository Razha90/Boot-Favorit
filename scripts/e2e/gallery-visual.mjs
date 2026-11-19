// Pemeriksaan visual galeri /dev/components di Chrome sungguhan (ukuran kartu, gambar 404 → bingkai, tema).
// Prasyarat: npm i --no-save puppeteer-core; npx vite --port 5196 --strictPort. Tangkapan layar ke E2E_OUT (bawaan: folder temp).
import puppeteer from "puppeteer-core";
import path from "node:path";

const OUT = process.env.E2E_OUT ?? (await import("node:os")).tmpdir();
const b = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await b.newPage();
await page.setViewport({ width: 1200, height: 900 });
const errors = [];
const notFound = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
page.on("response", (r) => r.status() === 404 && notFound.push(r.url()));
const res = [];
const check = (n, ok, x = "") => {
  res.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${x ? "  → " + x : ""}`);
};

const BASE = process.env.E2E_BASE ?? "http://localhost:5197";
await page.goto(`${BASE}/dev/components`, { waitUntil: "networkidle0" });
await page.waitForFunction(() => document.body.innerText.includes("Galeri komponen"));
// Gambar memakai loading="lazy": gulirkan seluruh halaman agar semuanya diminta (dan yang 404 sempat gagal).
await page.evaluate(async () => {
  for (let y = 0; y < document.body.scrollHeight; y += 500) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 120));
  }
  window.scrollTo(0, 0);
});
await new Promise((r) => setTimeout(r, 2000));
check("Galeri terbuka", true);

const imgs = await page.evaluate(() =>
  [...document.querySelectorAll("img")].map((i) => ({ ok: i.naturalWidth > 0 })),
);
check(
  "Tidak ada <img> rusak yang tampil (semua naturalWidth > 0)",
  imgs.every((i) => i.ok),
  `${imgs.length} gambar, rusak=${imgs.filter((i) => !i.ok).length}`,
);
check(
  "Gambar 404 sungguhan terjadi (fixture 'foto gagal') lalu diganti bingkai",
  notFound.some((u) => u.includes("/media/events/gagal/")),
  `${notFound.length} respons 404`,
);

const sizes = await page.evaluate(() => {
  const sec = [...document.querySelectorAll("section")].find(
    (s) => s.querySelector("h2")?.textContent === "BoothCard · card",
  );
  return [...sec.querySelectorAll("[data-card-visual]")].map((v) => {
    const r = v.getBoundingClientRect();
    return `${Math.round(r.width)}x${Math.round(r.height)}`;
  });
});
check(
  "Area visual semua kartu berukuran SAMA di tata letak nyata",
  new Set(sizes).size === 1 && sizes.length === 8,
  `${[...new Set(sizes)].join(",")} (${sizes.length} kartu)`,
);

// Seluruh kartu (bukan hanya area visual) harus setinggi sama walau datanya berbeda (nomor, harga, nama panjang).
const cardHeights = await page.evaluate(() => {
  const sec = [...document.querySelectorAll("section")].find(
    (s) => s.querySelector("h2")?.textContent === "BoothCard · card",
  );
  return [...sec.querySelectorAll("a[href^='/b/']")].map((a) => Math.round(a.getBoundingClientRect().height));
});
check(
  "Tinggi SELURUH kartu SAMA (nomor/harga/rating/nama panjang tidak mengubah ukuran)",
  new Set(cardHeights).size === 1 && cardHeights.length === 8,
  cardHeights.join(","),
);

const modes = await page.evaluate(() =>
  [...document.querySelectorAll("[data-visual-mode]")].map((u) => u.getAttribute("data-visual-mode")),
);
check("Grid campuran=photo, semua-hanya-nama=text", modes[0] === "photo" && modes.includes("text"), modes.join(","));
const layouts = await page.evaluate(() => {
  const sec = [...document.querySelectorAll("section")].find(
    (s) => s.querySelector("h2")?.textContent === "BoothCard · spotlight",
  );
  return [...sec.querySelectorAll("article[data-layout]")].map((a) => a.getAttribute("data-layout"));
});
check(
  "Sorotan: foto→photo, hanya nama/gagal/kosong→text",
  JSON.stringify(layouts) === JSON.stringify(["photo", "text", "text", "text"]),
  layouts.join(","),
);

await page.screenshot({ path: `${OUT}/gallery-seru.png`, fullPage: true });
const click = async (label) => {
  const [h] = await page.$$(`xpath/.//button[normalize-space()="${label}"]`);
  await h.click();
  await new Promise((r) => setTimeout(r, 300));
};
await click("pro");
await page.screenshot({ path: `${OUT}/gallery-pro.png`, fullPage: true });
await click("seru");
await click("panggung");
await page.screenshot({ path: `${OUT}/gallery-panggung.png`, fullPage: true });
const theme = await page.evaluate(() => `${document.documentElement.dataset.vibe}/${document.documentElement.dataset.theme}`);
check("Pergantian gaya/tema bekerja", theme === "seru/panggung", theme);

const real = errors.filter((e) => !/Failed to load resource.*404/.test(e));
check("Tidak ada galat konsol selain 404 yang disengaja", real.length === 0, real.slice(0, 2).join(" | "));
await b.close();
console.log(`\n${res.filter(Boolean).length}/${res.length} lulus`);
process.exit(res.every(Boolean) ? 0 : 1);
