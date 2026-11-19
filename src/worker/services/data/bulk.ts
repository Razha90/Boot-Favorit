// Simpan massal Data Grid (explore.md B18): `PATCH …/data/bulk`. Setiap perubahan dikirim ke LAYANAN yang sama dengan
// rute admin biasa (updateBooth, setOwner, updateProduct, patchReview, …), sehingga aturan alasan, statistik, versi, dan
// penolakan tidak berbeda dari jalur lain. Kontrol konkurensi: versi tiap baris diperiksa terhadap `version` yang dibaca klien.
//
// Batas yang jujur: tiap GRUP perubahan (satu baris) atomik di layanannya, tetapi seluruh permintaan TIDAK satu batch D1.
// `atomic: true` memeriksa SEMUA perubahan (nilai, versi, keberadaan baris) sebelum menerapkan apa pun; tabrakan yang baru
// muncul di antara pemeriksaan dan penerapan tetap dilaporkan per perubahan.

import {
  type BulkChangeResult,
  type BulkEditInput,
  type BulkEditResponse,
  type CellValue,
  type GridChange,
  type GridEntity,
  parseEditValue,
} from "@shared/data-grid";
import { ApiError } from "@shared/errors";
import type { UpdateBoothInput } from "@shared/schemas";
import { and, eq, inArray } from "drizzle-orm";
import { booths, products, reviews, visitors } from "../../db/schema";
import type { Db } from "../../lib/db";
import {
  patchReview,
  setCommentStatus,
  setVisitorBlocked,
  setVisitorName,
} from "../admin-moderation";
import { setOwner, updateBooth } from "../booths";
import type { Deps } from "../events";
import { updateProduct } from "../products";

/** Satu perubahan yang benar-benar diterapkan (untuk entri log: nilai sebelum/sesudah). */
export interface AppliedChange {
  entity: GridEntity;
  id: string;
  field: string;
  before: CellValue;
  after: CellValue;
}

export interface BulkOutcome extends BulkEditResponse {
  appliedChanges: AppliedChange[];
}

type Entity = GridChange["entity"];
type Loaded = {
  version: number;
  before: Record<string, CellValue>;
  extra: Record<string, unknown>;
};

const key = (e: Entity, id: string) => `${e}:${id}`;

async function loadRows(
  db: Db,
  eventId: string,
  changes: GridChange[],
): Promise<Map<string, Loaded>> {
  const out = new Map<string, Loaded>();
  const ids = (e: Entity) => [...new Set(changes.filter((c) => c.entity === e).map((c) => c.id))];

  const b = ids("booths");
  if (b.length) {
    const rows = await db
      .select()
      .from(booths)
      .where(and(eq(booths.eventId, eventId), inArray(booths.id, b)));
    for (const r of rows) {
      out.set(key("booths", r.id), {
        version: r.updatedAt,
        before: {
          name: r.name,
          boothNo: r.boothNo,
          tagline: r.tagline,
          description: r.description,
          status: r.status,
          email: r.email,
        },
        extra: {},
      });
    }
  }
  const p = ids("products");
  if (p.length) {
    const rows = await db
      .select()
      .from(products)
      .where(and(eq(products.eventId, eventId), inArray(products.id, p)));
    for (const r of rows) {
      out.set(key("products", r.id), {
        version: r.updatedAt,
        before: {
          name: r.name,
          description: r.description,
          priceIdr: r.priceIdr,
          status: r.status,
        },
        extra: { boothId: r.boothId },
      });
    }
  }
  const rv = ids("reviews");
  if (rv.length) {
    const rows = await db
      .select()
      .from(reviews)
      .where(and(eq(reviews.eventId, eventId), inArray(reviews.id, rv)));
    for (const r of rows) {
      out.set(key("reviews", r.id), {
        version: r.updatedAt,
        before: {
          stars: r.stars,
          comment: r.comment,
          status: r.status,
          commentStatus: r.commentStatus,
        },
        extra: { hasComment: r.comment !== null },
      });
    }
  }
  const v = ids("visitors");
  if (v.length) {
    const rows = await db
      .select()
      .from(visitors)
      .where(and(eq(visitors.eventId, eventId), inArray(visitors.id, v)));
    for (const r of rows) {
      out.set(key("visitors", r.id), {
        version: r.updatedAt,
        before: { displayName: r.displayName, blocked: r.blocked === 1 },
        extra: {},
      });
    }
  }
  return out;
}

interface Group {
  entity: Entity;
  id: string;
  items: { index: number; field: string; value: CellValue }[];
}

const errCode = (e: unknown) => (e instanceof ApiError ? e.code : "internal_error");

/** Menerapkan satu grup (satu baris) lewat layanan yang sesuai; mengembalikan hasil per bidang. */
async function applyGroup(
  db: Db,
  eventId: string,
  g: Group,
  loaded: Loaded,
  o: { reason: string; adminEmail: string; d: Deps },
): Promise<Map<number, string | null>> {
  const res = new Map<number, string | null>(); // index → null (ok) | kode galat
  const f = Object.fromEntries(g.items.map((i) => [i.field, i.value])) as Record<string, CellValue>;
  const idx = (fields: string[]) =>
    g.items.filter((i) => fields.includes(i.field)).map((i) => i.index);
  const mark = (fields: string[], code: string | null) => {
    for (const i of idx(fields)) res.set(i, code);
  };
  const run = async (fields: string[], fn: () => Promise<unknown>) => {
    if (idx(fields).length === 0) return;
    try {
      await fn();
      mark(fields, null);
    } catch (e) {
      mark(fields, errCode(e));
    }
  };

  if (g.entity === "booths") {
    const profile = ["name", "boothNo", "tagline", "description", "status"];
    await run(profile, async () => {
      const status = f.status as string | undefined;
      await updateBooth(
        db,
        eventId,
        g.id,
        {
          ...pick(f, ["name", "boothNo", "tagline", "description"]),
          ...(status !== undefined && { status }),
          // Penolakan/revisi butuh alasan yang dilihat pemilik: dipakai alasan simpan massal.
          ...(status === "rejected" || status === "revision" ? { rejectReason: o.reason } : {}),
          reason: o.reason,
        } as UpdateBoothInput,
        o.d,
        o.adminEmail,
      );
    });
    await run(["email"], async () => {
      await setOwner(db, eventId, g.id, (f.email as string | null) ?? null, o.reason, o.d);
    });
  } else if (g.entity === "products") {
    await run(["name", "description", "priceIdr", "status"], async () => {
      await updateProduct(
        db,
        eventId,
        String(loaded.extra.boothId),
        g.id,
        pick(f, ["name", "description", "priceIdr", "status"]) as never,
        o.d,
      );
    });
  } else if (g.entity === "reviews") {
    await run(["stars", "comment", "status"], async () => {
      await patchReview(
        db,
        o.d,
        eventId,
        g.id,
        { ...pick(f, ["stars", "comment", "status"]), reason: o.reason } as never,
        o.adminEmail,
      );
    });
    // Sesudah patchReview: status komentar yang dipilih eksplisit menang atas "tayang" bawaan penyuntingan teks.
    await run(["commentStatus"], async () => {
      await setCommentStatus(
        db,
        o.d,
        eventId,
        g.id,
        { commentStatus: f.commentStatus as never, reason: o.reason },
        o.adminEmail,
      );
    });
  } else {
    await run(["displayName"], () =>
      setVisitorName(db, o.d, eventId, g.id, f.displayName as string | null),
    );
    await run(["blocked"], () => setVisitorBlocked(db, o.d, eventId, g.id, f.blocked === true));
  }
  return res;
}

function pick(f: Record<string, CellValue>, keys: string[]): Record<string, CellValue> {
  const out: Record<string, CellValue> = {};
  for (const k of keys) if (k in f) out[k] = f[k] as CellValue;
  return out;
}

export async function bulkEdit(
  db: Db,
  eventId: string,
  input: BulkEditInput,
  d: Deps,
  adminEmail: string,
): Promise<BulkOutcome> {
  const results: BulkChangeResult[] = new Array(input.changes.length);
  const parsed: (CellValue | undefined)[] = new Array(input.changes.length);
  const loaded = await loadRows(db, eventId, input.changes);

  // ---- Fase 1: pemeriksaan (nilai, keberadaan, versi) ----
  input.changes.forEach((c, index) => {
    const p = parseEditValue(c.entity, c.field, c.value);
    if (!p.ok) {
      results[index] = { index, status: "error", code: p.code };
      return;
    }
    const row = loaded.get(key(c.entity, c.id));
    if (!row) {
      results[index] = { index, status: "error", code: "not_found" };
      return;
    }
    if (row.version !== c.version) {
      results[index] = { index, status: "conflict", code: "version_conflict" };
      return;
    }
    if (c.entity === "reviews" && c.field === "commentStatus" && !row.extra.hasComment) {
      results[index] = { index, status: "error", code: "no_comment" };
      return;
    }
    parsed[index] = p.value;
  });

  const failed = results.filter((r) => r !== undefined).length;
  if (input.atomic && failed > 0) {
    // Tak satu pun diterapkan: yang lolos pemeriksaan ditandai dibatalkan.
    input.changes.forEach((_, index) => {
      results[index] ??= { index, status: "error", code: "atomic_aborted" };
    });
    return { applied: 0, results, appliedChanges: [] };
  }

  // ---- Fase 2: terapkan per baris ----
  const groups = new Map<string, Group>();
  input.changes.forEach((c, index) => {
    if (results[index]) return;
    const k = key(c.entity, c.id);
    const g = groups.get(k) ?? { entity: c.entity, id: c.id, items: [] };
    g.items.push({ index, field: c.field, value: parsed[index] as CellValue });
    groups.set(k, g);
  });

  const appliedChanges: AppliedChange[] = [];
  for (const [k, g] of groups) {
    const row = loaded.get(k) as Loaded;
    const outcome = await applyGroup(db, eventId, g, row, { reason: input.reason, adminEmail, d });
    for (const item of g.items) {
      // null = berhasil: jangan memakai `??` (null akan ikut tergantikan).
      const code = outcome.has(item.index) ? (outcome.get(item.index) ?? null) : "internal_error";
      if (code === null) {
        results[item.index] = { index: item.index, status: "ok" };
        appliedChanges.push({
          entity: g.entity,
          id: g.id,
          field: item.field,
          before: row.before[item.field] ?? null,
          after: item.value,
        });
      } else {
        results[item.index] = {
          index: item.index,
          status: code === "version_conflict" ? "conflict" : "error",
          code,
        };
      }
    }
  }
  return { applied: appliedChanges.length, results, appliedChanges };
}
