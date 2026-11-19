// Ukur kontras teks WCAG AA di galeri /dev/components untuk tiap gaya/tema. Prasyarat sama dengan gallery-visual.mjs.
import puppeteer from "puppeteer-core";

const b = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await b.newPage();
await page.setViewport({ width: 1200, height: 900 });
const BASE = process.env.E2E_BASE ?? "http://localhost:5197";
await page.goto(`${BASE}/dev/components`, { waitUntil: "networkidle0" });
await page.waitForFunction(() => document.body.innerText.includes("Galeri komponen"));

// skipEvent: area event HANYA dirender seru/kertas (useAreaTheme), jadi bagian "Event ·" tidak diukur di gaya/tema lain.
const measure = (skipEvent) =>
  page.evaluate((skipEvent) => {
    // Baca warna lewat canvas: mendukung oklab()/color-mix() yang dipakai Tailwind v4 (rgba() saja tidak cukup).
    const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    const parse = (c) => {
      if (!c || c === "transparent") return null;
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = "#000";
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      return { r, g, b, a: a / 255 };
    };
    const lum = ({ r, g, b }) => {
      const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const bgOf = (el) => {
      for (let e = el; e; e = e.parentElement) {
        const c = parse(getComputedStyle(e).backgroundColor);
        if (c && c.a > 0.5) return c;
      }
      return { r: 255, g: 255, b: 255, a: 1 };
    };
    const bad = [];
    const walker = document.createTreeWalker(document.querySelector("main"), NodeFilter.SHOW_TEXT);
    const seen = new Set();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = n.textContent.trim();
      const el = n.parentElement;
      if (!t || seen.has(el) || el.closest("[aria-hidden='true']")) continue;
      if (skipEvent && el.closest("section")?.querySelector("h2")?.textContent?.startsWith("Event ·")) continue;
      seen.add(el);
      const cs = getComputedStyle(el);
      if (cs.webkitTextFillColor === "rgba(0, 0, 0, 0)" || cs.color.includes("0, 0, 0, 0")) continue; // bintang (gradasi)
      const fg = parse(cs.color);
      const bg = bgOf(el);
      if (!fg) continue;
      const L1 = lum(fg), L2 = lum(bg);
      const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const big = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && +cs.fontWeight >= 700);
      if (ratio < (big ? 3 : 4.5)) bad.push({ t: t.slice(0, 30), ratio: +ratio.toFixed(2), size: cs.fontSize });
    }
    return bad;
  }, skipEvent);

const click = async (label) => {
  const [h] = await page.$$(`xpath/.//button[normalize-space()="${label}"]`);
  await h.click();
  await new Promise((r) => setTimeout(r, 300));
};
for (const [vibe, theme] of [["seru", "kertas"], ["pro", "kertas"], ["pro", "panggung"]]) {
  await click(vibe);
  await click(theme);
  const bad = await measure(!(vibe === "seru" && theme === "kertas"));
  console.log(`${vibe}/${theme}: ${bad.length} teks di bawah AA`);
  for (const x of bad.slice(0, 8)) console.log(`   ${x.ratio}:1  ${x.size}  "${x.t}"`);
}
await b.close();
