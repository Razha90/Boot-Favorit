// Inti logika siaran realtime (explore.md B8): fungsi/kelas MURNI tanpa Durable Object, sehingga bisa diuji di Node.
// Prinsip hemat: jumlah siaran ditentukan JAM (tick), bukan jumlah review. Satu tick = satu pesan berisi hanya yang
// berubah sejak tick sebelumnya. Rating/peringkat yang tidak boleh tampil TIDAK PERNAH ikut dalam pesan.

import type { LatestReview, RankingEntry } from "./api-types";
import { type RankingOptions, rankBooths } from "./scoring";

export interface LiveBoothStat {
  id: string;
  count: number;
  sum: number;
  lastReviewAt: number | null;
}

export interface LiveInput {
  booths: readonly LiveBoothStat[];
  ratingsVisible: boolean;
  rankingVisible: boolean;
  /** Ulasan terbaru (terbaru dulu) yang boleh tampil */
  feed: readonly LatestReview[];
  /** Jumlah review masuk sejak tick sebelumnya (untuk ringkasan "+N ulasan baru") */
  pendingReviews: number;
}

export interface BoothDelta {
  id: string;
  count: number;
  avg: number | null;
}

export interface TickMessage {
  t: "tick";
  booths: BoothDelta[];
  /** Seluruh peringkat bila ada yang berubah; null = tidak berubah atau tidak boleh tampil */
  ranks: RankingEntry[] | null;
  /** Peringkat 1 berpindah ke booth lain (toast "X naik ke peringkat 1") */
  leaderChanged: boolean;
  leader: string | null;
  feed: LatestReview[];
  /** Review baru yang tidak muat di `feed` ("+N ulasan baru") */
  more: number;
}

export type LiveMessage =
  | { t: "hello"; serverNow: number }
  | TickMessage
  /** Admin mengubah sesuatu (mode, hasil, moderasi, reveal): klien mengambil ulang snapshot */
  | { t: "refresh" }
  /** Event selesai: siaran berhenti, klien beralih ke polling jarang */
  | { t: "event_status"; ended: true };

export class LiveCore {
  private lastBooth = new Map<string, string>();
  private lastRanks = "";
  private leader: string | null = null;
  private seenFeed = new Set<string>();

  constructor(private readonly opts: { maxFeedItemsPerTick: number; ranking: RankingOptions }) {}

  /** Mengembalikan pesan tick, atau null bila tidak ada yang berubah (tidak ada siaran sama sekali). */
  tick(input: LiveInput): TickMessage | null {
    const booths: BoothDelta[] = [];
    if (input.ratingsVisible) {
      for (const b of input.booths) {
        const sig = `${b.count}:${b.sum}`;
        const before = this.lastBooth.get(b.id);
        if (before === sig || (before === undefined && b.count === 0)) {
          this.lastBooth.set(b.id, sig);
          continue;
        }
        this.lastBooth.set(b.id, sig);
        booths.push({ id: b.id, count: b.count, avg: b.count > 0 ? b.sum / b.count : null });
      }
    } else {
      this.lastBooth.clear(); // dibuka lagi nanti = kirim ulang yang relevan
    }

    let ranks: RankingEntry[] | null = null;
    let leaderChanged = false;
    let leader: string | null = null;
    if (input.rankingVisible) {
      const ranking: RankingEntry[] = rankBooths(
        input.booths.map((b) => ({
          boothId: b.id,
          reviewCount: b.count,
          starSum: b.sum,
          lastReviewAt: b.lastReviewAt,
        })),
        this.opts.ranking,
      ).map((r) => ({
        boothId: r.boothId,
        rank: r.rank,
        score: r.score,
        average: r.average,
        reviewCount: r.reviewCount,
      }));
      const sig = ranking
        .map((r) => `${r.boothId}:${r.rank}:${r.reviewCount}:${r.score}`)
        .join("|");
      if (sig !== this.lastRanks) {
        this.lastRanks = sig;
        ranks = ranking;
      }
      leader = ranking[0]?.boothId ?? null;
      leaderChanged = this.leader !== null && leader !== null && leader !== this.leader;
      this.leader = leader;
    } else {
      this.lastRanks = "";
      this.leader = null; // tersembunyi: tidak ada leader_changed yang bocor
    }

    const fresh = input.feed.filter((f) => !this.seenFeed.has(f.id));
    for (const f of input.feed) this.seenFeed.add(f.id);
    if (this.seenFeed.size > 200) this.seenFeed = new Set(input.feed.map((f) => f.id));
    const feed = fresh.slice(0, this.opts.maxFeedItemsPerTick);
    const more = Math.max(0, input.pendingReviews - feed.length);

    if (
      booths.length === 0 &&
      ranks === null &&
      feed.length === 0 &&
      !leaderChanged &&
      more === 0
    ) {
      return null;
    }
    return { t: "tick", booths, ranks, leaderChanged, leader, feed, more };
  }
}
