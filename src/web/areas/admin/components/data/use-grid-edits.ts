// State perubahan tertunda, aksi massal, dan pratinjau dampak peringkat Data Grid (explore.md B18).
import type { BulkChangeResult, CellValue, GridEntity, GridRow } from "@shared/data-grid";
import {
  type ImpactBooth,
  type RankChange,
  type ReviewEdit,
  rankImpact,
} from "@shared/rank-impact";
import { useCallback, useMemo, useState } from "react";
import { copy } from "../../../../lib/copy";
import { rowDisplayName } from "./grid-format";

export interface PendingEdit {
  entity: Exclude<GridEntity, "ranking">;
  id: string;
  field: string;
  rowLabel: string;
  oldValue: CellValue;
  newValue: CellValue;
  version: number;
  /** Konteks baris review untuk pratinjau dampak peringkat (rankImpact). */
  reviewContext?: {
    boothId: string;
    origStars: number;
    origStatus: "visible" | "held" | "hidden";
  };
  error?: string;
}

export const cellKey = (entity: string, id: string, field: string) => `${entity}:${id}:${field}`;

function sameValue(a: CellValue, b: CellValue): boolean {
  return a === b || ((a === null || a === "") && (b === null || b === ""));
}

export function useGridEdits() {
  const [map, setMap] = useState<Map<string, PendingEdit>>(() => new Map());

  const stage = useCallback((edit: PendingEdit) => {
    const k = cellKey(edit.entity, edit.id, edit.field);
    setMap((prev) => {
      const next = new Map(prev);
      if (sameValue(edit.oldValue, edit.newValue)) {
        next.delete(k);
      } else {
        next.set(k, { ...edit, error: undefined });
      }
      return next;
    });
  }, []);

  const stageMany = useCallback((edits: PendingEdit[]) => {
    setMap((prev) => {
      const next = new Map(prev);
      for (const edit of edits) {
        const k = cellKey(edit.entity, edit.id, edit.field);
        if (sameValue(edit.oldValue, edit.newValue)) {
          next.delete(k);
        } else {
          next.set(k, { ...edit, error: undefined });
        }
      }
      return next;
    });
  }, []);

  const discardAll = useCallback(() => setMap(new Map()), []);

  /** Terapkan hasil bulkEdit: yang `ok` dibersihkan, yang `conflict`/`error` tetap tertunda dengan pesan. */
  const applyResults = useCallback(
    (sent: readonly PendingEdit[], results: readonly BulkChangeResult[]): number => {
      const byIdx = new Map(results.map((r) => [r.index, r]));
      let failed = 0;
      setMap((prev) => {
        const next = new Map(prev);
        sent.forEach((item, index) => {
          const k = cellKey(item.entity, item.id, item.field);
          const r = byIdx.get(index);
          if (!r || r.status === "ok") {
            next.delete(k);
            return;
          }
          failed++;
          const msg =
            r.code in copy.errors
              ? copy.errors[r.code as keyof typeof copy.errors]
              : r.status === "conflict"
                ? copy.admin.data.conflictLabel
                : r.code;
          const current = next.get(k);
          if (current) next.set(k, { ...current, error: msg });
        });
        return next;
      });
      return failed;
    },
    [],
  );

  const pendingList = useMemo(() => [...map.values()], [map]);

  return {
    pendingMap: map,
    pendingList,
    pendingCount: map.size,
    stage,
    stageMany,
    discardAll,
    applyResults,
  };
}

/** Hitung pratinjau dampak peringkat dari perubahan tertunda pada tab Review. */
export function computeRankImpact(
  rankingRows: readonly GridRow[],
  reviewRows: readonly GridRow[],
  pendingList: readonly PendingEdit[],
): RankChange[] {
  const reviewEdits = pendingList.filter(
    (e) => e.entity === "reviews" && (e.field === "stars" || e.field === "status"),
  );
  if (reviewEdits.length === 0 || rankingRows.length === 0) return [];

  const booths: ImpactBooth[] = rankingRows.map((r) => {
    const count = Number(r.values.reviewCount ?? 0);
    const avg = r.values.average === null ? 0 : Number(r.values.average);
    return {
      boothId: r.id,
      name: String(r.values.name ?? ""),
      reviewCount: count,
      starSum: Math.round(avg * count),
    };
  });

  const byRow = new Map<string, PendingEdit[]>();
  for (const e of reviewEdits) {
    const list = byRow.get(e.id) ?? [];
    list.push(e);
    byRow.set(e.id, list);
  }
  const rowLookup = new Map(reviewRows.map((r) => [r.id, r]));

  const edits: ReviewEdit[] = [];
  for (const [id, list] of byRow) {
    const row = rowLookup.get(id);
    const ctx = list[0]?.reviewContext;
    const boothId = row?.meta?.boothId ?? ctx?.boothId;
    if (!boothId) continue;

    const origStars = Number(row?.values.stars ?? ctx?.origStars ?? 0);
    const origStatus = (row?.values.status ?? ctx?.origStatus ?? "visible") as
      | "visible"
      | "held"
      | "hidden";
    const starsEdit = list.find((e) => e.field === "stars");
    const statusEdit = list.find((e) => e.field === "status");
    const nextStars = starsEdit ? Number(starsEdit.newValue) : origStars;
    const nextStatus = (statusEdit ? statusEdit.newValue : origStatus) as
      | "visible"
      | "held"
      | "hidden";

    edits.push({
      boothId,
      before: { stars: origStars, status: origStatus },
      after: { stars: nextStars, status: nextStatus },
    });
  }
  return rankImpact(booths, edits);
}

export interface BulkActionDef {
  id: string;
  label: string;
  changes: readonly { field: string; value: CellValue }[];
}

const D = copy.admin.data.bulkActions;

export const BULK_ACTIONS: Partial<Record<GridEntity, readonly BulkActionDef[]>> = {
  booths: [
    { id: "approve", label: D.approve, changes: [{ field: "status", value: "approved" }] },
    { id: "revision", label: D.revision, changes: [{ field: "status", value: "revision" }] },
    { id: "reject", label: D.reject, changes: [{ field: "status", value: "rejected" }] },
    { id: "suspend", label: D.suspend, changes: [{ field: "status", value: "suspended" }] },
  ],
  products: [
    { id: "show", label: D.showProduct, changes: [{ field: "status", value: "active" }] },
    { id: "hide", label: D.hideProduct, changes: [{ field: "status", value: "hidden" }] },
    {
      id: "remove",
      label: D.removeProduct,
      changes: [{ field: "status", value: "removed_by_admin" }],
    },
  ],
  reviews: [
    { id: "show", label: D.showReview, changes: [{ field: "status", value: "visible" }] },
    { id: "hide", label: D.hideReview, changes: [{ field: "status", value: "hidden" }] },
    {
      id: "hideComment",
      label: D.hideComment,
      changes: [{ field: "commentStatus", value: "hidden" }],
    },
    {
      id: "restore",
      label: D.restoreReview,
      changes: [
        { field: "status", value: "visible" },
        { field: "commentStatus", value: "visible" },
      ],
    },
  ],
  visitors: [
    { id: "block", label: D.blockVisitor, changes: [{ field: "blocked", value: true }] },
    { id: "unblock", label: D.unblockVisitor, changes: [{ field: "blocked", value: false }] },
  ],
};

/** Buat daftar suntingan tertunda dari baris terpilih dan aksi massal (B18). */
export function buildBulkActionEdits(
  entity: GridEntity,
  rows: readonly GridRow[],
  action: BulkActionDef,
): PendingEdit[] {
  if (entity === "ranking") return [];
  const out: PendingEdit[] = [];
  for (const row of rows) {
    const label = rowDisplayName(entity, row);
    for (const ch of action.changes) {
      out.push({
        entity,
        id: row.id,
        field: ch.field,
        rowLabel: label,
        oldValue: row.values[ch.field] ?? null,
        newValue: ch.value,
        version: row.version,
        ...(entity === "reviews" && row.meta?.boothId
          ? {
              reviewContext: {
                boothId: row.meta.boothId,
                origStars: Number(row.values.stars ?? 0),
                origStatus: (row.values.status ?? "visible") as "visible" | "held" | "hidden",
              },
            }
          : {}),
      });
    }
  }
  return out;
}
