// Mesin kueri Data Grid (explore.md B18). Aman karena: (1) entity, kolom sortir, kolom filter, dan operator HANYA dari
// whitelist (`GRID_COLUMNS` + peta kolom per entity); (2) identitas kolom ditulis di kode (`sql.raw` dari konstanta),
// tidak pernah dari masukan; (3) semua NILAI dari pengguna diikat sebagai parameter. Paginasi keyset (sortir + id), bukan OFFSET.

import {
  type CellValue,
  columnOf,
  type GridFilter,
  type GridPage,
  type GridQuery,
  type GridRow,
  type GridSummary,
  OPS_BY_KIND,
} from "@shared/data-grid";
import { ApiError } from "@shared/errors";
import { type SQL, sql } from "drizzle-orm";
import type { Db } from "../../lib/db";

export type ColKind = "text" | "number" | "bool" | "date";

export interface SqlCol {
  /** Ungkapan SQL (konstanta di kode) */
  expr: SQL;
  kind: ColKind;
}

export interface EntitySpec {
  entity: "booths" | "products" | "reviews" | "visitors";
  /** Klausa FROM lengkap dengan JOIN (konstanta) */
  from: SQL;
  /** Kondisi wajib: selalu menyertakan event_id */
  scope: (eventId: string) => SQL;
  id: SQL;
  version: SQL;
  cols: Record<string, SqlCol>;
  /** Kolom teks untuk pencarian global `q` */
  search: SQL[];
  status?: SQL;
  stars?: SQL;
  /** Id booth baris ini (untuk pratinjau dampak peringkat di klien) */
  boothId?: SQL;
  defaultSort: { key: string; dir: "asc" | "desc" };
  /** Pasca-olah nilai (kolom hasil hitung di JS, konversi tipe) */
  finish?: (values: Record<string, CellValue>, raw: Record<string, unknown>) => void;
}

const bad = (m: string) => new ApiError("validation_error", m);

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Ungkapan urut yang tidak pernah NULL, supaya kursor keyset sederhana dan stabil. */
function sortExpr(c: SqlCol): SQL {
  if (c.kind === "text") return sql`COALESCE(LOWER(${c.expr}), '')`;
  return sql`COALESCE(${c.expr}, 0)`;
}

function numberOf(v: string): number {
  const n = Number(v);
  if (v.trim() === "" || !Number.isFinite(n)) throw bad("invalid_filter_value");
  return n;
}

/** Satu filter → kondisi SQL, setelah dicek terhadap whitelist kolom dan operator per jenis. */
function condition(spec: EntitySpec, f: GridFilter): SQL {
  const col = spec.cols[f.key];
  const def = columnOf(spec.entity, f.key);
  if (!col || !def?.filter) throw bad("filter_not_allowed");
  if (!OPS_BY_KIND[def.filter].includes(f.op)) throw bad("filter_op_not_allowed");

  switch (def.filter) {
    case "text":
      return f.op === "eq"
        ? sql`LOWER(${col.expr}) = LOWER(${f.value})`
        : sql`${col.expr} LIKE ${`%${escapeLike(f.value)}%`} ESCAPE '\\'`;
    case "number":
      return f.op === "eq"
        ? sql`${col.expr} = ${numberOf(f.value)}`
        : f.op === "gte"
          ? sql`${col.expr} >= ${numberOf(f.value)}`
          : sql`${col.expr} <= ${numberOf(f.value)}`;
    case "date":
      return f.op === "gte"
        ? sql`${col.expr} >= ${numberOf(f.value)}`
        : sql`${col.expr} <= ${numberOf(f.value)}`;
    case "bool":
      return sql`${col.expr} = ${f.value === "true" || f.value === "1" ? 1 : 0}`;
    case "select": {
      const allowed = new Set(def.options ?? []);
      const values = (f.op === "in" ? f.value.split(",") : [f.value]).filter((v) => allowed.has(v));
      if (values.length === 0) throw bad("filter_value_not_allowed");
      return values.length === 1
        ? sql`${col.expr} = ${values[0]}`
        : sql`${col.expr} IN (${sql.join(
            values.map((v) => sql`${v}`),
            sql`, `,
          )})`;
    }
  }
}

const and = (parts: SQL[]): SQL => sql.join(parts, sql` AND `);

export function whereOf(spec: EntitySpec, eventId: string, q: GridQuery): SQL {
  const parts: SQL[] = [spec.scope(eventId)];
  for (const f of q.filters) parts.push(condition(spec, f));
  if (q.q) {
    const like = `%${escapeLike(q.q)}%`;
    parts.push(
      sql`(${sql.join(
        spec.search.map((e) => sql`${e} LIKE ${like} ESCAPE '\\'`),
        sql` OR `,
      )})`,
    );
  }
  return and(parts);
}

// ---------- Kursor ----------

const enc = (v: [string | number, string]) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(v))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

function dec(raw: string): [string | number, string] {
  try {
    const padded = raw
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(raw.length / 4) * 4, "=");
    const v = JSON.parse(
      new TextDecoder().decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))),
    ) as unknown;
    if (
      Array.isArray(v) &&
      v.length === 2 &&
      (typeof v[0] === "string" || typeof v[0] === "number") &&
      typeof v[1] === "string"
    ) {
      return [v[0], v[1]];
    }
  } catch {
    // jatuh ke galat di bawah
  }
  throw bad("invalid_cursor");
}

const num = (v: unknown): number => (typeof v === "number" ? v : Number(v ?? 0));

export async function runGrid(
  db: Db,
  spec: EntitySpec,
  eventId: string,
  q: GridQuery,
): Promise<GridPage> {
  const sortKey = q.sort ?? spec.defaultSort.key;
  const dir = q.sort ? q.dir : spec.defaultSort.dir;
  const sortDef = columnOf(spec.entity, sortKey);
  const sortCol = spec.cols[sortKey];
  if (!sortCol || !sortDef?.sortable) throw bad("sort_not_allowed");

  const S = sortExpr(sortCol);
  const where = whereOf(spec, eventId, q);
  const parts: SQL[] = [where];
  if (q.cursor) {
    const [v, cid] = dec(q.cursor);
    const cmp = dir === "asc" ? sql`>` : sql`<`;
    parts.push(sql`(${S} ${cmp} ${v} OR (${S} = ${v} AND ${spec.id} ${cmp} ${cid}))`);
  }
  const order = dir === "asc" ? sql`ASC` : sql`DESC`;
  const select = sql.join(
    [
      sql`${spec.id} AS _id`,
      sql`${spec.version} AS _version`,
      sql`${S} AS _sort`,
      ...(spec.boothId ? [sql`${spec.boothId} AS _booth`] : []),
      ...Object.entries(spec.cols).map(([k, c]) => sql`${c.expr} AS ${sql.raw(`c_${k}`)}`),
    ],
    sql`, `,
  );
  const rowsRaw = (await db.all(
    sql`SELECT ${select} ${spec.from} WHERE ${and(parts)} ORDER BY ${S} ${order}, ${spec.id} ${order} LIMIT ${q.limit + 1}`,
  )) as Record<string, unknown>[];

  const page = rowsRaw.slice(0, q.limit);
  const rows: GridRow[] = page.map((raw) => {
    const values: Record<string, CellValue> = {};
    for (const [k, c] of Object.entries(spec.cols)) {
      const v = raw[`c_${k}`];
      values[k] =
        v === undefined || v === null
          ? null
          : c.kind === "bool"
            ? v === 1 || v === true
            : (v as CellValue);
    }
    spec.finish?.(values, raw);
    return {
      id: String(raw._id),
      version: num(raw._version),
      values,
      ...(spec.boothId ? { meta: { boothId: String(raw._booth) } } : {}),
    };
  });
  const last = page[page.length - 1];
  const next =
    rowsRaw.length > q.limit && last
      ? enc([last._sort as string | number, String(last._id)])
      : null;

  return { rows, next, summary: await summarize(db, spec, where) };
}

async function summarize(db: Db, spec: EntitySpec, where: SQL): Promise<GridSummary> {
  const total = (await db.all(sql`SELECT COUNT(*) AS n ${spec.from} WHERE ${where}`)) as {
    n: number;
  }[];
  const stars = spec.stars
    ? ((await db.all(sql`SELECT AVG(${spec.stars}) AS a ${spec.from} WHERE ${where}`)) as {
        a: number | null;
      }[])
    : [];
  const byStatus: Record<string, number> = {};
  if (spec.status) {
    const rows = (await db.all(
      sql`SELECT ${spec.status} AS s, COUNT(*) AS n ${spec.from} WHERE ${where} GROUP BY ${spec.status}`,
    )) as { s: string; n: number }[];
    for (const r of rows) byStatus[String(r.s)] = num(r.n);
  }
  return {
    total: num(total[0]?.n),
    avgStars: stars[0]?.a === undefined || stars[0].a === null ? null : num(stars[0].a),
    byStatus,
  };
}
