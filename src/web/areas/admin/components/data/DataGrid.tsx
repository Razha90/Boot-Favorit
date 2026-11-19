// Komponen Data Grid generik ala Excel (explore.md A3 langkah 8, B18).
import {
  type BulkChangeResult,
  type CellValue,
  GRID_COLUMNS,
  type GridEntity,
  type GridFilter,
  type GridRow,
} from "@shared/data-grid";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { ActionButton } from "../../../../components/ui/ActionButton";
import { Button, buttonStyles } from "../../../../components/ui/Button";
import { Badge, Card } from "../../../../components/ui/Card";
import { Input } from "../../../../components/ui/Form";
import { Icon } from "../../../../components/ui/Icon";
import { QueryState } from "../../../../components/ui/states";
import { cn } from "../../../../lib/cn";
import { copy } from "../../../../lib/copy";
import { formatAverage } from "../../../../lib/format";
import { createSafeStorage } from "../../../../lib/safe-storage";
import { adminApi, adminKeys } from "../../api";
import { dataApi, dataKeys } from "../../data-api";
import { ChangeReviewDialog } from "./ChangeReviewDialog";
import { DataCell } from "./DataCell";
import { FilterCell } from "./FilterRow";
import { columnLabel, optionLabel, rowDisplayName } from "./grid-format";
import {
  BULK_ACTIONS,
  buildBulkActionEdits,
  cellKey,
  type PendingEdit,
  useGridEdits,
} from "./use-grid-edits";

const D = copy.admin.data;
const store = createSafeStorage();

function readHiddenCols(entity: GridEntity): Set<string> {
  try {
    const raw = store.get(`adminGrid:cols:${entity}`);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return new Set(parsed.filter((x) => typeof x === "string"));
    }
  } catch {
    // abaikan penyimpanan rusak
  }
  return new Set();
}

export function DataGrid({
  eventId,
  entity,
  timeZone,
  rankingRows,
}: {
  eventId: string;
  entity: GridEntity;
  timeZone: string;
  rankingRows: readonly GridRow[];
}) {
  const qc = useQueryClient();
  const allCols = GRID_COLUMNS[entity];

  const [q, setQ] = useState("");
  const [sort, setSort] = useState<string | undefined>(undefined);
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [filters, setFilters] = useState<GridFilter[]>([]);
  const [density, setDensity] = useState<"comfortable" | "compact">(() =>
    store.get("adminGrid:density") === "compact" ? "compact" : "comfortable",
  );
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() => readHiddenCols(entity));
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [lastIdx, setLastIdx] = useState<number | null>(null);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addingBooth, setAddingBooth] = useState(false);
  const [newBoothName, setNewBoothName] = useState("");

  const cellRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const edits = useGridEdits();

  // Reset sortir/filter/seleksi saat berpindah tab (perubahan tertunda tetap disimpan di useGridEdits).
  useEffect(() => {
    setQ("");
    setSort(undefined);
    setDir("asc");
    setFilters([]);
    setSelected(new Set());
    setLastIdx(null);
    setEditingCell(null);
    setHiddenCols(readHiddenCols(entity));
  }, [entity]);

  const queryParams = useMemo(
    () => ({
      ...(sort ? { sort, dir } : {}),
      q: q.trim() || undefined,
      filters,
    }),
    [sort, dir, q, filters],
  );

  const grid = useInfiniteQuery({
    queryKey: dataKeys.grid(eventId, entity, queryParams),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      dataApi.query(eventId, entity, { ...queryParams, cursor: pageParam }),
    getNextPageParam: (last) => last.next ?? undefined,
  });

  const rows = useMemo(() => grid.data?.pages.flatMap((p) => p.rows) ?? [], [grid.data]);
  const summary = grid.data?.pages[0]?.summary;
  const visibleCols = useMemo(
    () => allCols.filter((c) => !hiddenCols.has(c.key)),
    [allCols, hiddenCols],
  );
  const filterMap = useMemo(() => new Map(filters.map((f) => [f.key, f])), [filters]);

  const toggleCol = (key: string) => {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else if (visibleCols.length > 1) next.add(key); // minimal 1 kolom tampil
      store.set(`adminGrid:cols:${entity}`, JSON.stringify([...next]));
      return next;
    });
  };

  const toggleDensity = () => {
    const next = density === "comfortable" ? "compact" : "comfortable";
    setDensity(next);
    store.set("adminGrid:density", next);
  };

  const toggleSort = (key: string) => {
    if (sort === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(key);
      setDir("asc");
    }
  };

  const setFilter = (key: string, next: GridFilter | null) => {
    setFilters((prev) => {
      const rest = prev.filter((f) => f.key !== key);
      return next ? [...rest, next] : rest;
    });
  };

  const toggleSelectRow = (idx: number, id: string, e: MouseEvent<HTMLInputElement>) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (e.shiftKey && lastIdx !== null) {
        const [a, b] = [Math.min(lastIdx, idx), Math.max(lastIdx, idx)];
        const add = !prev.has(id);
        for (let i = a; i <= b; i++) {
          const rid = rows[i]?.id;
          if (rid) add ? next.add(rid) : next.delete(rid);
        }
      } else {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }
      return next;
    });
    setLastIdx(idx);
  };

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  };

  const navigateCell = (rIdx: number, cIdx: number, dr: number, dc: number) => {
    let nr = rIdx + dr;
    let nc = cIdx + dc;
    if (nc >= visibleCols.length) {
      nc = 0;
      nr++;
    } else if (nc < 0) {
      nc = visibleCols.length - 1;
      nr--;
    }
    const targetRow = rows[nr];
    const targetCol = visibleCols[nc];
    if (!targetRow || !targetCol) return;
    cellRefs.current.get(`${targetRow.id}:${targetCol.key}`)?.focus();
  };

  const stageCell = (row: GridRow, key: string, value: CellValue) => {
    if (entity === "ranking") return;
    edits.stage({
      entity,
      id: row.id,
      field: key,
      rowLabel: rowDisplayName(entity, row),
      oldValue: row.values[key] ?? null,
      newValue: value,
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
  };

  const onSaved = async (sent: readonly PendingEdit[], results: readonly BulkChangeResult[]) => {
    edits.applyResults(sent, results);
    await qc.invalidateQueries({ queryKey: dataKeys.allGrid(eventId) });
    await qc.invalidateQueries({ queryKey: adminKeys.booths(eventId) });
    await qc.invalidateQueries({ queryKey: adminKeys.event(eventId) });
  };

  const selectedRows = rows.filter((r) => selected.has(r.id));
  const bulkActions = BULK_ACTIONS[entity] ?? [];
  const exportHref = dataApi.exportUrl(eventId, entity, queryParams);

  return (
    <Card className="gap-3">
      {/* Toolbar atas */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label={D.search}
            value={q}
            placeholder={D.searchPlaceholder}
            onChange={(e) => setQ(e.target.value)}
            className="w-56"
          />
          {filters.length > 0 && (
            <Button size="sm" onClick={() => setFilters([])}>
              {D.filter.clear}
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {entity === "booths" && (
            <Button size="sm" onClick={() => setAddingBooth((v) => !v)}>
              {D.addBooth}
            </Button>
          )}
          <Button size="sm" onClick={toggleDensity}>
            {D.density}: {density === "comfortable" ? D.comfortable : D.compact}
          </Button>
          <details className="relative">
            <summary className={cn(buttonStyles({ size: "sm" }), "cursor-pointer list-none")}>
              {D.columnsButton} ({visibleCols.length}/{allCols.length})
            </summary>
            <div className="absolute right-0 z-20 mt-1 grid max-h-72 w-56 gap-1 overflow-y-auto rounded-card border-(length:--border-w) border-line bg-surface-raised p-2 shadow-card">
              {allCols.map((c) => (
                <label key={c.key} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={!hiddenCols.has(c.key)}
                    onChange={() => toggleCol(c.key)}
                  />
                  {columnLabel(entity, c.key)}
                </label>
              ))}
            </div>
          </details>
          <a href={exportHref} download className={buttonStyles({ size: "sm" })}>
            {D.exportCsv}
          </a>
        </div>
      </div>

      {/* Baris tambah booth cepat (A3, B26) */}
      {entity === "booths" && addingBooth && (
        <form className="flex flex-wrap items-center gap-2 rounded-card border-(length:--border-w) border-line bg-surface-tint p-2">
          <Input
            aria-label={D.addBooth}
            value={newBoothName}
            placeholder={D.addBoothPlaceholder}
            onChange={(e) => setNewBoothName(e.target.value)}
            className="max-w-xs"
          />
          <ActionButton
            type="submit"
            size="sm"
            variant="primary"
            disabled={newBoothName.trim() === ""}
            resetOn={newBoothName}
            action={async (ctx) => {
              await adminApi.createBooth(eventId, { name: newBoothName.trim() }, ctx);
              setNewBoothName("");
              setAddingBooth(false);
              await qc.invalidateQueries({ queryKey: dataKeys.allGrid(eventId) });
              await qc.invalidateQueries({ queryKey: adminKeys.booths(eventId) });
            }}
          >
            {D.addBoothSubmit}
          </ActionButton>
        </form>
      )}

      {/* Bar perubahan tertunda */}
      {edits.pendingCount > 0 && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-card border-(length:--border-w) border-warning bg-accent/20 px-3 py-2 text-sm"
        >
          <span className="font-bold">{D.pendingBar(edits.pendingCount)}</span>
          <div className="flex gap-2">
            <Button size="sm" onClick={edits.discardAll}>
              {D.discardAll}
            </Button>
            <Button size="sm" variant="primary" onClick={() => setDialogOpen(true)}>
              {D.saveChanges}
            </Button>
          </div>
        </div>
      )}

      {/* Bar aksi massal baris terpilih */}
      {selected.size > 0 && bulkActions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-card border-(length:--border-w) border-line bg-surface-tint px-3 py-2 text-xs">
          <span className="font-bold">{D.selectedCount(selected.size)}</span>
          {bulkActions.map((act) => (
            <Button
              key={act.id}
              size="sm"
              onClick={() => {
                edits.stageMany(buildBulkActionEdits(entity, selectedRows, act));
                setSelected(new Set());
              }}
            >
              {act.label}
            </Button>
          ))}
        </div>
      )}

      {/* Tabel */}
      <QueryState loading={grid.isLoading} error={grid.error}>
        <div className="max-h-[65vh] overflow-auto rounded-card border-(length:--border-w) border-line">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-surface-tint text-xs">
              <tr>
                {entity !== "ranking" && (
                  <th className="w-8 border-b-(length:--border-w) border-line px-2 py-2">
                    <input
                      type="checkbox"
                      aria-label={D.selectAll}
                      checked={allSelected}
                      onChange={toggleSelectAll}
                    />
                  </th>
                )}
                {visibleCols.map((col, idx) => (
                  <th
                    key={col.key}
                    className={cn(
                      "whitespace-nowrap border-b-(length:--border-w) border-line px-3 py-2 font-bold",
                      idx === 0 && "sticky left-0 z-20 bg-surface-tint",
                    )}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className="group inline-flex items-center gap-1 hover:text-primary-strong"
                      >
                        <span>{columnLabel(entity, col.key)}</span>
                        {sort === col.key && (
                          <Icon
                            name={dir === "asc" ? "arrow-up" : "arrow-down"}
                            className="size-3.5"
                          />
                        )}
                      </button>
                    ) : (
                      columnLabel(entity, col.key)
                    )}
                  </th>
                ))}
                {entity !== "ranking" && (
                  <th className="whitespace-nowrap border-b-(length:--border-w) border-line px-3 py-2 font-bold">
                    {D.actionsCol}
                  </th>
                )}
              </tr>
              {entity !== "ranking" && (
                <tr className="bg-surface">
                  <th className="border-b-(length:--border-w) border-line p-1" />
                  {visibleCols.map((col) => (
                    <FilterCell
                      key={col.key}
                      entity={entity}
                      col={col}
                      filter={filterMap.get(col.key)}
                      onChange={(next) => setFilter(col.key, next)}
                    />
                  ))}
                  <th className="border-b-(length:--border-w) border-line p-1" />
                </tr>
              )}
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleCols.length + (entity === "ranking" ? 0 : 2)}
                    className="px-3 py-6 text-center text-sm text-muted"
                  >
                    {D.empty}
                  </td>
                </tr>
              ) : (
                rows.map((row, rIdx) => (
                  <tr key={row.id} className="even:bg-surface/60">
                    {entity !== "ranking" && (
                      <td className="border-b-(length:--border-w) border-line px-2 py-2 align-top">
                        <input
                          type="checkbox"
                          aria-label={D.selectRow(String(row.values.name ?? row.id))}
                          checked={selected.has(row.id)}
                          onClick={(e) => toggleSelectRow(rIdx, row.id, e)}
                          onChange={() => {}}
                        />
                      </td>
                    )}
                    {visibleCols.map((col, cIdx) => {
                      const k = cellKey(entity, row.id, col.key);
                      return (
                        <DataCell
                          key={col.key}
                          entity={entity}
                          row={row}
                          col={col}
                          timeZone={timeZone}
                          density={density}
                          sticky={cIdx === 0}
                          pending={edits.pendingMap.get(k)}
                          editing={editingCell === k}
                          onStartEdit={() => setEditingCell(k)}
                          onStopEdit={() => setEditingCell((cur) => (cur === k ? null : cur))}
                          onCommit={(val) => stageCell(row, col.key, val)}
                          onNavigate={(dr, dc) => navigateCell(rIdx, cIdx, dr, dc)}
                          cellRef={(el) => {
                            const refKey = `${row.id}:${col.key}`;
                            if (el) cellRefs.current.set(refKey, el);
                            else cellRefs.current.delete(refKey);
                          }}
                        />
                      );
                    })}
                    {entity !== "ranking" && (
                      <td className="whitespace-nowrap border-b-(length:--border-w) border-line px-3 py-2 align-top text-xs">
                        <div className="flex gap-2">
                          <Link
                            to={`/admin/e/${eventId}/logs?target=${encodeURIComponent(row.id)}`}
                            className="text-primary-strong underline"
                          >
                            {D.history}
                          </Link>
                          {entity === "booths" && (
                            <Link
                              to={`/admin/e/${eventId}/booths/${row.id}`}
                              className="text-muted underline"
                            >
                              {D.openBooth}
                            </Link>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </QueryState>

      {/* Footer ringkasan + Muat lebih banyak */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <div className="flex flex-wrap items-center gap-2">
          {summary && <span>{D.summary.total(summary.total)}</span>}
          {summary?.avgStars !== null && summary?.avgStars !== undefined && (
            <span>· {D.summary.avgStars(formatAverage(summary.avgStars))}</span>
          )}
          {summary &&
            Object.entries(summary.byStatus).map(([st, count]) => (
              <Badge key={st} tone="muted">
                {optionLabel(entity, "status", st)}: {count}
              </Badge>
            ))}
        </div>
        {grid.hasNextPage && (
          <Button size="sm" disabled={grid.isFetchingNextPage} onClick={() => grid.fetchNextPage()}>
            {grid.isFetchingNextPage ? copy.admin.common.loading : D.loadMore}
          </Button>
        )}
      </div>

      <ChangeReviewDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        eventId={eventId}
        timeZone={timeZone}
        pending={edits.pendingList}
        rankingRows={rankingRows}
        reviewRows={entity === "reviews" ? rows : []}
        onSaved={onSaved}
      />
    </Card>
  );
}
