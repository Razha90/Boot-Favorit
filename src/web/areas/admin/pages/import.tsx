import type { ImportSummary } from "@shared/api-types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { ActionButton } from "../../../components/ui/ActionButton";
import { Badge, Card } from "../../../components/ui/Card";
import { Field, Select, Textarea } from "../../../components/ui/Form";
import { copy } from "../../../lib/copy";
import type { ClassifiedRow } from "../../../lib/csv";
import { adminApi, adminKeys } from "../api";

type Parsed = { rows: ClassifiedRow[]; missingNameColumn: boolean; columns: string[] };

/** Unduh teks sebagai berkas (membangun Blob di browser; tanpa server). */
function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([`﻿${text}`], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const csvCell = (s: string) => (/[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

export function Component() {
  const { id: eventId = "" } = useParams();
  const qc = useQueryClient();
  const existing = useQuery({
    queryKey: adminKeys.booths(eventId),
    queryFn: () => adminApi.booths(eventId),
  });

  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [parsing, setParsing] = useState(false);
  const [onDup, setOnDup] = useState<"skip" | "create">("skip");
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  async function parse(source: string) {
    setSummary(null);
    setText(source);
    if (source.trim() === "") return setParsed(null);
    setParsing(true);
    try {
      const { parseCsv, tableToDrafts, classifyRows } = await import("../../../lib/csv");
      const result = tableToDrafts(parseCsv(source));
      setParsed({
        rows: classifyRows(result.rows, existing.data?.booths ?? []),
        missingNameColumn: result.missingNameColumn,
        columns: result.columns,
      });
    } finally {
      setParsing(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (file) await parse(await file.text());
  }

  const importable =
    parsed?.rows.filter(
      (r) => r.status === "ok" || (r.status === "warning" && onDup === "create"),
    ) ?? [];
  const counts = {
    ok: parsed?.rows.filter((r) => r.status === "ok").length ?? 0,
    warning: parsed?.rows.filter((r) => r.status === "warning").length ?? 0,
    error: parsed?.rows.filter((r) => r.status === "error").length ?? 0,
  };

  function downloadProblems() {
    if (!parsed) return;
    // Baris galat di pratinjau + baris yang ditolak/dilewati server (hasil per baris sejajar dengan 'importable').
    const problems: { row: ClassifiedRow; reasons: string[] }[] = [];
    for (const row of parsed.rows)
      if (row.status === "error") problems.push({ row, reasons: row.issues });
    summary?.results.forEach((res, i) => {
      const row = importable[i];
      if (row && res.status !== "created") problems.push({ row, reasons: [res.reason] });
    });
    const label = (x: string) => (copy.admin.import.issues as Record<string, string>)[x] ?? x;
    const lines = ["nama,nomor_booth,email,tagline,deskripsi,alasan"];
    for (const { row, reasons } of problems) {
      const d = row.draft;
      lines.push(
        [d.name, d.boothNo, d.email, d.tagline, d.description, reasons.map(label).join("; ")]
          .map(csvCell)
          .join(","),
      );
    }
    download("booth-bermasalah.csv", `${lines.join("\n")}\n`);
  }

  return (
    <>
      <div className="grid gap-1">
        <Link to={`/admin/e/${eventId}/booths`} className="text-sm text-muted underline">
          ← {copy.admin.booths.title}
        </Link>
        <h1 className="font-display text-3xl font-extrabold">{copy.admin.import.title}</h1>
        <p className="text-sm text-muted">{copy.admin.import.hint}</p>
      </div>

      <Card title={copy.admin.import.step1}>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            aria-label={copy.admin.import.chooseFile}
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <button
            type="button"
            className="text-sm underline"
            onClick={async () => {
              const { CSV_TEMPLATE } = await import("../../../lib/csv");
              download("templat-booth.csv", CSV_TEMPLATE);
            }}
          >
            {copy.admin.import.template}
          </button>
        </div>
        <Field label={copy.admin.import.paste}>
          {(fid) => (
            <Textarea
              id={fid}
              value={text}
              rows={6}
              placeholder={copy.admin.import.pastePlaceholder}
              onChange={(e) => void parse(e.target.value)}
            />
          )}
        </Field>
      </Card>

      {parsing && <p className="text-sm text-muted">{copy.admin.common.loading}</p>}

      {parsed?.missingNameColumn && (
        <p role="alert" className="text-sm text-danger">
          {copy.admin.import.missingName}
        </p>
      )}

      {parsed && !parsed.missingNameColumn && (
        <Card title={copy.admin.import.step2}>
          <p className="flex flex-wrap gap-2 text-sm">
            <Badge tone="primary">{copy.admin.import.countOk(counts.ok)}</Badge>
            <Badge tone="accent">{copy.admin.import.countWarning(counts.warning)}</Badge>
            <Badge tone="danger">{copy.admin.import.countError(counts.error)}</Badge>
          </p>
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-surface-raised text-xs text-muted">
                <tr>
                  <th className="py-1 pr-3">{copy.admin.import.line}</th>
                  <th className="pr-3">{copy.admin.booths.name}</th>
                  <th className="pr-3">{copy.admin.booths.boothNo}</th>
                  <th className="pr-3">{copy.admin.booths.email}</th>
                  <th>{copy.admin.import.result}</th>
                </tr>
              </thead>
              <tbody>
                {parsed.rows.map((r) => (
                  <tr key={r.draft.line} className="border-t-(length:--border-w) border-line">
                    <td className="py-1 pr-3 text-muted">{r.draft.line}</td>
                    <td className="pr-3">{r.draft.name}</td>
                    <td className="pr-3">{r.draft.boothNo}</td>
                    <td className="pr-3">{r.draft.email}</td>
                    <td>
                      {r.status === "ok" ? (
                        <Badge tone="primary">OK</Badge>
                      ) : (
                        <span
                          className={r.status === "error" ? "text-danger" : "text-accent-strong"}
                        >
                          {r.issues.map((i) => copy.admin.import.issues[i]).join("; ")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {counts.warning > 0 && (
            <Field label={copy.admin.import.onDuplicate}>
              {(fid) => (
                <Select
                  id={fid}
                  value={onDup}
                  onChange={(e) => setOnDup(e.target.value as "skip" | "create")}
                >
                  <option value="skip">{copy.admin.import.skip}</option>
                  <option value="create">{copy.admin.import.create}</option>
                </Select>
              )}
            </Field>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <ActionButton
              variant="primary"
              disabled={importable.length === 0}
              resetOn={`${text}|${onDup}`}
              action={async (ctx) => {
                const rows = importable.map((r) => ({
                  name: r.draft.name,
                  boothNo: r.draft.boothNo,
                  email: r.draft.email,
                  tagline: r.draft.tagline,
                  description: r.draft.description,
                }));
                setSummary(await adminApi.importBooths(eventId, rows, onDup, ctx));
                await qc.invalidateQueries({ queryKey: adminKeys.booths(eventId) });
              }}
            >
              {copy.admin.import.run(importable.length)}
            </ActionButton>
            {(counts.error > 0 || (summary && summary.created < importable.length)) && (
              <button type="button" className="text-sm underline" onClick={downloadProblems}>
                {copy.admin.import.downloadProblems}
              </button>
            )}
          </div>
        </Card>
      )}

      {summary && (
        <Card title={copy.admin.import.done} role="status">
          <p className="text-sm">
            {copy.admin.import.summary(summary.created, summary.skipped, summary.errors)}
          </p>
          <Link
            to={`/admin/e/${eventId}/booths`}
            className="w-fit rounded-chip border-(length:--border-w) border-line px-4 py-2 text-sm font-bold"
          >
            {copy.admin.import.seeBooths}
          </Link>
        </Card>
      )}
    </>
  );
}
