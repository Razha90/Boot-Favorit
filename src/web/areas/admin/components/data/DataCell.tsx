// Sel Data Grid: tampilan + sunting langsung (dblklik/Enter/Esc/Tab/panah, Ctrl+C/V) dan penanda tertunda/konflik.
import {
  type CellValue,
  type ColumnDef,
  type GridEntity,
  type GridRow,
  parseEditValue,
} from "@shared/data-grid";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { RatingStars } from "../../../../components/shared/RatingStars";
import { cn } from "../../../../lib/cn";
import { copy } from "../../../../lib/copy";
import { formatCellValue, optionLabel, reviewEditedTooltip } from "./grid-format";
import type { PendingEdit } from "./use-grid-edits";

const D = copy.admin.data;

export function DataCell({
  entity,
  row,
  col,
  timeZone,
  density,
  sticky,
  pending,
  editing,
  onStartEdit,
  onStopEdit,
  onCommit,
  onNavigate,
  cellRef,
}: {
  entity: GridEntity;
  row: GridRow;
  col: ColumnDef;
  timeZone: string;
  density: "comfortable" | "compact";
  sticky: boolean;
  pending: PendingEdit | undefined;
  editing: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onCommit: (value: CellValue) => void;
  onNavigate: (dr: number, dc: number) => void;
  cellRef: (el: HTMLButtonElement | null) => void;
}) {
  const serverValue = row.values[col.key] ?? null;
  const shownValue = pending ? pending.newValue : serverValue;
  const [draft, setDraft] = useState<string>("");
  const [starDraft, setStarDraft] = useState<number>(Number(shownValue ?? 5));
  const [invalid, setInvalid] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null);

  useEffect(() => {
    if (!editing) {
      setInvalid(null);
      return;
    }
    setDraft(shownValue === null || shownValue === undefined ? "" : String(shownValue));
    setStarDraft(Number(shownValue ?? 5));
    setInvalid(null);
    // Fokus ke kontrol sunting pada frame berikutnya
    queueMicrotask(() => inputRef.current?.focus());
  }, [editing, shownValue]);

  const validateAndCommit = (raw: unknown): boolean => {
    const parsed = parseEditValue(entity, col.key, raw);
    if (!parsed.ok) {
      setInvalid(D.invalidCell);
      return false;
    }
    setInvalid(null);
    onCommit(parsed.value);
    onStopEdit();
    return true;
  };

  const commitDraft = () => {
    if (col.type === "number") {
      const n = draft.trim() === "" ? Number.NaN : Number(draft);
      return validateAndCommit(n);
    }
    if (col.type === "bool") return validateAndCommit(draft === "true");
    return validateAndCommit(draft);
  };

  const onCellKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (editing) return;
    if (e.key === "Enter" && col.editable) {
      e.preventDefault();
      onStartEdit();
      return;
    }
    if ((e.key === " " || e.key === "Spacebar") && col.editable && col.type === "bool") {
      e.preventDefault();
      validateAndCommit(!shownValue);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      onNavigate(-1, 0);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      onNavigate(1, 0);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      onNavigate(0, -1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      onNavigate(0, 1);
    } else if (e.key === "Tab") {
      e.preventDefault();
      onNavigate(0, e.shiftKey ? -1 : 1);
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
      const text = formatCellValue(entity, col, shownValue, timeZone);
      void navigator.clipboard?.writeText(text).catch(() => {});
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v" && col.editable) {
      e.preventDefault();
      void navigator.clipboard
        ?.readText()
        .then((clip) => {
          if (col.type === "number") validateAndCommit(Number(clip.trim()));
          else if (col.type === "bool")
            validateAndCommit(clip.trim() === "true" || clip.trim() === "1");
          else if (col.type === "stars") validateAndCommit(Number(clip.trim()));
          else validateAndCommit(clip);
        })
        .catch(() => {});
    }
  };

  const onInputKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onStopEdit();
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      if (commitDraft()) onNavigate(0, e.shiftKey ? -1 : 1);
      return;
    }
    if (e.key === "Enter" && (col.type !== "longtext" || !e.shiftKey)) {
      e.preventDefault();
      if (commitDraft()) onNavigate(1, 0);
    }
  };

  const editedTip =
    entity === "reviews" && (col.key === "stars" || col.key === "comment")
      ? reviewEditedTooltip(row, timeZone)
      : null;

  const pad = density === "compact" ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm";

  return (
    <td
      className={cn(
        "border-b-(length:--border-w) border-line align-top",
        sticky && "sticky left-0 z-[5] bg-surface-raised",
        pending && !pending.error && "bg-accent/20 ring-1 ring-inset ring-warning",
        pending?.error && "bg-danger/10 ring-1 ring-inset ring-danger",
        col.type === "hash" && "font-mono text-xs text-muted",
        col.type === "number" && "tabular-nums",
      )}
    >
      {editing ? (
        <div className={cn("grid gap-1", pad)}>
          {col.type === "select" ? (
            <select
              ref={(el) => {
                inputRef.current = el;
              }}
              aria-label={col.key}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                validateAndCommit(e.target.value);
              }}
              onKeyDown={onInputKeyDown}
              onBlur={onStopEdit}
              className="w-full min-w-28 rounded-card border-(length:--border-w) border-line bg-surface-raised px-2 py-1 text-xs text-text"
            >
              {(col.options ?? []).map((opt) => (
                <option key={opt} value={opt}>
                  {optionLabel(entity, col.key, opt)}
                </option>
              ))}
            </select>
          ) : col.type === "bool" ? (
            <select
              ref={(el) => {
                inputRef.current = el;
              }}
              aria-label={col.key}
              value={draft === "true" ? "true" : "false"}
              onChange={(e) => validateAndCommit(e.target.value === "true")}
              onKeyDown={onInputKeyDown}
              onBlur={onStopEdit}
              className="w-full min-w-20 rounded-card border-(length:--border-w) border-line bg-surface-raised px-2 py-1 text-xs text-text"
            >
              <option value="true">{D.values.bool.yes}</option>
              <option value="false">{D.values.bool.no}</option>
            </select>
          ) : col.type === "stars" ? (
            <fieldset
              className="flex items-center gap-1 border-0 p-0"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  onStopEdit();
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  validateAndCommit(starDraft);
                }
              }}
            >
              <RatingStars
                mode="input"
                size="sm"
                value={starDraft}
                onChange={(n) => {
                  setStarDraft(n);
                  validateAndCommit(n);
                }}
              />
            </fieldset>
          ) : col.type === "longtext" ? (
            <textarea
              ref={(el) => {
                inputRef.current = el;
              }}
              aria-label={col.key}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onInputKeyDown}
              onBlur={commitDraft}
              rows={3}
              className="w-full min-w-52 rounded-card border-(length:--border-w) border-line bg-surface-raised px-2 py-1 text-xs text-text"
            />
          ) : (
            <input
              ref={(el) => {
                inputRef.current = el;
              }}
              aria-label={col.key}
              type={col.type === "number" ? "number" : "text"}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onInputKeyDown}
              onBlur={commitDraft}
              className="w-full min-w-28 rounded-card border-(length:--border-w) border-line bg-surface-raised px-2 py-1 text-xs text-text"
            />
          )}
          {invalid && (
            <span role="alert" className="text-xs text-danger">
              {invalid}
            </span>
          )}
        </div>
      ) : (
        <button
          ref={cellRef}
          type="button"
          onKeyDown={onCellKeyDown}
          onDoubleClick={col.editable ? onStartEdit : undefined}
          title={
            pending?.error ? pending.error : (editedTip ?? (col.editable ? D.cellHint : undefined))
          }
          className={cn(
            "block min-h-7 w-full text-left outline-none focus:ring-2 focus:ring-inset focus:ring-primary",
            pad,
            col.editable && "cursor-pointer",
          )}
        >
          <div className="flex items-start justify-between gap-1.5">
            <span
              className={cn(
                col.type === "longtext"
                  ? "max-w-xs whitespace-pre-wrap [overflow-wrap:anywhere]"
                  : "max-w-56 truncate",
              )}
            >
              {formatCellValue(entity, col, shownValue, timeZone)}
            </span>
            {editedTip && (
              <span
                title={editedTip}
                className="shrink-0 rounded-chip bg-surface-tint px-1.5 py-0.5 text-xs font-bold text-muted"
              >
                *<span className="sr-only"> ({D.editedBadge})</span>
              </span>
            )}
          </div>
          {pending?.error && (
            <p role="alert" className="mt-1 text-xs text-danger">
              {pending.error}
            </p>
          )}
        </button>
      )}
    </td>
  );
}
