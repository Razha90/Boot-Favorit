// Pembantu pemformatan Data Grid (label kolom, label opsi, format sel, dan tooltip moderasi).
import type { CellValue, ColumnDef, GridEntity, GridRow } from "@shared/data-grid";
import { copy } from "../../../../lib/copy";
import { formatAverage, formatDateTime, formatRupiah, formatScore } from "../../../../lib/format";

const D = copy.admin.data;

const VALUE_MAPS: Record<string, Record<string, Record<string, string>>> = {
  booths: {
    owner: D.values.owner,
    completeness: D.values.completeness,
    status: D.values.boothStatus,
    createdBy: D.values.createdBy,
  },
  products: {
    badge: D.values.badge,
    status: D.values.productStatus,
  },
  reviews: {
    provider: D.values.provider,
    status: D.values.reviewStatus,
    commentStatus: D.values.commentStatus,
  },
  visitors: {
    provider: D.values.provider,
  },
};

export function columnLabel(entity: GridEntity, key: string): string {
  return D.columns[entity]?.[key] ?? key;
}

export function optionLabel(entity: GridEntity, key: string, value: string): string {
  return VALUE_MAPS[entity]?.[key]?.[value] ?? value;
}

export function formatCellValue(
  entity: GridEntity,
  col: ColumnDef,
  value: CellValue,
  timeZone: string,
): string {
  if (value === null || value === undefined || value === "") return copy.admin.common.none;
  if (col.type === "bool") return value ? D.values.bool.yes : D.values.bool.no;
  if (col.type === "select") return optionLabel(entity, col.key, String(value));
  if (col.type === "datetime") {
    return typeof value === "number" ? formatDateTime(value, timeZone) : copy.admin.common.none;
  }
  if (col.type === "stars") return `★ ${value}`;
  if (col.type === "number" && typeof value === "number") {
    if (col.key === "priceIdr" || col.key === "comparePriceIdr") return formatRupiah(value);
    if (col.key === "average") return formatAverage(value);
    if (col.key === "score" || col.key === "gap") return formatScore(value);
    return new Intl.NumberFormat("id-ID").format(value);
  }
  return String(value);
}

export function rowDisplayName(entity: GridEntity, row: GridRow): string {
  const v = row.values;
  if (entity === "booths" || entity === "products" || entity === "ranking") {
    return String(v.name ?? row.id.slice(0, 8));
  }
  if (entity === "visitors") {
    return String(v.displayName ?? v.hash ?? row.id.slice(0, 8));
  }
  const booth = v.boothName ? String(v.boothName) : row.id.slice(0, 8);
  const who = v.visitorName ? String(v.visitorName) : copy.event.reviews.anonymous;
  return `${booth} · ${who}`;
}

export function reviewEditedTooltip(row: GridRow, timeZone: string): string | null {
  const by = row.values.moderatedBy ? String(row.values.moderatedBy) : "";
  const atNum = typeof row.values.moderatedAt === "number" ? row.values.moderatedAt : null;
  const reason = row.values.moderationReason ? String(row.values.moderationReason) : "";
  const origStars = row.values.originalStars;
  const origComment = row.values.originalComment;
  if (!by && origStars === null && origComment === null) return null;

  const origParts: string[] = [];
  if (origStars !== null && origStars !== undefined) origParts.push(`★${origStars}`);
  if (origComment !== null && origComment !== undefined) origParts.push(`"${String(origComment)}"`);
  const orig = origParts.length > 0 ? origParts.join(" ") : copy.admin.common.none;
  const at = atNum ? formatDateTime(atNum, timeZone) : "";
  return D.editedTooltip(orig, by, at, reason);
}
