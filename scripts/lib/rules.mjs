// Aturan penjaga kode (explore.md B4, B16, B26). Fungsi murni: menerima path dan teks, mengembalikan pelanggaran.
// Satu baris boleh dikecualikan dengan komentar `lint-ignore: <aturan>` di baris yang sama.

import path from "node:path";

const toPosix = (p) => p.split(path.sep).join("/");

/** @typedef {{ rule: string, line: number, text: string, message: string }} Violation */

const scanLines = (text, rule, test, message) => {
  /** @type {Violation[]} */
  const out = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((raw, i) => {
    if (raw.includes(`lint-ignore: ${rule}`)) return;
    if (test(raw)) out.push({ rule, line: i + 1, text: raw.trim(), message });
  });
  return out;
};

// ---------- Token: warna dan font hanya di theme.css / fonts.css (B4) ----------

const HEX = /(?<![\w&/])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/;
const COLOR_FN = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/;
const PALETTE =
  /\b(?:bg|text|border|ring|fill|stroke|from|via|to|outline|decoration|divide|accent|caret|shadow)-(?:(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}|white|black)\b/;
const FONT_LITERAL = /font-family\s*:|\bfontFamily\b|\bfont-\[/;
const FONT_NAMES =
  /\b(?:DM Sans|Bricolage Grotesque|Caveat|Plus Jakarta Sans|Public Sans|Newsreader|Archivo)\b/;

const TOKEN_HOMES = ["src/web/styles/theme.css", "src/web/styles/fonts.css"];

/** @returns {Violation[]} */
export function findTokenViolations(file, text) {
  const f = toPosix(file);
  if (TOKEN_HOMES.some((h) => f.endsWith(h))) return [];
  return [
    ...scanLines(
      text,
      "token-color",
      (l) => HEX.test(l) || COLOR_FN.test(l) || PALETTE.test(l),
      "Warna literal atau palet bawaan Tailwind. Pakai token (bg-primary, text-muted, border-line, ...).",
    ),
    ...scanLines(
      text,
      "token-font",
      (l) => FONT_LITERAL.test(l) || FONT_NAMES.test(l),
      "Nama font literal. Pakai font-ui, font-display, atau font-hand.",
    ),
  ];
}

// ---------- Gambar: <img> hanya di SafeImage (B26) ----------

const RAW_IMG = /<img\b|<picture\b|new\s+Image\s*\(|background-image|backgroundImage/;
const IMG_HOME = "src/web/components/shared/SafeImage.tsx";

/** @returns {Violation[]} */
const IS_TEST_FILE = /(?:\.test\.[jt]sx?$|\/test\/)/;
const IS_COMMENT_LINE = /^\s*(?:\/\/|\/\*|\*)/;

export function findRawImgViolations(file, text) {
  const f = toPosix(file);
  // Berkas tes tidak ikut dikirim; tes boleh membahas atau merakit <img> untuk menguji SafeImage.
  if (f.endsWith(IMG_HOME) || IS_TEST_FILE.test(f)) return [];
  return scanLines(
    text,
    "raw-img",
    // Komentar hanya membahas; yang dicari adalah kode yang benar-benar menulis gambar.
    (l) => !IS_COMMENT_LINE.test(l) && RAW_IMG.test(l),
    "Gambar mentah. Pakai SafeImage (tanpa gambar → bingkai/hanya-teks/hilang, bukan gambar rusak).",
  );
}

// ---------- Batas impor antar-area dan antar-lapisan (B14, B16) ----------

const IMPORT_SPEC = /(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)["']([^"']+)["']/g;
const ALIASES = { "@web/": "src/web/", "@shared/": "src/shared/", "@worker/": "src/worker/" };

/** Ubah spesifier impor menjadi path repo (posix), atau null bila paket npm. */
export function resolveSpec(fromFile, spec) {
  for (const [alias, target] of Object.entries(ALIASES)) {
    if (spec.startsWith(alias)) return target + spec.slice(alias.length);
  }
  if (spec.startsWith(".")) {
    return path.posix.normalize(path.posix.join(path.posix.dirname(toPosix(fromFile)), spec));
  }
  return null;
}

const areaOf = (p) => /^src\/web\/areas\/([^/]+)\//.exec(p)?.[1] ?? null;

/** @returns {Violation[]} */
export function findBoundaryViolations(file, text) {
  const f = toPosix(file);
  /** @type {Violation[]} */
  const out = [];
  const lines = text.split(/\r?\n/);
  const myArea = areaOf(f);

  lines.forEach((raw, i) => {
    if (raw.includes("lint-ignore: boundary")) return;
    for (const m of raw.matchAll(IMPORT_SPEC)) {
      const target = resolveSpec(f, m[1]);
      if (!target) continue;
      const isTypeOnly = /^\s*import\s+type\b/.test(raw);
      const fail = (message) =>
        out.push({ rule: "boundary", line: i + 1, text: raw.trim(), message });

      const targetArea = areaOf(`${target}/`);
      if (myArea && targetArea && targetArea !== myArea) {
        fail(
          `Area "${myArea}" dilarang mengimpor area "${targetArea}". Pindahkan ke shared/ bila dipakai ≥ 2 area.`,
        );
      }
      if (f.startsWith("src/shared/") && /^src\/(web|worker)\//.test(target)) {
        fail("shared/ dilarang mengimpor web/ atau worker/ (dipakai client dan server).");
      }
      if (f.startsWith("src/web/") && target.startsWith("src/worker/") && !isTypeOnly) {
        fail("web/ dilarang mengimpor kode worker/ (hanya `import type`).");
      }
      if (f.startsWith("src/worker/") && target.startsWith("src/web/")) {
        fail("worker/ dilarang mengimpor web/.");
      }
      if (
        f.startsWith("src/web/components/ui/") &&
        (target.startsWith("src/web/components/shared/") || target.startsWith("src/web/areas/"))
      ) {
        fail("components/ui adalah lapisan paling bawah; dilarang mengimpor shared/ atau areas/.");
      }
      if (f.startsWith("src/web/components/shared/") && target.startsWith("src/web/areas/")) {
        fail("components/shared dilarang mengimpor areas/.");
      }
    }
  });
  return out;
}
