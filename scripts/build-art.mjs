// Membuat aset gambar statis dari ilustrasi kartun makanan: SVG ilustrasi, kartu pratinjau tautan (OG),
// dan ikon situs. Hasilnya di-commit ke public/, jadi skrip ini hanya dijalankan saat desain/nama acara berubah:
//   npm run build:art                                   (nama acara bawaan)
//   npm run build:art -- --name "Nama Acara" --highlight "Kata"
// Memakai Chrome/Edge yang sudah terpasang (tanpa dependensi baru). Atur CHROME_PATH bila tidak ketemu.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { FOOD_NAMES, foodSvg } from "./art/food.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const PUBLIC = join(ROOT, "public");
const args = process.argv.slice(2);
const arg = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const EVENT_NAME = arg("name", "Penilaian Booth Terfavorit LPPM Expo Tahun 2026");
const HIGHLIGHT = arg("highlight", "Terfavorit");
// Logo resmi LPPM UNIMED (public/brand/lppm-logo.png, bukan dibuat skrip ini). Ganti dengan --logo path/ke/logo.png|svg|webp
const LOGO_PATH = arg("logo", join(ROOT, "public", "brand", "lppm-logo.png"));
const LOGO_URI = (() => {
  if (!LOGO_PATH) return null;
  const ext = LOGO_PATH.split(".").pop()?.toLowerCase() ?? "png";
  const mime =
    { svg: "image/svg+xml", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" }[ext] ??
    "image/png";
  return `data:${mime};base64,${readFileSync(resolve(LOGO_PATH)).toString("base64")}`;
})();

const INK = "#19232B";
const GREEN = "#1EB05F";
const ORANGE = "#FDA31B";
const CREAM = "#FAF8F5";
const MINT = "#9ADFB8";

const font = (family, file, weight) =>
  `@font-face{font-family:"${family}";font-weight:${weight};src:url("${
    pathToFileURL(join(ROOT, "node_modules", file)).href
  }") format("woff2")}`;
const FONTS = [
  font(
    "Bricolage",
    "@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2",
    "200 800",
  ),
  font("Caveat", "@fontsource-variable/caveat/files/caveat-latin-wght-normal.woff2", "400 700"),
  font("DM", "@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2", "100 1000"),
].join("");

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error("Chrome/Edge tidak ditemukan. Atur CHROME_PATH.");
  return found;
}

const work = mkdtempSync(join(tmpdir(), "build-art-"));
const chrome = findChrome();

/** Render HTML ke PNG berukuran persis w x h. */
function shot(html, outFile, w, h) {
  const page = join(work, `${Math.random().toString(36).slice(2)}.html`);
  writeFileSync(
    page,
    `<!doctype html><meta charset="utf-8"><style>${FONTS}html,body{margin:0}</style>${html}`,
  );
  // Jendela dibuat lebih besar lalu dipotong lewat CSS agar ukuran kecil (ikon) tidak dibulatkan ke minimum Chrome.
  execFileSync(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--virtual-time-budget=4000",
      `--window-size=${w},${h}`,
      `--screenshot=${outFile}`,
      pathToFileURL(page).href,
    ],
    { stdio: "ignore" },
  );
}

const pngSize = (file) => {
  const b = readFileSync(file);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

const svgUrl = (n) => pathToFileURL(join(PUBLIC, "art", "food", `${n}.svg`)).href;

// ---------- 1. SVG ilustrasi ----------
mkdirSync(join(PUBLIC, "art", "food"), { recursive: true });
for (const n of FOOD_NAMES) writeFileSync(join(PUBLIC, "art", "food", `${n}.svg`), foodSvg(n));

// ---------- 2. Kartu pratinjau tautan ----------
mkdirSync(join(PUBLIC, "og"), { recursive: true });

const GRID = `background-color:${CREAM};background-image:linear-gradient(#19232b10 1px,transparent 1px),linear-gradient(90deg,#19232b10 1px,transparent 1px);background-size:32px 32px;`;
const STRIPE = `<div style="position:absolute;left:0;right:0;bottom:0;height:34px;background:repeating-linear-gradient(90deg,${GREEN} 0 90px,${ORANGE} 90px 180px,#F1EADC 180px 270px,${MINT} 270px 360px)"></div>`;
const tile = (name, size, rot, x, y, bg = "#fff") =>
  `<div style="position:absolute;left:${x}px;top:${y}px;width:${size}px;height:${size}px;transform:rotate(${rot}deg);background:${bg};border:5px solid ${INK};border-radius:22px;box-shadow:9px 9px 0 ${INK};display:grid;place-items:center">` +
  `<div style="position:absolute;top:-16px;left:50%;width:96px;height:26px;margin-left:-48px;background:${ORANGE}cc;transform:rotate(-3deg)"></div>` +
  `<img src="${svgUrl(name)}" style="width:${size - 40}px;height:${size - 40}px"></div>`;

const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const titleHtml = (() => {
  const i = HIGHLIGHT ? EVENT_NAME.indexOf(HIGHLIGHT) : -1;
  if (i < 0) return escapeHtml(EVENT_NAME);
  return `${escapeHtml(EVENT_NAME.slice(0, i))}<mark style="background:${GREEN};color:${INK};padding:0 12px;border-radius:14px">${escapeHtml(HIGHLIGHT)}</mark>${escapeHtml(EVENT_NAME.slice(i + HIGHLIGHT.length))}`;
})();

const defaultCard = `<div style="position:relative;width:1200px;height:630px;overflow:hidden;${GRID}font-family:DM">
  <div style="position:absolute;left:64px;top:70px;width:690px">
    <div style="font:800 70px/1 Bricolage;color:${INK};letter-spacing:-0.02em">${titleHtml}</div>
    <div style="margin-top:30px;font:700 42px Caveat;color:#9a5a00;white-space:nowrap">Booth mana yang paling bikin kamu WOW?</div>
  </div>
  <div style="position:absolute;left:64px;bottom:64px;display:flex;gap:20px;align-items:center"><div style="background:#fff;border:4px solid ${INK};border-radius:20px;padding:8px 20px;box-shadow:6px 6px 0 ${INK}">${LOGO_URI ? `<img src="${LOGO_URI}" style="height:80px;display:block">` : "LPPM UNIMED"}</div><span style="background:${INK};color:#fff;border-radius:99px;padding:8px 20px;font:700 24px DM">eventunimed.id</span></div>
  ${tile("boba", 250, -6, 800, 58, "#9ADFB8")}
  ${tile("donut", 210, 7, 960, 290, "#FFE6B8")}
  ${tile("burger", 230, 4, 730, 330, "#fff")}
  <div style="position:absolute;right:64px;top:586px;"></div>
  ${STRIPE}
</div>`;
shot(defaultCard, join(PUBLIC, "og", "default.png"), 1200, 630);

const BG = [MINT, "#FFE6B8", "#CDEBD8", "#FFD6A0", "#E8F6EE", "#FFF0C2"];
FOOD_NAMES.forEach((name, i) => {
  const others = FOOD_NAMES.filter((n) => n !== name);
  const pick = (k) => others[(i + k * 3) % others.length];
  const card = `<div style="position:relative;width:1200px;height:630px;overflow:hidden;background:${BG[i % BG.length]}">
    <div style="position:absolute;inset:0;background-image:radial-gradient(#19232b18 2px,transparent 2px);background-size:28px 28px"></div>
    ${tile(pick(1), 150, -12, 90, 70, "#fff")}
    ${tile(pick(2), 170, 9, 940, 60, "#fff")}
    ${tile(pick(3), 140, 8, 110, 380, "#fff")}
    ${tile(pick(4), 160, -8, 960, 370, "#fff")}
    ${tile(name, 400, -3, 400, 90, "#fff")}
    ${STRIPE}
  </div>`;
  shot(card, join(PUBLIC, "og", `food-${name}.png`), 1200, 630);
});

// ---------- 3. Ikon situs ----------
// Ikon situs: lambang resmi UNIMED (public/brand/unimed-seal.png) di atas krem.
const SEAL_URI = `data:image/png;base64,${readFileSync(join(PUBLIC, "brand", "unimed-seal.png")).toString("base64")}`;
const iconPng = (file, size, pad) =>
  shot(
    `<div style="width:${size}px;height:${size}px;background:${CREAM};display:grid;place-items:center"><img src="${SEAL_URI}" style="display:block;width:${Math.round(size * pad)}px;height:${Math.round(size * pad)}px;object-fit:contain"></div>`,
    file,
    size,
    size,
  );
iconPng(join(PUBLIC, "icon-512.png"), 512, 0.74);
iconPng(join(PUBLIC, "icon-192.png"), 192, 0.74);
iconPng(join(PUBLIC, "apple-touch-icon.png"), 180, 0.86);
iconPng(join(work, "ico-48.png"), 48, 0.96);

// favicon.ico berisi satu gambar PNG (didukung semua peramban modern)
{
  const file = join(work, "ico-48.png");
  const png = readFileSync(file);
  const [w, h] = pngSize(file);
  const head = Buffer.alloc(22);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(1, 4);
  head.writeUInt8(w >= 256 ? 0 : w, 6);
  head.writeUInt8(h >= 256 ? 0 : h, 7);
  head.writeUInt16LE(1, 10); // planes
  head.writeUInt16LE(32, 12); // bit per piksel
  head.writeUInt32LE(png.length, 14);
  head.writeUInt32LE(22, 18); // posisi data gambar
  writeFileSync(join(PUBLIC, "favicon.ico"), Buffer.concat([head, png]));
}

for (const f of ["icon-512.png", "icon-192.png", "apple-touch-icon.png", "og/default.png"]) {
  const [w, h] = pngSize(join(PUBLIC, f));
  console.log(`${f}: ${w}x${h}`);
}
rmSync(work, { recursive: true, force: true });
console.log("Selesai: public/art, public/og, ikon.");
