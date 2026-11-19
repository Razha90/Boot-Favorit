// Daftar istilah moderasi per event (explore.md A15, B25). Dimuat dari daftar awal pada pemakaian pertama; admin
// mengubahnya tanpa deploy. Daftar dikompilasi sekali per versi di memori isolat; `version` = waktu perubahan terakhir
// (dicatat pada tiap review sebagai `filter_version`).

import type { AdminTerm, ModerationTestResult } from "@shared/api-types";
import { CONFIG } from "@shared/config";
import {
  type CompiledTerms,
  compileTerms,
  type ModerationPolicy,
  type ModerationResult,
  type ModerationTerm,
  moderateComment,
  normalizeWord,
} from "@shared/moderation";
import { SEED_TERMS } from "@shared/moderation-seed";
import { and, asc, eq, sql } from "drizzle-orm";
import { type ModerationTermRow, moderationTerms } from "../db/schema";
import { type Db, runBatch } from "../lib/db";
import type { Deps } from "./visitors";

export const policy = (): ModerationPolicy => ({
  severeAction: CONFIG.moderation.severeAction,
  mildAction: CONFIG.moderation.mildAction,
  holdContactInfo: CONFIG.moderation.holdContactInfo,
});

/** Memuat daftar awal bila event belum punya istilah sama sekali. Aman dipanggil serentak (indeks unik). */
export async function ensureTerms(db: Db, eventId: string, d: Deps): Promise<void> {
  const row = await db
    .select({ n: sql<number>`count(*)` })
    .from(moderationTerms)
    .where(eq(moderationTerms.eventId, eventId))
    .get();
  if ((row?.n ?? 0) > 0) return;
  await runBatch(
    db,
    SEED_TERMS.map((s) =>
      db
        .insert(moderationTerms)
        .values({
          id: d.newId(),
          eventId,
          term: normalizeWord(s.term),
          lang: s.lang,
          severity: s.severity,
          kind: s.kind,
          match: s.match,
          enabled: 1,
          source: "starter",
          createdBy: "system",
          createdAt: d.now,
          updatedAt: d.now,
        })
        .onConflictDoNothing(),
    ),
  );
}

const cache = new Map<string, CompiledTerms>();

/** Versi daftar = waktu perubahan terbaru; berubah tiap admin mengubah istilah. */
async function currentVersion(db: Db, eventId: string): Promise<number> {
  const r = await db
    .select({ v: sql<number>`coalesce(max(${moderationTerms.updatedAt}), 0)` })
    .from(moderationTerms)
    .where(eq(moderationTerms.eventId, eventId))
    .get();
  return r?.v ?? 0;
}

const toTerm = (r: ModerationTermRow): ModerationTerm => ({
  id: r.id,
  term: r.term,
  severity: r.severity,
  kind: r.kind,
  match: r.match,
});

export async function getCompiled(db: Db, eventId: string, d: Deps): Promise<CompiledTerms> {
  await ensureTerms(db, eventId, d);
  const version = await currentVersion(db, eventId);
  const hit = cache.get(eventId);
  if (hit && hit.version === version) return hit;
  const rows = await db
    .select()
    .from(moderationTerms)
    .where(and(eq(moderationTerms.eventId, eventId), eq(moderationTerms.enabled, 1)));
  const compiled = compileTerms(rows.map(toTerm), version);
  cache.set(eventId, compiled);
  return compiled;
}

export async function checkComment(
  db: Db,
  eventId: string,
  text: string,
  d: Deps,
): Promise<ModerationResult & { version: number }> {
  const compiled = await getCompiled(db, eventId, d);
  return { ...moderateComment(text, compiled, policy()), version: compiled.version };
}

// ---------- Admin ----------

const view = (r: ModerationTermRow): AdminTerm => ({
  id: r.id,
  term: r.term,
  lang: r.lang,
  severity: r.severity,
  kind: r.kind,
  match: r.match,
  enabled: r.enabled === 1,
  source: r.source,
});

export async function listTerms(db: Db, eventId: string, d: Deps): Promise<AdminTerm[]> {
  await ensureTerms(db, eventId, d);
  const rows = await db
    .select()
    .from(moderationTerms)
    .where(eq(moderationTerms.eventId, eventId))
    .orderBy(asc(moderationTerms.kind), asc(moderationTerms.term));
  return rows.map(view);
}

export interface TermInput {
  term: string;
  lang: "id" | "en" | "regional";
  severity: "severe" | "mild";
  kind: "block" | "allow";
  match: "word" | "contains";
  enabled: boolean;
}

/** Tambah atau ubah istilah (kunci: istilah ternormalisasi + jenis). Tidak ada yang dihapus: nonaktifkan saja. */
export async function upsertTerms(
  db: Db,
  eventId: string,
  inputs: readonly TermInput[],
  d: Deps,
  actor: string,
): Promise<AdminTerm[]> {
  await ensureTerms(db, eventId, d);
  await runBatch(
    db,
    inputs.flatMap((t) => {
      const term = normalizeWord(t.term);
      if (term === "") return [];
      return [
        db
          .insert(moderationTerms)
          .values({
            id: d.newId(),
            eventId,
            term,
            lang: t.lang,
            severity: t.severity,
            kind: t.kind,
            match: t.match,
            enabled: t.enabled ? 1 : 0,
            source: "admin",
            createdBy: actor,
            createdAt: d.now,
            updatedAt: d.now,
          })
          .onConflictDoUpdate({
            target: [moderationTerms.eventId, moderationTerms.term, moderationTerms.kind],
            set: {
              lang: t.lang,
              severity: t.severity,
              match: t.match,
              enabled: t.enabled ? 1 : 0,
              updatedAt: d.now,
            },
          }),
      ];
    }),
  );
  cache.delete(eventId);
  return listTerms(db, eventId, d);
}

/** "Uji kalimat ini": hasil lengkap untuk admin, termasuk istilah yang tertangkap. */
export async function testSentence(
  db: Db,
  eventId: string,
  text: string,
  d: Deps,
): Promise<ModerationTestResult> {
  const compiled = await getCompiled(db, eventId, d);
  const r = moderateComment(text, compiled, policy());
  const rows = await db.select().from(moderationTerms).where(eq(moderationTerms.eventId, eventId));
  const byId = new Map(rows.map((t) => [t.id, t.term]));
  return {
    status: r.status,
    masked: r.masked,
    contact: r.contact,
    matched: r.hits.map((id) => byId.get(id) ?? id),
  };
}

/** Hanya untuk tes: kosongkan cache antar kasus. */
export const clearTermCache = (): void => cache.clear();
