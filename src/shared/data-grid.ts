// Definisi Data Grid admin (explore.md A3 langkah 8, B18): SATU sumber kolom, tipe, dan kolom yang boleh disunting.
// Server memakainya sebagai whitelist (kolom sortir, filter, sunting); klien memakainya untuk merender sel dan editor.
// Label kolom ada di lib/copy.ts (teks UI hanya di sana).

import { z } from "zod";
import { CONFIG } from "./config";
import {
  adminReviewPatchSchema,
  boothOwnerSchema,
  productPatchSchema,
  updateBoothSchema,
} from "./schemas";

export const GRID_ENTITIES = ["booths", "products", "reviews", "visitors", "ranking"] as const;
export type GridEntity = (typeof GRID_ENTITIES)[number];

export type ColumnType =
  | "text"
  | "longtext"
  | "number"
  | "stars"
  | "select"
  | "datetime"
  | "bool"
  | "hash";
export type FilterKind = "text" | "number" | "select" | "date" | "bool";

export interface ColumnDef {
  key: string;
  type: ColumnType;
  sortable?: boolean;
  filter?: FilterKind;
  editable?: boolean;
  /** Nilai yang sah untuk kolom `select` (juga untuk filter pilihan) */
  options?: readonly string[];
}

const BOOTH_STATUS = ["pending", "approved", "rejected", "revision", "suspended"] as const;
const PRODUCT_STATUS = ["active", "hidden", "removed_by_admin"] as const;
const REVIEW_STATUS = ["visible", "held", "hidden"] as const;
const COMMENT_STATUS = ["visible", "masked", "held", "hidden"] as const;
const PROVIDERS = ["google", "email", "ticket", "anon"] as const;

export const GRID_COLUMNS: Record<GridEntity, readonly ColumnDef[]> = {
  booths: [
    { key: "boothNo", type: "text", sortable: true, filter: "text", editable: true },
    { key: "name", type: "text", sortable: true, filter: "text", editable: true },
    { key: "email", type: "text", sortable: true, filter: "text", editable: true },
    { key: "owner", type: "select", filter: "select", options: ["none", "invited", "active"] },
    {
      key: "completeness",
      type: "select",
      sortable: true,
      filter: "select",
      options: ["name_only", "partial", "full"],
    },
    {
      key: "status",
      type: "select",
      sortable: true,
      filter: "select",
      editable: true,
      options: BOOTH_STATUS,
    },
    { key: "isLate", type: "bool", sortable: true, filter: "bool" },
    {
      key: "createdBy",
      type: "select",
      sortable: true,
      filter: "select",
      options: ["self", "admin"],
    },
    { key: "tagline", type: "text", sortable: true, filter: "text", editable: true },
    { key: "description", type: "longtext", filter: "text", editable: true },
    { key: "rejectReason", type: "text", filter: "text" },
    { key: "approvedBy", type: "text", sortable: true, filter: "text" },
    { key: "createdAt", type: "datetime", sortable: true, filter: "date" },
    { key: "reviewCount", type: "number", sortable: true, filter: "number" },
    { key: "average", type: "number", sortable: true, filter: "number" },
    { key: "score", type: "number" },
    { key: "rank", type: "number" },
  ],
  products: [
    { key: "boothName", type: "text", sortable: true, filter: "text" },
    { key: "name", type: "text", sortable: true, filter: "text", editable: true },
    { key: "category", type: "text", sortable: true, filter: "text" },
    { key: "priceIdr", type: "number", sortable: true, filter: "number", editable: true },
    { key: "comparePriceIdr", type: "number", sortable: true, filter: "number" },
    { key: "badge", type: "select", filter: "select", options: ["limited", "new"] },
    { key: "isFeatured", type: "bool", sortable: true, filter: "bool" },
    {
      key: "status",
      type: "select",
      sortable: true,
      filter: "select",
      editable: true,
      options: PRODUCT_STATUS,
    },
    { key: "description", type: "longtext", filter: "text", editable: true },
    { key: "createdAt", type: "datetime", sortable: true, filter: "date" },
  ],
  reviews: [
    { key: "boothName", type: "text", sortable: true, filter: "text" },
    { key: "visitorName", type: "text", sortable: true, filter: "text" },
    { key: "provider", type: "select", filter: "select", options: PROVIDERS },
    { key: "visitorHash", type: "hash" },
    { key: "stars", type: "stars", sortable: true, filter: "number", editable: true },
    { key: "comment", type: "longtext", filter: "text", editable: true },
    {
      key: "status",
      type: "select",
      sortable: true,
      filter: "select",
      editable: true,
      options: REVIEW_STATUS,
    },
    {
      key: "commentStatus",
      type: "select",
      sortable: true,
      filter: "select",
      editable: true,
      options: COMMENT_STATUS,
    },
    { key: "riskScore", type: "number", sortable: true, filter: "number" },
    { key: "flags", type: "text", filter: "text" },
    { key: "ipHash", type: "hash" },
    { key: "createdAt", type: "datetime", sortable: true, filter: "date" },
    { key: "updatedAt", type: "datetime", sortable: true, filter: "date" },
    { key: "moderatedBy", type: "text", sortable: true, filter: "text" },
    { key: "moderatedAt", type: "datetime", sortable: true, filter: "date" },
    { key: "moderationReason", type: "text", filter: "text" },
    { key: "originalStars", type: "stars" },
    { key: "originalComment", type: "longtext" },
  ],
  visitors: [
    { key: "displayName", type: "text", sortable: true, filter: "text", editable: true },
    { key: "provider", type: "select", sortable: true, filter: "select", options: PROVIDERS },
    { key: "hash", type: "hash" },
    { key: "blocked", type: "bool", sortable: true, filter: "bool", editable: true },
    { key: "reviewCount", type: "number", sortable: true, filter: "number" },
    { key: "createdAt", type: "datetime", sortable: true, filter: "date" },
  ],
  ranking: [
    { key: "rank", type: "number" },
    { key: "name", type: "text" },
    { key: "boothNo", type: "text" },
    { key: "average", type: "number" },
    { key: "reviewCount", type: "number" },
    { key: "score", type: "number" },
    { key: "gap", type: "number" },
  ],
};

export const columnOf = (entity: GridEntity, key: string): ColumnDef | undefined =>
  GRID_COLUMNS[entity].find((c) => c.key === key);

export const isEditable = (entity: GridEntity, key: string): boolean =>
  columnOf(entity, key)?.editable === true;

// ---------- Nilai sel ----------

export type CellValue = string | number | boolean | null;

/** Baris grid generik: `values` per kunci kolom; `version` = `updated_at` untuk kontrol konkurensi (B18). */
export interface GridRow {
  id: string;
  version: number;
  values: Record<string, CellValue>;
  /** Data pendukung yang bukan kolom (mis. id booth untuk pratinjau dampak peringkat) */
  meta?: { boothId?: string };
}

// ---------- Filter, urut, halaman ----------

export const FILTER_OPS = ["eq", "contains", "gte", "lte", "in"] as const;
export type FilterOp = (typeof FILTER_OPS)[number];

/** Operator yang sah per jenis filter. */
export const OPS_BY_KIND: Record<FilterKind, readonly FilterOp[]> = {
  text: ["contains", "eq"],
  number: ["eq", "gte", "lte"],
  select: ["eq", "in"],
  date: ["gte", "lte"],
  bool: ["eq"],
};

export const gridFilterSchema = z.object({
  key: z.string().min(1).max(40),
  op: z.enum(FILTER_OPS),
  value: z.string().max(200),
});
export type GridFilter = z.infer<typeof gridFilterSchema>;

export const gridQuerySchema = z.object({
  cursor: z.string().max(400).optional(),
  limit: z.coerce.number().int().min(1).max(CONFIG.grid.maxPageSize).default(CONFIG.grid.pageSize),
  sort: z.string().max(40).optional(),
  dir: z.enum(["asc", "desc"]).default("asc"),
  q: z.string().trim().max(80).optional(),
  filters: z
    .string()
    .max(2000)
    .optional()
    .transform((raw, ctx) => {
      if (!raw) return [] as GridFilter[];
      try {
        const parsed = z.array(gridFilterSchema).max(12).safeParse(JSON.parse(raw));
        if (parsed.success) return parsed.data;
      } catch {
        // jatuh ke galat di bawah
      }
      ctx.addIssue({ code: "custom", message: "invalid_filters" });
      return z.NEVER;
    }),
});
export type GridQuery = z.output<typeof gridQuerySchema>;

export interface GridSummary {
  /** Jumlah baris yang cocok dengan filter (bukan hanya halaman ini) */
  total: number;
  /** Rata-rata bintang (tab Review) mengikuti filter */
  avgStars: number | null;
  /** Jumlah per status mengikuti filter */
  byStatus: Record<string, number>;
}

export interface GridPage {
  rows: GridRow[];
  /** Kursor halaman berikutnya; null = habis */
  next: string | null;
  summary: GridSummary;
}

// ---------- Sunting massal ----------

const unwrap = <T extends z.ZodType>(s: z.ZodOptional<T>): T => s.unwrap();

/** Validator nilai per kolom yang boleh disunting (whitelist). Kolom lain ditolak. */
export const EDIT_SCHEMAS: Partial<Record<GridEntity, Record<string, z.ZodType>>> = {
  booths: {
    name: unwrap(updateBoothSchema.shape.name),
    boothNo: unwrap(updateBoothSchema.shape.boothNo),
    tagline: unwrap(updateBoothSchema.shape.tagline),
    description: unwrap(updateBoothSchema.shape.description),
    status: unwrap(updateBoothSchema.shape.status),
    email: boothOwnerSchema.shape.email,
  },
  products: {
    name: unwrap(productPatchSchema.shape.name),
    description: unwrap(productPatchSchema.shape.description),
    priceIdr: unwrap(productPatchSchema.shape.priceIdr),
    status: unwrap(productPatchSchema.shape.status),
  },
  reviews: {
    stars: unwrap(adminReviewPatchSchema.shape.stars),
    comment: unwrap(adminReviewPatchSchema.shape.comment),
    status: unwrap(adminReviewPatchSchema.shape.status),
    commentStatus: z.enum(COMMENT_STATUS),
  },
  visitors: {
    displayName: z
      .string()
      .trim()
      .max(30)
      .nullish()
      .transform((v) => (v ? v : null)),
    blocked: z.boolean(),
  },
};

const GRID_ID = z.string().min(1).max(64);

export const gridChangeSchema = z.object({
  entity: z.enum(["booths", "products", "reviews", "visitors"]),
  id: GRID_ID,
  field: z.string().min(1).max(40),
  value: z.unknown(),
  /** `updated_at` baris yang dibaca (kontrol konkurensi) */
  version: z.int().nonnegative(),
});
export type GridChange = z.infer<typeof gridChangeSchema>;

export const bulkEditSchema = z.object({
  reason: z.string().trim().min(CONFIG.registration.adminReasonMinLength).max(500),
  /** true = bila SATU perubahan tidak sah/konflik, tak satu pun diterapkan */
  atomic: z.boolean().default(false),
  changes: z.array(gridChangeSchema).min(1).max(CONFIG.grid.maxBulkChanges),
});
export type BulkEditInput = z.infer<typeof bulkEditSchema>;

export type BulkChangeResult =
  | { index: number; status: "ok" }
  | {
      index: number;
      status: "conflict" | "error";
      code: string;
    };

export interface BulkEditResponse {
  applied: number;
  results: BulkChangeResult[];
}

/** Pemeriksaan nilai: kolom harus boleh disunting dan nilai harus sah. Mengembalikan nilai yang sudah dibersihkan. */
export function parseEditValue(
  entity: GridEntity,
  field: string,
  value: unknown,
): { ok: true; value: CellValue } | { ok: false; code: string } {
  const schema = EDIT_SCHEMAS[entity]?.[field];
  if (!schema) return { ok: false, code: "field_not_editable" };
  const r = schema.safeParse(value);
  return r.success
    ? { ok: true, value: r.data as CellValue }
    : { ok: false, code: "invalid_value" };
}
