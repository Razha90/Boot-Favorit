// Ekspor CSV sisi klien dengan BOM UTF-8 (agar Excel Indonesia membaca rapi) dan pelindung formula injection.

type Cell = string | number | boolean | null | undefined;

export function csvCellClient(v: Cell): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function buildCsvContent(headers: readonly string[], rows: readonly Cell[][]): string {
  const head = headers.map(csvCellClient).join(",");
  const body = rows.map((r) => r.map(csvCellClient).join(","));
  return `\uFEFF${[head, ...body].join("\r\n")}\r\n`;
}

export function downloadCsv(
  filename: string,
  headers: readonly string[],
  rows: readonly Cell[][],
): void {
  const blob = new Blob([buildCsvContent(headers, rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
