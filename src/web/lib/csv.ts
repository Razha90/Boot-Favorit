// Parser CSV kecil untuk impor booth (explore.md B26). Dimuat saat file dipilih (import()), bukan di bundle awal.
// Mendukung pemisah koma, titik koma (Excel berbahasa Indonesia), dan tab; kutip ganda; BOM; baris kosong.

import { importRowSchema } from "@shared/schemas";

const DELIMITERS = [",", ";", "\t"] as const;

/** Pemisah dipilih dari baris pertama (di luar tanda kutip): yang paling sering muncul. */
export function detectDelimiter(text: string): string {
  const firstLine = text.replace(/^﻿/, "").split(/\r?\n/, 1)[0] ?? "";
  let inQuotes = false;
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in counts) counts[ch] = (counts[ch] ?? 0) + 1;
  }
  return DELIMITERS.reduce((best, d) => ((counts[d] ?? 0) > (counts[best] ?? 0) ? d : best), ",");
}

/** CSV → tabel string. Baris yang seluruh selnya kosong dibuang. */
export function parseCsv(input: string, delimiter = detectDelimiter(input)): string[][] {
  const text = input.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  const endCell = () => {
    row.push(cell);
    cell = "";
  };
  const endRow = () => {
    endCell();
    if (row.some((c) => c.trim() !== "")) rows.push(row.map((c) => c.trim()));
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i] as string;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delimiter) endCell();
    else if (ch === "\n") endRow();
    else if (ch === "\r") {
      if (text[i + 1] === "\n") i++;
      endRow();
    } else cell += ch;
  }
  if (cell !== "" || row.length > 0) endRow();
  return rows;
}

// ---------- Tabel → baris booth ----------

const HEADER_ALIASES = {
  name: ["nama", "name", "nama_booth", "nama booth", "booth"],
  boothNo: [
    "nomor_booth",
    "nomor booth",
    "no_booth",
    "no booth",
    "nomor",
    "no",
    "booth_no",
    "boothno",
  ],
  email: ["email", "e-mail", "surel"],
  tagline: ["tagline", "slogan"],
  description: ["deskripsi", "description", "keterangan"],
  // Asal booth: institusi, fakultas, atau prodi. Disimpan sebagai `teamName`.
  teamName: [
    "institusi",
    "fakultas",
    "prodi",
    "program studi",
    "program_studi",
    "unit",
    "asal",
    "asal institusi",
    "asal_institusi",
    "lembaga",
    "instansi",
    "tim",
    "team",
    "team_name",
    "teamname",
  ],
} as const;
type Field = keyof typeof HEADER_ALIASES;

const normHeader = (h: string) => h.trim().toLowerCase().replace(/\s+/g, " ");
const fieldOf = (header: string): Field | null => {
  const h = normHeader(header);
  for (const field of Object.keys(HEADER_ALIASES) as Field[]) {
    if ((HEADER_ALIASES[field] as readonly string[]).includes(h)) return field;
  }
  return null;
};

export interface DraftRow {
  /** Nomor baris di berkas (mulai 1, baris tajuk dihitung) */
  line: number;
  name: string;
  boothNo: string;
  email: string;
  tagline: string;
  description: string;
  teamName: string;
}

export interface ParsedBooths {
  rows: DraftRow[];
  /** Kolom yang dikenali (untuk ditampilkan ke admin) */
  columns: Field[];
  /** Ada tajuk tetapi tidak ada kolom `nama` */
  missingNameColumn: boolean;
}

export function tableToDrafts(table: string[][]): ParsedBooths {
  if (table.length === 0) return { rows: [], columns: [], missingNameColumn: false };

  const [first = [], ...rest] = table;
  const mapped = first.map(fieldOf);
  const hasHeader = mapped.some((f) => f !== null);

  // Tanpa tajuk dan satu kolom: daftar nama saja (mis. ditempel dari spreadsheet).
  if (!hasHeader) {
    const oneColumn = table.every((r) => r.length === 1);
    if (!oneColumn) return { rows: [], columns: [], missingNameColumn: true };
    return {
      rows: table.map((r, i) => ({
        line: i + 1,
        name: r[0] ?? "",
        boothNo: "",
        email: "",
        tagline: "",
        description: "",
        teamName: "",
      })),
      columns: ["name"],
      missingNameColumn: false,
    };
  }

  if (!mapped.includes("name")) return { rows: [], columns: [], missingNameColumn: true };

  const rows = rest.map((cells, i): DraftRow => {
    const pick = (f: Field) => {
      const idx = mapped.indexOf(f);
      return idx >= 0 ? (cells[idx] ?? "").trim() : "";
    };
    return {
      line: i + 2,
      name: pick("name"),
      boothNo: pick("boothNo"),
      email: pick("email"),
      tagline: pick("tagline"),
      description: pick("description"),
      teamName: pick("teamName"),
    };
  });
  return {
    rows,
    columns: mapped.filter((f): f is Field => f !== null),
    missingNameColumn: false,
  };
}

// ---------- Klasifikasi pratinjau (server tetap memvalidasi ulang) ----------

export type RowIssue =
  | "name_required"
  | "name_too_long"
  | "email_invalid"
  | "field_too_long"
  | "email_in_use"
  | "email_duplicate_in_file"
  | "duplicate_name";

export interface ClassifiedRow {
  draft: DraftRow;
  status: "ok" | "warning" | "error";
  issues: RowIssue[];
}

export function classifyRows(
  drafts: readonly DraftRow[],
  existing: readonly { name: string; email: string | null }[],
): ClassifiedRow[] {
  const takenEmails = new Set(existing.flatMap((b) => (b.email ? [b.email.toLowerCase()] : [])));
  const seenNames = new Set(existing.map((b) => b.name.trim().toLowerCase()));
  const emailsInFile = new Set<string>();

  return drafts.map((draft) => {
    const issues: RowIssue[] = [];
    const parsed = importRowSchema.safeParse({
      name: draft.name,
      boothNo: draft.boothNo,
      email: draft.email,
      tagline: draft.tagline,
      description: draft.description,
      teamName: draft.teamName,
    });

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === "name")
          issues.push(draft.name.trim() === "" ? "name_required" : "name_too_long");
        else if (field === "email") issues.push("email_invalid");
        else issues.push("field_too_long");
      }
    } else {
      const email = parsed.data.email;
      if (email) {
        if (takenEmails.has(email)) issues.push("email_in_use");
        else if (emailsInFile.has(email)) issues.push("email_duplicate_in_file");
        else emailsInFile.add(email);
      }
      const key = parsed.data.name.trim().toLowerCase();
      if (seenNames.has(key)) issues.push("duplicate_name");
      else seenNames.add(key);
    }

    const isError = issues.some((i) => i !== "duplicate_name");
    return { draft, issues, status: isError ? "error" : issues.length > 0 ? "warning" : "ok" };
  });
}

/** Templat CSV untuk diunduh admin. */
export const CSV_TEMPLATE =
  "nama,institusi,nomor_booth,email,tagline,deskripsi\nKopi Rempah,Fakultas Teknik,A12,,Hangat di lidah,\n";
