// Dialog simpan massal Data Grid (explore.md A3 langkah 8, B18): daftar sebelum→sesudah, alasan wajib, pratinjau peringkat.
import { CONFIG } from "@shared/config";
import { type BulkChangeResult, columnOf, type GridEntity, type GridRow } from "@shared/data-grid";
import { useState } from "react";
import { ActionButton } from "../../../../components/ui/ActionButton";
import { Button } from "../../../../components/ui/Button";
import { Field, Textarea } from "../../../../components/ui/Form";
import { Modal } from "../../../../components/ui/Modal";
import { useToast } from "../../../../components/ui/Toast";
import { copy } from "../../../../lib/copy";
import { dataApi } from "../../data-api";
import { columnLabel, formatCellValue } from "./grid-format";
import { computeRankImpact, type PendingEdit } from "./use-grid-edits";

const D = copy.admin.data;

export function ChangeReviewDialog({
  open,
  onClose,
  eventId,
  timeZone,
  pending,
  rankingRows,
  reviewRows,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  eventId: string;
  timeZone: string;
  pending: readonly PendingEdit[];
  rankingRows: readonly GridRow[];
  reviewRows: readonly GridRow[];
  onSaved: (sent: readonly PendingEdit[], results: readonly BulkChangeResult[]) => void;
}) {
  const { push } = useToast();
  const [reason, setReason] = useState("");
  const [atomic, setAtomic] = useState(false);
  const [locked, setLocked] = useState(false);

  const trimmed = reason.trim();
  const reasonValid = trimmed.length >= CONFIG.registration.adminReasonMinLength;
  const hasReviewChanges = pending.some(
    (p) => p.entity === "reviews" && (p.field === "stars" || p.field === "status"),
  );
  const impact = hasReviewChanges ? computeRankImpact(rankingRows, reviewRows, pending) : [];
  const formatRank = (r: number | null) => (r === null ? D.dialog.unranked : `#${r}`);

  const fmt = (entity: GridEntity, field: string, value: PendingEdit["oldValue"]) => {
    const col = columnOf(entity, field);
    return col ? formatCellValue(entity, col, value, timeZone) : String(value ?? "");
  };

  return (
    <Modal open={open} onClose={onClose} title={D.dialog.title} locked={locked}>
      <div className="grid max-h-96 gap-3 overflow-y-auto pr-1">
        <ul className="grid gap-1.5 text-xs">
          {pending.map((p) => (
            <li
              key={`${p.entity}:${p.id}:${p.field}`}
              className="rounded-card border-(length:--border-w) border-line bg-surface p-2"
            >
              <div className="font-bold">
                {D.tabs[p.entity]} · {p.rowLabel} · {columnLabel(p.entity, p.field)}
              </div>
              <div className="text-muted">
                {fmt(p.entity, p.field, p.oldValue)} →{" "}
                <span className="font-semibold text-text">
                  {fmt(p.entity, p.field, p.newValue)}
                </span>
              </div>
              {p.error && <div className="mt-1 text-danger">{p.error}</div>}
            </li>
          ))}
        </ul>

        {hasReviewChanges && (
          <div className="grid gap-1 rounded-card border-(length:--border-w) border-line bg-surface-tint p-3 text-xs">
            <div className="font-bold">{D.dialog.impactTitle}</div>
            {impact.length === 0 ? (
              <p className="text-muted">{D.dialog.impactNone}</p>
            ) : (
              <ul className="grid gap-1">
                {impact.map((c) => (
                  <li key={c.boothId} className="font-medium">
                    {D.dialog.impactLine(c.name, formatRank(c.before), formatRank(c.after))}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-muted">{D.dialog.impactNote}</p>
          </div>
        )}

        <Field
          label={D.dialog.reason}
          info={D.dialog.reasonInfo}
          error={trimmed.length > 0 && !reasonValid ? D.dialog.reasonError : null}
        >
          {(fid) => (
            <Textarea
              id={fid}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={locked}
              rows={2}
            />
          )}
        </Field>

        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={atomic}
            onChange={(e) => setAtomic(e.target.checked)}
            disabled={locked}
          />
          {D.dialog.atomic}
        </label>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={onClose} disabled={locked}>
          {copy.states.cancel}
        </Button>
        <ActionButton
          variant="primary"
          disabled={!reasonValid || pending.length === 0}
          resetOn={`${trimmed}|${atomic}|${pending.length}`}
          onStatusChange={(s) => setLocked(s === "pending")}
          action={async (ctx) => {
            const sent = [...pending];
            const res = await dataApi.bulkEdit(
              eventId,
              {
                reason: trimmed,
                atomic,
                changes: sent.map((c) => ({
                  entity: c.entity,
                  id: c.id,
                  field: c.field,
                  value: c.newValue,
                  version: c.version,
                })),
              },
              ctx,
            );
            const failed = res.results.filter((r) => r.status !== "ok").length;
            push(D.dialog.resultSummary(res.applied, failed), failed > 0 ? "danger" : "success");
            onSaved(sent, res.results);
            if (failed === 0) {
              setReason("");
              onClose();
            }
          }}
        >
          {D.dialog.confirm}
        </ActionButton>
      </div>
    </Modal>
  );
}
