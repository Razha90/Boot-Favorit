import type { PublicSnapshot } from "@shared/api-types";
import type { TickMessage } from "@shared/live-core";

/** Jumlah ulasan terbaru yang ditampilkan di bagian 03 (A8). */
export const FEED_SIZE = 5;

/**
 * Menambal snapshot di cache dengan satu pesan `tick` (murni). Rating/peringkat yang tersembunyi tidak pernah
 * dikirim server, tetapi di sini pun dijaga: tidak ada yang ditulis bila `ratingsHidden`.
 */
export function applyTick(old: PublicSnapshot, tick: TickMessage): PublicSnapshot {
  const delta = new Map(tick.booths.map((b) => [b.id, b]));
  const booths =
    old.ratingsHidden || delta.size === 0
      ? old.booths
      : old.booths.map((b) => {
          const d = delta.get(b.id);
          return d ? { ...b, ratingCount: d.count, ratingAverage: d.avg } : b;
        });

  let stats = old.stats;
  if (booths !== old.booths) {
    const reviewCount = booths.reduce((n, b) => n + b.ratingCount, 0);
    const sum = booths.reduce((n, b) => n + (b.ratingAverage ?? 0) * b.ratingCount, 0);
    stats = { ...old.stats, reviewCount, average: reviewCount > 0 ? sum / reviewCount : null };
  }

  const known = new Set(old.feed.map((f) => f.id));
  const feed = [...tick.feed.filter((f) => !known.has(f.id)), ...old.feed].slice(0, FEED_SIZE);

  return {
    ...old,
    booths,
    stats,
    // Peringkat hanya diganti bila server mengirimnya (peringkat tersembunyi → server mengirim null → tetap null).
    ranking: tick.ranks !== null && old.ranking !== null ? tick.ranks : old.ranking,
    feed,
  };
}
