// Peta kolom SQL per entity Data Grid. Kunci harus sama dengan `GRID_COLUMNS` (shared/data-grid.ts); ketidaksesuaian
// ditangkap tes. Alias tabel tetap: b = booths, s = booth_stats, pr = products, r = reviews, v = visitors.

import { sql } from "drizzle-orm";
import { parseIds } from "../reviews";
import type { EntitySpec, SqlCol } from "./engine";

const col = (expr: string, kind: SqlCol["kind"]): SqlCol => ({ expr: sql.raw(expr), kind });
const text = (e: string) => col(e, "text");
const int = (e: string) => col(e, "number");
const bool = (e: string) => col(e, "bool");
const date = (e: string) => col(e, "date");

const nonEmpty = (c: string) => `(${c} IS NOT NULL AND TRIM(${c}) <> '')`;

// Kelengkapan (A16) = jumlah dari empat syarat `CONFIG.profile.fullNeeds`; tes membandingkannya dengan `completeness()`.
const COMPLETENESS_SCORE = `((EXISTS (SELECT 1 FROM booth_photos ph WHERE ph.booth_id = b.id AND ph.position = 0)) + ${nonEmpty("b.description")} + ${nonEmpty("b.tagline")} + ${nonEmpty("b.booth_no")})`;

export const BOOTHS_SPEC: EntitySpec = {
  entity: "booths",
  from: sql.raw("FROM booths b LEFT JOIN booth_stats s ON s.booth_id = b.id"),
  scope: (eventId) => sql`b.event_id = ${eventId}`,
  id: sql.raw("b.id"),
  version: sql.raw("b.updated_at"),
  status: sql.raw("b.status"),
  defaultSort: { key: "name", dir: "asc" },
  search: [sql.raw("b.name"), sql.raw("b.booth_no"), sql.raw("b.email"), sql.raw("b.tagline")],
  cols: {
    boothNo: text("b.booth_no"),
    name: text("b.name"),
    email: text("b.email"),
    owner: text(
      "CASE WHEN b.email IS NULL THEN 'none' WHEN b.owner_last_login_at IS NULL THEN 'invited' ELSE 'active' END",
    ),
    completeness: text(
      `CASE ${COMPLETENESS_SCORE} WHEN 0 THEN 'name_only' WHEN 4 THEN 'full' ELSE 'partial' END`,
    ),
    status: text("b.status"),
    isLate: bool("b.is_late"),
    createdBy: text("b.created_by"),
    tagline: text("b.tagline"),
    description: text("b.description"),
    rejectReason: text("b.reject_reason"),
    approvedBy: text("b.approved_by"),
    createdAt: date("b.created_at"),
    reviewCount: int("COALESCE(s.review_count, 0)"),
    average: int(
      "CASE WHEN COALESCE(s.review_count, 0) > 0 THEN 1.0 * s.star_sum / s.review_count END",
    ),
    // Diisi di JS (butuh seluruh statistik event): bukan SQL
    score: int("NULL"),
    rank: int("NULL"),
  },
};

export const PRODUCTS_SPEC: EntitySpec = {
  entity: "products",
  from: sql.raw("FROM products pr JOIN booths b ON b.id = pr.booth_id"),
  scope: (eventId) => sql`pr.event_id = ${eventId}`,
  id: sql.raw("pr.id"),
  boothId: sql.raw("pr.booth_id"),
  version: sql.raw("pr.updated_at"),
  status: sql.raw("pr.status"),
  defaultSort: { key: "createdAt", dir: "desc" },
  search: [sql.raw("pr.name"), sql.raw("b.name"), sql.raw("pr.category")],
  cols: {
    boothName: text("b.name"),
    name: text("pr.name"),
    category: text("pr.category"),
    priceIdr: int("pr.price_idr"),
    comparePriceIdr: int("pr.compare_price_idr"),
    badge: text("pr.badge"),
    isFeatured: bool("pr.is_featured"),
    status: text("pr.status"),
    description: text("pr.description"),
    createdAt: date("pr.created_at"),
  },
};

export const REVIEWS_SPEC: EntitySpec = {
  entity: "reviews",
  from: sql.raw(
    "FROM reviews r JOIN booths b ON b.id = r.booth_id LEFT JOIN visitors v ON v.id = r.visitor_id",
  ),
  scope: (eventId) => sql`r.event_id = ${eventId}`,
  id: sql.raw("r.id"),
  boothId: sql.raw("r.booth_id"),
  version: sql.raw("r.updated_at"),
  status: sql.raw("r.status"),
  stars: sql.raw("r.stars"),
  defaultSort: { key: "createdAt", dir: "desc" },
  search: [sql.raw("r.comment"), sql.raw("b.name"), sql.raw("v.display_name")],
  cols: {
    boothName: text("b.name"),
    visitorName: text("v.display_name"),
    provider: text("v.provider"),
    visitorHash: text("SUBSTR(v.identity_hash, 1, 8)"),
    stars: int("r.stars"),
    comment: text("r.comment"),
    status: text("r.status"),
    commentStatus: text("r.comment_status"),
    riskScore: int("r.risk_score"),
    flags: text("r.flags_json"),
    ipHash: text("SUBSTR(r.ip_hash, 1, 8)"),
    createdAt: date("r.created_at"),
    updatedAt: date("r.updated_at"),
    moderatedBy: text("r.moderated_by"),
    moderatedAt: date("r.moderated_at"),
    moderationReason: text("r.moderation_reason"),
    originalStars: int("r.original_stars"),
    originalComment: text("r.original_comment"),
  },
  // Flag disimpan sebagai JSON; tampil sebagai daftar singkat.
  finish: (values) => {
    const raw = values.flags;
    values.flags = typeof raw === "string" ? parseIds(raw).join(", ") : null;
  },
};

export const VISITORS_SPEC: EntitySpec = {
  entity: "visitors",
  from: sql.raw("FROM visitors v"),
  scope: (eventId) => sql`v.event_id = ${eventId}`,
  id: sql.raw("v.id"),
  version: sql.raw("v.updated_at"),
  defaultSort: { key: "createdAt", dir: "desc" },
  search: [sql.raw("v.display_name")],
  cols: {
    displayName: text("v.display_name"),
    provider: text("v.provider"),
    hash: text("SUBSTR(v.identity_hash, 1, 8)"),
    blocked: bool("v.blocked"),
    reviewCount: int("(SELECT COUNT(*) FROM reviews rv WHERE rv.visitor_id = v.id)"),
    createdAt: date("v.created_at"),
  },
};

export const SPECS = {
  booths: BOOTHS_SPEC,
  products: PRODUCTS_SPEC,
  reviews: REVIEWS_SPEC,
  visitors: VISITORS_SPEC,
} as const;
