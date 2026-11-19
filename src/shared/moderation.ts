// Moderasi komentar (explore.md A15, B25): fungsi MURNI, dipakai server (penegakan) dan admin ("uji kalimat ini").
// Prinsip: filter hanya MENAHAN atau MENYAMARKAN teks komentar; tidak pernah menolak dan tidak menyentuh bintang.
// Pencocokan typo/fuzzy sengaja tidak ada (CONFIG.moderation.fuzzyMatching = false): lebih baik meloloskan
// daripada salah tangkap; yang lolos ditangani laporan dan admin.

export type Severity = "severe" | "mild";
export type TermKind = "block" | "allow";
export type TermMatch = "word" | "contains";
export type CommentVerdict = "visible" | "masked" | "held";

export interface ModerationTerm {
  id: string;
  term: string;
  severity: Severity;
  kind: TermKind;
  match: TermMatch;
}

export interface ModerationPolicy {
  severeAction: "hold" | "mask";
  mildAction: "mask" | "hold" | "allow";
  holdContactInfo: boolean;
}

export interface ModerationResult {
  status: CommentVerdict;
  /** Teks dengan kata disamarkan; hanya terisi bila status = "masked" */
  masked: string | null;
  /** Id istilah yang tertangkap (tanpa teksnya) */
  hits: string[];
  /** Ada nomor telepon, tautan, email, atau ajakan menghubungi */
  contact: boolean;
}

// ---------- Normalisasi satu kata ----------

const HOMOGLYPH: Record<string, string> = {
  а: "a",
  е: "e",
  о: "o",
  р: "p",
  с: "c",
  х: "x",
  у: "y",
  і: "i",
  ј: "j",
  ѕ: "s",
  ο: "o",
  α: "a",
  ε: "e",
  ν: "v",
};
const LEET: Record<string, string> = {
  "4": "a",
  "@": "a",
  "1": "i",
  "3": "e",
  "0": "o",
  $: "s",
  "5": "s",
  "7": "t",
};

/**
 * Bentuk pembanding satu kata: huruf kecil, NFKC, tanpa aksen/penanda tak terlihat, homoglyph dan leetspeak
 * dipetakan, lalu huruf berulang dilebur menjadi satu (`anjiiing` = `anjing`). Istilah dikompilasi dengan fungsi
 * yang sama sehingga kedua sisi selalu sebanding.
 */
export function normalizeWord(raw: string): string {
  let s = raw.normalize("NFKC").toLowerCase();
  s = s.normalize("NFD").replace(/[\p{M}\p{Cf}]/gu, "");
  let out = "";
  const hasLetter = /\p{L}/u.test(s);
  for (const ch of s) {
    const h = HOMOGLYPH[ch] ?? ch;
    // Angka murni (mis. "2026") jangan diubah; leetspeak hanya di dalam kata yang memuat huruf.
    out += hasLetter ? (LEET[h] ?? h) : h;
  }
  return out.replace(/(.)\1+/gu, "$1");
}

// Imbuhan bahasa Indonesia yang umum (B25 butir 3). Sengaja konservatif; "pe-"/"se-"/"ke-" tidak dipakai
// karena menimbulkan salah tangkap (mis. "petai").
const PREFIXES = ["meng", "meny", "mem", "men", "me", "di", "ber", "ter"] as const;
const SUFFIXES = ["nya", "lah", "kah", "kan", "an", "i"] as const;
const MIN_STEM = 3;

function stems(word: string): string[] {
  const out = new Set<string>([word]);
  const bases = [word];
  for (const p of PREFIXES) {
    if (word.startsWith(p) && word.length - p.length >= MIN_STEM) bases.push(word.slice(p.length));
  }
  for (const b of bases) {
    out.add(b);
    for (const s of SUFFIXES) {
      if (b.endsWith(s) && b.length - s.length >= MIN_STEM) out.add(b.slice(0, -s.length));
    }
  }
  return [...out];
}

// ---------- Kompilasi daftar istilah ----------

export interface CompiledTerms {
  /** Naik tiap daftar berubah; dicatat pada review (`filter_version`) */
  version: number;
  words: Map<string, { id: string; severity: Severity }>;
  contains: { needle: string; id: string; severity: Severity }[];
  allow: Set<string>;
}

/** Istilah `contains` minimal sepanjang ini agar tidak menangkap potongan kata biasa (Scunthorpe). */
const MIN_CONTAINS_LENGTH = 4;

export function compileTerms(terms: readonly ModerationTerm[], version: number): CompiledTerms {
  const c: CompiledTerms = { version, words: new Map(), contains: [], allow: new Set() };
  for (const t of terms) {
    const n = normalizeWord(t.term.trim());
    if (n === "") continue;
    if (t.kind === "allow") {
      c.allow.add(n);
    } else if (t.match === "contains" && n.length >= MIN_CONTAINS_LENGTH) {
      c.contains.push({ needle: n, id: t.id, severity: t.severity });
    } else if (!c.words.has(n) || t.severity === "severe") {
      c.words.set(n, { id: t.id, severity: t.severity });
    }
  }
  return c;
}

// ---------- Tokenisasi pada teks ASLI (indeks tetap valid untuk penyamaran) ----------

interface Token {
  text: string;
  start: number;
  end: number;
}

const TOKEN = /[\p{L}\p{N}\p{M}\p{Cf}@$]+/gu;
const SEPARATORS = /^[\s._\-*,|/\\]+$/u;
const MIN_SPELLED_RUN = 3;

function tokenize(text: string): Token[] {
  return [...text.matchAll(TOKEN)].map((m) => ({
    text: m[0],
    start: m.index ?? 0,
    end: (m.index ?? 0) + m[0].length,
  }));
}

/** Rangkaian huruf tunggal yang dieja ("a.n.j.i.n.g", "a n j i n g") digabung menjadi satu kata semu. */
function spelledRuns(text: string, tokens: readonly Token[]): Token[] {
  const runs: Token[] = [];
  let run: Token[] = [];
  const flush = () => {
    const first = run[0];
    const last = run[run.length - 1];
    if (first && last && run.length >= MIN_SPELLED_RUN) {
      runs.push({ text: run.map((t) => t.text).join(""), start: first.start, end: last.end });
    }
    run = [];
  };
  for (const t of tokens) {
    const single = [...t.text].length === 1 && /\p{L}/u.test(t.text);
    const prev = run[run.length - 1];
    if (!single) {
      flush();
    } else if (prev && !SEPARATORS.test(text.slice(prev.end, t.start))) {
      flush();
      run = [t];
    } else {
      run.push(t);
    }
  }
  flush();
  return runs;
}

// ---------- Pencocokan ----------

export interface TermHit {
  id: string;
  severity: Severity;
  start: number;
  end: number;
}

function matchToken(t: Token, c: CompiledTerms): TermHit | null {
  const n = normalizeWord(t.text);
  if (n === "" || c.allow.has(n)) return null; // pengecualian menang atas blokir
  for (const stem of stems(n)) {
    const w = c.words.get(stem);
    if (w) return { ...w, start: t.start, end: t.end };
  }
  for (const k of c.contains) {
    if (n.includes(k.needle)) return { id: k.id, severity: k.severity, start: t.start, end: t.end };
  }
  return null;
}

export function findTermHits(text: string, c: CompiledTerms): TermHit[] {
  const tokens = tokenize(text);
  const hits: TermHit[] = [];
  for (const t of [...tokens, ...spelledRuns(text, tokens)]) {
    const h = matchToken(t, c);
    if (h) hits.push(h);
  }
  return hits;
}

// ---------- Data kontak / iklan ----------

const CONTACT_PATTERNS: readonly RegExp[] = [
  /(?:\+?62|\b0)[\s.-]?8\d(?:[\s.-]?\d){6,11}/u, // ponsel Indonesia
  /(?:\d[\s.-]?){9,}/u, // deretan angka panjang
  /(?:https?:\/\/|www\.)\S+/iu,
  /\b[a-z0-9-]+\.(?:com|id|co\.id|net|org|me|link|ly|xyz|shop|store|app|io)\b/iu,
  /[\w.+-]+@[\w-]+\.[\w.]+/u, // email
  /(?:^|\s)@[a-z0-9_.]{3,}/iu, // @akun
  /\b(?:dm|inbox|wa|wasap|whatsapp|hubungi|follow|ig|insta|instagram|telegram)\b\s*(?:[:@]|saya\b|aku\b|gue\b|gw\b|kami\b|ya\b|aja\b|dong\b|yuk\b|kak\b)/iu,
];

export const hasContactInfo = (text: string): boolean =>
  CONTACT_PATTERNS.some((re) => re.test(text.normalize("NFKC")));

// ---------- Penyamaran dan putusan ----------

/** Samarkan bagian dalam kata: huruf pertama dan terakhir dibiarkan (`b***t`). */
export function maskRange(text: string, ranges: readonly { start: number; end: number }[]): string {
  // Indeks `start`/`end` dari regex adalah unit UTF-16; kerjakan dari belakang agar indeks lain tidak bergeser.
  let out = text;
  for (const r of [...ranges].sort((a, b) => b.start - a.start)) {
    const word = out.slice(r.start, r.end);
    const g = [...word];
    if (g.length <= 2) {
      out = out.slice(0, r.start) + "*".repeat(g.length) + out.slice(r.end);
      continue;
    }
    const masked = g[0] + "*".repeat(g.length - 2) + g[g.length - 1];
    out = out.slice(0, r.start) + masked + out.slice(r.end);
  }
  return out;
}

export function moderateComment(
  text: string,
  c: CompiledTerms,
  policy: ModerationPolicy,
): ModerationResult {
  const hits = findTermHits(text, c);
  const contact = hasContactInfo(text);
  const ids = [...new Set(hits.map((h) => h.id))];

  const severe = hits.filter((h) => h.severity === "severe");
  const mild = hits.filter((h) => h.severity === "mild");
  const hold =
    (severe.length > 0 && policy.severeAction === "hold") ||
    (mild.length > 0 && policy.mildAction === "hold") ||
    (contact && policy.holdContactInfo);
  if (hold) return { status: "held", masked: null, hits: ids, contact };

  const toMask = [
    ...(policy.severeAction === "mask" ? severe : []),
    ...(policy.mildAction === "mask" ? mild : []),
  ];
  if (toMask.length > 0) {
    return { status: "masked", masked: maskRange(text, toMask), hits: ids, contact };
  }
  return { status: "visible", masked: null, hits: ids, contact };
}
