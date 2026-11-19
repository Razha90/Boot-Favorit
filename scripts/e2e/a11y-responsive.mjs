// Uji responsif & aksesibilitas A13 di Chrome sungguhan pada 5 ukuran layar:
// 360x800, 390x844, 768x1024, 1280x800, 1920x1080 + input >= 16px + target sentuh >= 44px + reduced motion.
// Prasyarat: npx vite --port 5197 --strictPort; npm i --no-save puppeteer-core; .dev.vars berisi DEV_ADMIN_EMAIL.

import puppeteer from "puppeteer-core";

const BASE = process.env.E2E_BASE ?? "http://localhost:5197";
const DAY = 86_400_000;
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

const now = Date.now();
const ev = await adm("POST", "/api/admin/events", {
  name: `A13 Uji Responsif ${now}`,
  titleHighlight: "Responsif",
  registrationOpenAt: now - 3 * DAY,
  registrationCloseAt: now + 2 * DAY,
  eventStartAt: now - DAY,
  eventEndAt: now + 10 * DAY,
});
const EID = ev.json.event.id;
const b1 = (
  await adm("POST", `/api/admin/e/${EID}/booths`, {
    name: "Booth Uji Responsif A13",
    boothNo: "A01",
    tagline: "Tagline singkat untuk menguji tata letak responsif di semua ukuran layar",
    description: "Deskripsi booth uji agar kartu dan halaman detail terisi penuh.",
  })
).json.booth;
await adm("POST", `/api/admin/e/${EID}/booths/${b1.id}/products`, {
  name: "Produk Andalan",
  priceIdr: 15000,
  comparePriceIdr: 20000,
  termsConfirmed: true,
});
await adm("POST", `/api/admin/events/${EID}/activate`);

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--no-sandbox"],
});

const errors = [];
const page = await browser.newPage();
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().includes("404") && !m.text().includes("Failed to load resource")) {
    errors.push(m.text());
  }
});
page.on("pageerror", (e) => errors.push(String(e)));

const VIEWPORTS = [
  { name: "mobile-360", width: 360, height: 800 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1280", width: 1280, height: 800 },
  { name: "desktop-1920", width: 1920, height: 1080 },
];
const ROUTES = ["/", `/b/${b1.id}`, "/results", "/register", "/booth", "/screen"];

for (const vp of VIEWPORTS) {
  await page.setViewport({ width: vp.width, height: vp.height });
  for (const route of ROUTES) {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle0" });
    await page.waitForTimeout?.(150).catch(() => {});
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    check(`${vp.name} ${route}: tanpa overflow horizontal`, overflow <= 0, `diff=${overflow}px`);

    // Di HP: periksa ukuran huruf input (>= 16px mencegah auto-zoom iOS) dan tinggi tombol utama (>= 44px)
    if (vp.width <= 430 && (route === "/register" || route === "/booth" || route === `/b/${b1.id}`)) {
      const metrics = await page.evaluate(() => {
        const inputs = [...document.querySelectorAll("input:not([type=checkbox]):not([type=radio]), select, textarea")]
          .filter((el) => el.offsetParent !== null)
          .map((el) => ({
            tag: el.tagName,
            fontSize: Number.parseFloat(getComputedStyle(el).fontSize),
          }));
        const primaryBtns = [...document.querySelectorAll("button.bg-primary")]
          .filter((el) => el.offsetParent !== null)
          .map((el) => ({
            text: el.textContent?.trim(),
            height: Math.round(el.getBoundingClientRect().height),
          }));
        return { inputs, primaryBtns };
      });
      for (const inp of metrics.inputs) {
        check(`${vp.name} ${route}: ${inp.tag} fontSize >= 16px`, inp.fontSize >= 16, `${inp.fontSize}px`);
      }
      for (const b of metrics.primaryBtns) {
        check(`${vp.name} ${route}: tombol "${b.text}" tinggi >= 44px`, b.height >= 44, `${b.height}px`);
      }
    }
  }
}

// Gerak minimal (prefers-reduced-motion: reduce)
await page.setViewport({ width: 390, height: 844 });
await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
const reduced = await page.evaluate(() => {
  const probe = document.createElement("div");
  probe.className = "reveal-pop";
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const dur = cs.animationDuration;
  const name = cs.animationName;
  probe.remove();
  return { dur, name };
});
check(
  "prefers-reduced-motion: reduce mematikan/memendekkan animasi",
  reduced.name === "none" || reduced.dur === "0.01ms" || reduced.dur === "1e-05s" || reduced.dur === "0s",
  `${reduced.name} / ${reduced.dur}`,
);

check("Tanpa galat konsol atau pageerror", errors.length === 0, errors.join(" | "));
await browser.close();
console.log(`\nTotal gagal: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
