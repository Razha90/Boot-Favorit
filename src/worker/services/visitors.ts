// Pengunjung/reviewer per-event (explore.md B7): dibuat saat login pertama, idempotent per identitas.

import { and, eq } from "drizzle-orm";
import { type VisitorRow, visitors } from "../db/schema";
import type { Db } from "../lib/db";

export interface Deps {
  now: number;
  newId: () => string;
}

export async function upsertVisitor(
  db: Db,
  d: Deps,
  o: {
    eventId: string;
    provider: VisitorRow["provider"];
    identityHash: string;
    displayName: string | null;
  },
): Promise<VisitorRow> {
  const find = () =>
    db
      .select()
      .from(visitors)
      .where(and(eq(visitors.eventId, o.eventId), eq(visitors.identityHash, o.identityHash)))
      .get();

  const existing = await find();
  if (existing) {
    // Nama tampil hanya diisi bila belum ada: login ulang tidak menimpa nama yang sudah dipilih.
    if (!existing.displayName && o.displayName) {
      await db
        .update(visitors)
        .set({ displayName: o.displayName, updatedAt: d.now })
        .where(eq(visitors.id, existing.id));
      return { ...existing, displayName: o.displayName, updatedAt: d.now };
    }
    return existing;
  }

  // Dua login serentak untuk identitas yang sama: indeks unik memastikan satu baris; yang kalah membaca ulang.
  await db
    .insert(visitors)
    .values({
      id: d.newId(),
      eventId: o.eventId,
      provider: o.provider,
      identityHash: o.identityHash,
      displayName: o.displayName,
      createdAt: d.now,
      updatedAt: d.now,
    })
    .onConflictDoNothing();
  const created = await find();
  if (!created) throw new Error("visitor_upsert_failed");
  return created;
}

/** Nama yang tampil di ulasan: nama depan/alias, tidak pernah email (A5). */
export const publicName = (v: Pick<VisitorRow, "displayName">): string =>
  v.displayName?.trim() || "Pengunjung";
