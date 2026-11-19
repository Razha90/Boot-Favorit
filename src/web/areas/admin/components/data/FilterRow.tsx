// Baris filter per kolom untuk Data Grid (explore.md A3, B18).
import type { ColumnDef, FilterOp, GridEntity, GridFilter } from "@shared/data-grid";
import { useState } from "react";
import { copy } from "../../../../lib/copy";
import { columnLabel, optionLabel } from "./grid-format";

const D = copy.admin.data;

const inputCls =
  "w-full min-w-20 rounded-card border-(length:--border-w) border-line bg-surface-raised px-2 py-1 text-xs text-text placeholder:text-muted";

export function FilterCell({
  entity,
  col,
  filter,
  onChange,
}: {
  entity: GridEntity;
  col: ColumnDef;
  filter: GridFilter | undefined;
  onChange: (next: GridFilter | null) => void;
}) {
  const [localOp, setLocalOp] = useState<FilterOp>(col.filter === "number" ? "gte" : "gte");

  if (!col.filter) return <th className="border-b-(length:--border-w) border-line p-1" />;

  const label = `${D.filter.textPlaceholder} ${columnLabel(entity, col.key)}`;

  if (col.filter === "select") {
    return (
      <th className="border-b-(length:--border-w) border-line p-1 font-normal">
        <select
          aria-label={label}
          value={filter?.value ?? ""}
          onChange={(e) =>
            onChange(e.target.value ? { key: col.key, op: "eq", value: e.target.value } : null)
          }
          className={inputCls}
        >
          <option value="">{D.filter.all}</option>
          {(col.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {optionLabel(entity, col.key, opt)}
            </option>
          ))}
        </select>
      </th>
    );
  }

  if (col.filter === "bool") {
    return (
      <th className="border-b-(length:--border-w) border-line p-1 font-normal">
        <select
          aria-label={label}
          value={filter?.value ?? ""}
          onChange={(e) =>
            onChange(e.target.value ? { key: col.key, op: "eq", value: e.target.value } : null)
          }
          className={inputCls}
        >
          <option value="">{D.filter.all}</option>
          <option value="true">{D.values.bool.yes}</option>
          <option value="false">{D.values.bool.no}</option>
        </select>
      </th>
    );
  }

  if (col.filter === "number") {
    const op: FilterOp = filter?.op ?? localOp;
    return (
      <th className="border-b-(length:--border-w) border-line p-1 font-normal">
        <div className="flex gap-1">
          <select
            aria-label={`${label} op`}
            value={op}
            onChange={(e) => {
              const nextOp = e.target.value as FilterOp;
              setLocalOp(nextOp);
              if (filter?.value) onChange({ key: col.key, op: nextOp, value: filter.value });
            }}
            className="rounded-card border-(length:--border-w) border-line bg-surface-raised px-1 py-1 text-xs"
          >
            <option value="eq">{D.filter.opEq}</option>
            <option value="gte">{D.filter.opGte}</option>
            <option value="lte">{D.filter.opLte}</option>
          </select>
          <input
            aria-label={label}
            type="number"
            value={filter?.value ?? ""}
            placeholder={D.filter.numberPlaceholder}
            onChange={(e) =>
              onChange(e.target.value ? { key: col.key, op, value: e.target.value } : null)
            }
            className={inputCls}
          />
        </div>
      </th>
    );
  }

  if (col.filter === "date") {
    const op: FilterOp = filter?.op ?? localOp;
    const dateVal = filter?.value ? new Date(Number(filter.value)).toISOString().slice(0, 10) : "";
    const applyDate = (nextOp: FilterOp, raw: string) => {
      setLocalOp(nextOp);
      if (!raw) return onChange(null);
      const ms = Date.parse(nextOp === "lte" ? `${raw}T23:59:59.999Z` : `${raw}T00:00:00.000Z`);
      if (Number.isFinite(ms)) onChange({ key: col.key, op: nextOp, value: String(ms) });
    };
    return (
      <th className="border-b-(length:--border-w) border-line p-1 font-normal">
        <div className="flex gap-1">
          <select
            aria-label={`${label} op`}
            value={op}
            onChange={(e) => applyDate(e.target.value as FilterOp, dateVal)}
            className="rounded-card border-(length:--border-w) border-line bg-surface-raised px-1 py-1 text-xs"
          >
            <option value="gte">{D.filter.opGte}</option>
            <option value="lte">{D.filter.opLte}</option>
          </select>
          <input
            aria-label={label}
            type="date"
            value={dateVal}
            onChange={(e) => applyDate(op, e.target.value)}
            className={inputCls}
          />
        </div>
      </th>
    );
  }

  return (
    <th className="border-b-(length:--border-w) border-line p-1 font-normal">
      <input
        aria-label={label}
        type="text"
        value={filter?.value ?? ""}
        placeholder={D.filter.textPlaceholder}
        onChange={(e) =>
          onChange(
            e.target.value.trim() ? { key: col.key, op: "contains", value: e.target.value } : null,
          )
        }
        className={inputCls}
      />
    </th>
  );
}
