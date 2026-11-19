// Statistik booth dihitung ULANG dari tabel review dalam satu pernyataan SQL (explore.md A7, B6).
// Dipilih daripada selisih (`statsDelta`) karena hasilnya selalu konsisten dengan data: aman diulang (B21), tidak
// bisa bergeser oleh permintaan serentak, dan sama untuk submit, edit, sembunyikan, pulihkan, hapus oleh admin.
// Hanya review `visible` yang dihitung; komentar `held`/`masked` TIDAK mempengaruhi bintang (A15).
//
// Ditulis sebagai `update().set()` dengan sub-kueri (bukan `db.run(sql...)`) karena hanya pembangun kueri Drizzle
// yang bisa dimasukkan ke `batch()` D1.

import { eq, sql } from "drizzle-orm";
import { boothStats } from "../db/schema";
import type { Db } from "../lib/db";

/** Pernyataan yang dimasukkan ke `batch()` bersama perubahan review (atomik). */
export function recomputeStatsStatement(db: Db, boothId: string, now: number) {
  const visible = sql`booth_id = ${boothId} AND status = 'visible'`;
  const countStars = (n: number) =>
    sql`(SELECT COUNT(*) FROM reviews WHERE ${visible} AND stars = ${n})`;
  return db
    .update(boothStats)
    .set({
      reviewCount: sql`(SELECT COUNT(*) FROM reviews WHERE ${visible})`,
      starSum: sql`(SELECT COALESCE(SUM(stars), 0) FROM reviews WHERE ${visible})`,
      s1: countStars(1),
      s2: countStars(2),
      s3: countStars(3),
      s4: countStars(4),
      s5: countStars(5),
      categoryCountsJson: sql`(
        SELECT COALESCE(json_group_object(cid, n), '{}') FROM (
          SELECT j.value AS cid, COUNT(*) AS n
          FROM reviews r, json_each(COALESCE(r.category_ids_json, '[]')) j
          WHERE r.booth_id = ${boothId} AND r.status = 'visible'
          GROUP BY j.value))`,
      lastReviewAt: sql`(SELECT MAX(created_at) FROM reviews WHERE ${visible})`,
      updatedAt: now,
    })
    .where(eq(boothStats.boothId, boothId));
}
