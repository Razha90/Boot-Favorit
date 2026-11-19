// Pembantu CLI: telusuri berkas sumber, jalankan satu aturan, cetak pelanggaran, set kode keluar.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function* walk(dir, exts) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full, exts);
    else if (exts.some((e) => name.endsWith(e))) yield full;
  }
}

/**
 * @param {string} label
 * @param {string[]} dirs  direktori (relatif ke root repo) yang dipindai
 * @param {string[]} exts
 * @param {(file: string, text: string) => import("./rules.mjs").Violation[]} rule
 */
export function runRule(label, dirs, exts, rule) {
  let count = 0;
  for (const dir of dirs) {
    const abs = path.join(root, dir);
    try {
      statSync(abs);
    } catch {
      continue;
    }
    for (const full of walk(abs, exts)) {
      const rel = path.relative(root, full).split(path.sep).join("/");
      for (const v of rule(rel, readFileSync(full, "utf8"))) {
        count++;
        console.error(`${rel}:${v.line}  [${v.rule}] ${v.message}\n    ${v.text}`);
      }
    }
  }
  if (count > 0) {
    console.error(`\n${label}: ${count} pelanggaran.`);
    process.exit(1);
  }
  console.log(`${label}: bersih.`);
}
