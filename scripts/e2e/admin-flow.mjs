// E2E alur admin (Tahap 3) di Chrome sungguhan terhadap dev server (workerd + D1 + R2 lokal).
// Prasyarat (sekali): npm i --no-save puppeteer-core; .dev.vars berisi DEV_ADMIN_EMAIL; migrasi lokal sudah diterapkan.
// Jalankan:   npx vite --port 5197 --strictPort   lalu   node scripts/e2e/admin-flow.mjs
// Environment: CHROME_PATH (bawaan: Chrome Windows), E2E_BASE (bawaan http://localhost:5197), E2E_OUT (folder tangkapan layar).

import os from "node:os";
import path from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.env.E2E_BASE ?? "http://localhost:5197";
const OUT = process.env.E2E_OUT ?? os.tmpdir();
const IMAGE = path.resolve("demo-assets/p0.jpg");
const NAME = `Expo E2E ${Date.now()}`;
const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  → " + extra : ""}`);
};

const browser = await puppeteer.launch({
  executablePath:
    process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 900 });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

const text = () => page.evaluate(() => document.body.innerText);
const waitText = (t, timeout = 15000) =>
  page.waitForFunction((x) => document.body.innerText.includes(x), { timeout }, t);
const byText = async (tag, label) => {
  const [h] = await page.$$(`xpath/.//${tag}[normalize-space()="${label}"]`);
  if (!h) throw new Error(`Tidak ada <${tag}> "${label}"`);
  return h;
};
const clickText = async (tag, label) => (await byText(tag, label)).click();
const setValue = (el, value) =>
  el.evaluate((node, v) => {
    const proto =
      node instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(node, v);
    node.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
const byLabel = async (label) => {
  const [h] = await page.$$(
    `xpath/.//label[contains(normalize-space(), "${label}")]/following::*[self::input or self::textarea or self::select][1]`,
  );
  if (!h) throw new Error(`Tidak ada isian berlabel "${label}"`);
  return h;
};
const jkt = (ms) => new Date(ms + 7 * 3600_000).toISOString().slice(0, 16);

try {
  // 1. Halaman admin terbuka lewat jalur dev
  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle0" });
  await waitText("Buat event baru");
  check("Halaman /admin terbuka (jalur admin lokal)", true);

  // 2. Buat event baru dengan jadwal
  const now = Date.now();
  await setValue(await byLabel("Nama resmi acara"), NAME);
  const dts = await page.$$('input[type="datetime-local"]');
  await setValue(dts[1], jkt(now + 1 * 86400_000)); // tutup
  await setValue(dts[2], jkt(now + 2 * 86400_000)); // mulai
  await setValue(dts[3], jkt(now + 3 * 86400_000)); // selesai
  await waitText("event mulai");
  check("Pratinjau jadwal tampil", (await text()).includes("ditutup"));
  await clickText("button", "Buat event");
  await page.waitForFunction(
    (n) => [...document.querySelectorAll("a")].some((a) => a.textContent === n),
    { timeout: 15000 },
    NAME,
  );
  check("Event dibuat dan tampil di daftar", true);

  // 3. Jadikan aktif
  const card = await page.evaluateHandle(
    (n) => [...document.querySelectorAll("li")].find((li) => li.innerText.includes(n)),
    NAME,
  );
  await (
    await card.asElement().$$('xpath/.//button[normalize-space()="Jadikan event aktif"]')
  )[0].click();
  await page.waitForFunction(
    (n) => {
      const li = [...document.querySelectorAll("li")].find((l) => l.innerText.includes(n));
      return li && li.innerText.includes("Aktif");
    },
    { timeout: 15000 },
    NAME,
  );
  const active = await page.evaluate(
    () =>
      [...document.querySelectorAll("li")].filter(
        (l) => l.innerText.includes("Aktif") && !l.innerText.includes("Jadikan"),
      ).length,
  );
  check("Event menjadi aktif, tepat satu yang aktif", active === 1, `aktif=${active}`);
  const eventHref = await page.evaluate(
    (n) =>
      [...document.querySelectorAll("a")].find((a) => a.textContent === n).getAttribute("href"),
    NAME,
  );
  const eventId = eventHref.split("/").pop();

  // 4. Publik melihat event aktif
  const pub = await page.evaluate(async () => (await fetch("/api/event")).json());
  check("GET /api/event publik memuat event aktif", pub.event?.name === NAME);

  // 5. Tambah booth HANYA dengan nama (dan klik ganda sinkron)
  await page.goto(`${BASE}/admin/e/${eventId}/booths`, { waitUntil: "networkidle0" });
  await waitText("Tambah booth");
  await setValue(await byLabel("Nama booth"), "Warung Hanya Nama");
  const addBtn = await page.$$('xpath/.//button[normalize-space()="Tambah booth"]');
  await addBtn[0].evaluate((b) => {
    b.click();
    b.click();
    b.click();
  }); // tiga klik dalam satu tick
  await page.waitForFunction(() => document.body.innerText.includes("Warung Hanya Nama"), {
    timeout: 15000,
  });
  await new Promise((r) => setTimeout(r, 800));
  const rows = {
    length: await page.evaluate(
      () =>
        [...document.querySelectorAll("tbody tr")].filter((r) =>
          r.innerText.includes("Warung Hanya Nama"),
        ).length,
    ),
  };
  const rowText = await page.evaluate(
    () =>
      [...document.querySelectorAll("tbody tr")].find((r) =>
        r.innerText.includes("Warung Hanya Nama"),
      ).innerText,
  );
  check(
    "Booth hanya-nama dibuat, klik ganda 3x → tepat 1 booth",
    rows.length === 1,
    `baris=${rows.length}`,
  );
  check(
    "Booth berstatus Tanpa pemilik, Hanya nama, Tayang",
    /Tanpa pemilik/.test(rowText) && /Hanya nama/.test(rowText) && /Tayang/.test(rowText),
    rowText.replace(/\s+/g, " "),
  );

  // 6. Impor CSV: daftar nama saja, lalu titik koma tanpa kolom email
  await page.goto(`${BASE}/admin/e/${eventId}/booths/import`, { waitUntil: "networkidle0" });
  await waitText("Impor booth dari CSV");
  await setValue(
    await page.$("textarea"),
    "Booth Alfa\nBooth Beta\nBooth Gamma\nwarung hanya nama",
  );
  await waitText("siap diimpor");
  const preview = await text();
  check(
    "Pratinjau: 3 siap, 1 peringatan (nama kembar)",
    /3 siap diimpor/.test(preview) && /1 peringatan/.test(preview),
  );
  await clickText("button", "Impor 3 booth");
  await waitText("Impor selesai");
  check(
    "Impor selesai: 3 dibuat",
    /3 dibuat, 0 dilewati, 0 galat/.test(await text()),
    (await text()).match(/\d+ dibuat[^\n]*/)?.[0],
  );

  await setValue(await page.$("textarea"), "nama;nomor_booth\nCSV Titik Koma;X1\nCSV Dua;X2");
  await waitText("2 siap diimpor");
  await clickText("button", "Impor 2 booth");
  await page.waitForFunction(() => /2 dibuat/.test(document.body.innerText), { timeout: 15000 });
  check("Impor titik koma tanpa kolom email: 2 dibuat", true);

  // 7. Daftar booth: semua tanpa pemilik
  await page.goto(`${BASE}/admin/e/${eventId}/booths`, { waitUntil: "networkidle0" });
  await waitText("CSV Titik Koma");
  const total = await page.evaluate(() => document.querySelectorAll("tbody tr").length);
  check("Daftar booth berisi 6 booth (1 manual + 3 + 2 impor)", total === 6, `baris=${total}`);
  await page.screenshot({ path: `${OUT}/booths.png` });

  // 8. Unggah foto: konversi WebP di browser → R2 → muncul di galeri
  await (await page.$$('xpath/.//a[normalize-space()="Warung Hanya Nama"]'))[0].click();
  await waitText("Galeri foto");
  const fileInput = await page.$('input[type="file"]');
  await fileInput.uploadFile(IMAGE);
  await page.waitForFunction(
    () => [...document.querySelectorAll("button")].some((b) => b.textContent === "Unggah"),
    { timeout: 20000 },
  );
  check("Gambar dikonversi di browser dan pratinjau tampil", true);
  await clickText("button", "Unggah");
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll("img")].some(
        (i) => i.src.includes("/media/events/") && i.naturalWidth > 0,
      ),
    { timeout: 20000 },
  );
  const loaded = await page.evaluate(() => {
    const i = [...document.querySelectorAll("img")].find((x) => x.src.includes("/media/events/"));
    return { src: i.src.split("/").slice(-1)[0], w: i.naturalWidth };
  });
  check(
    "Foto tersimpan di R2 dan tampil dari /media/*",
    loaded.w > 0,
    `${loaded.src} ${loaded.w}px`,
  );
  const photoRes = await page.evaluate(async () => {
    const i = [...document.querySelectorAll("img")].find((x) => x.src.includes("/media/events/"));
    const r = await fetch(i.src.replace("-thumb", "-full"));
    return {
      ct: r.headers.get("content-type"),
      cc: r.headers.get("cache-control"),
      size: (await r.arrayBuffer()).byteLength,
    };
  });
  check(
    "Berkas full: image/webp, cache abadi, ≤ 400 KB",
    photoRes.ct === "image/webp" && /immutable/.test(photoRes.cc) && photoRes.size <= 400_000,
    `${photoRes.size} B`,
  );
  await page.screenshot({ path: `${OUT}/booth-editor.png`, fullPage: true });

  // 9. Produk (opsional) dan kelengkapan berubah
  await setValue(await byLabel("Nama produk"), "Kopi Rempah");
  await setValue(await byLabel("Harga (Rp)"), "18000");
  await page.evaluate(() =>
    [...document.querySelectorAll('input[type="checkbox"]')]
      .find((c) => c.closest("label")?.innerText.includes("diskon"))
      .click(),
  );
  await clickText("button", "Tambah produk");
  await page.waitForFunction(() => document.body.innerText.includes("Andalan"), { timeout: 15000 });
  check("Produk pertama otomatis menjadi andalan", true);

  await page.goto(`${BASE}/admin/e/${eventId}/booths`, { waitUntil: "networkidle0" });
  await waitText("Warung Hanya Nama");
  const after = await page.evaluate(() =>
    [...document.querySelectorAll("tbody tr")]
      .find((r) => r.innerText.includes("Warung Hanya Nama"))
      .innerText.replace(/\s+/g, " "),
  );
  check(
    "Kelengkapan menjadi 'Sebagian' dengan 1 foto dan 1 produk",
    /Sebagian/.test(after) && /\b1\b.*\b1\b/.test(after),
    after,
  );
} catch (err) {
  check("Alur berjalan tanpa pengecualian", false, String(err.message ?? err));
  await page.screenshot({ path: `${OUT}/failure.png`, fullPage: true }).catch(() => {});
  console.log("TEKS HALAMAN:", (await text().catch(() => "")).slice(0, 600));
} finally {
  const appErrors = errors.filter((e) => !/favicon|ERR_ABORTED/.test(e));
  check(
    "Tidak ada galat konsol/halaman",
    appErrors.length === 0,
    appErrors.slice(0, 3).join(" | "),
  );
  await browser.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} lulus`);
  process.exit(results.every(Boolean) ? 0 : 1);
}
