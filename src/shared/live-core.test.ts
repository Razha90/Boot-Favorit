import { describe, expect, it } from "vitest";
import type { LatestReview } from "./api-types";
import { type LiveBoothStat, LiveCore, type LiveInput } from "./live-core";

const core = () =>
  new LiveCore({ maxFeedItemsPerTick: 5, ranking: { priorWeight: 5, minReviewsToRank: 3 } });
const booth = (id: string, count: number, sum: number, at = 1): LiveBoothStat => ({
  id,
  count,
  sum,
  lastReviewAt: at,
});
const rv = (id: string): LatestReview => ({
  id,
  boothId: "a",
  boothName: "A",
  stars: 5,
  text: "ok",
  displayName: "T",
  createdAt: 1,
});
const input = (over: Partial<LiveInput> = {}): LiveInput => ({
  booths: [],
  ratingsVisible: true,
  rankingVisible: true,
  feed: [],
  pendingReviews: 0,
  ...over,
});

describe("LiveCore: batching per tick", () => {
  it("tanpa perubahan: tidak ada pesan sama sekali (DO bisa tidur)", () => {
    const c = core();
    c.tick(input({ booths: [booth("a", 3, 12)] }));
    expect(c.tick(input({ booths: [booth("a", 3, 12)] }))).toBeNull();
  });

  it("hanya booth yang berubah yang dikirim (delta), bukan seluruh data", () => {
    const c = core();
    c.tick(input({ booths: [booth("a", 3, 12), booth("b", 3, 9)] }));
    const t = c.tick(input({ booths: [booth("a", 4, 17), booth("b", 3, 9)] }));
    expect(t?.booths).toEqual([{ id: "a", count: 4, avg: 17 / 4 }]);
  });

  it("booth tanpa ulasan tidak dikirim pada tick pertama", () => {
    const t = core().tick(input({ booths: [booth("a", 0, 0), booth("b", 2, 8)] }));
    expect(t?.booths.map((b) => b.id)).toEqual(["b"]);
  });

  it("100 review dalam satu tick = SATU pesan (rumus tick × penonton, bukan review × penonton)", () => {
    const c = core();
    c.tick(input({ booths: [booth("a", 3, 12)] }));
    const msgs = [c.tick(input({ booths: [booth("a", 103, 480)], pendingReviews: 100 }))];
    expect(msgs.filter(Boolean)).toHaveLength(1);
    expect(msgs[0]?.booths).toHaveLength(1);
  });
});

describe("LiveCore: peringkat dan leader", () => {
  it("peringkat dikirim penuh hanya saat berubah; leaderChanged hanya saat peringkat 1 berpindah", () => {
    const c = core();
    const first = c.tick(input({ booths: [booth("a", 5, 25), booth("b", 5, 15)] }));
    expect(first?.ranks?.[0]?.boothId).toBe("a");
    expect(first?.leaderChanged).toBe(false); // belum ada leader sebelumnya

    const same = c.tick(input({ booths: [booth("a", 5, 25), booth("b", 5, 15)] }));
    expect(same).toBeNull();

    const swap = c.tick(input({ booths: [booth("a", 5, 10), booth("b", 5, 25)] }));
    expect(swap?.leaderChanged).toBe(true);
    expect(swap?.leader).toBe("b");
    expect(swap?.ranks?.map((r) => r.boothId)).toEqual(["b", "a"]);
  });

  it("peringkat tersembunyi: TIDAK ADA ranks dan TIDAK ADA leaderChanged, walau peringkat 1 berpindah", () => {
    const c = core();
    c.tick(input({ rankingVisible: false, booths: [booth("a", 5, 25), booth("b", 5, 15)] }));
    const t = c.tick(
      input({ rankingVisible: false, booths: [booth("a", 5, 10), booth("b", 5, 25)] }),
    );
    expect(t?.ranks).toBeNull();
    expect(t?.leaderChanged).toBe(false);
    expect(t?.leader).toBeNull();
    expect(JSON.stringify(t)).not.toContain("score");
  });

  it("rating tersembunyi: tanpa rata-rata, tanpa jumlah, tanpa peringkat; feed tetap jalan", () => {
    const c = core();
    const t = c.tick(
      input({
        ratingsVisible: false,
        rankingVisible: false,
        booths: [booth("a", 5, 25)],
        feed: [rv("r1")],
      }),
    );
    expect(t?.booths).toEqual([]);
    expect(t?.ranks).toBeNull();
    expect(t?.feed.map((f) => f.id)).toEqual(["r1"]);
    expect(JSON.stringify(t)).not.toMatch(/"avg"|"count"|"score"/);
  });

  it("dibuka lagi setelah disembunyikan: data yang relevan dikirim ulang", () => {
    const c = core();
    c.tick(input({ booths: [booth("a", 5, 25)] }));
    c.tick(input({ ratingsVisible: false, rankingVisible: false, booths: [booth("a", 5, 25)] }));
    const t = c.tick(input({ booths: [booth("a", 5, 25)] }));
    expect(t?.booths).toHaveLength(1);
    expect(t?.ranks).toHaveLength(1);
  });
});

describe("LiveCore: feed ulasan", () => {
  it("hanya ulasan baru yang dikirim; maksimal maxFeedItemsPerTick; sisanya jadi '+N'", () => {
    const c = new LiveCore({
      maxFeedItemsPerTick: 2,
      ranking: { priorWeight: 5, minReviewsToRank: 3 },
    });
    const t = c.tick(input({ feed: [rv("5"), rv("4"), rv("3")], pendingReviews: 9 }));
    expect(t?.feed.map((f) => f.id)).toEqual(["5", "4"]);
    expect(t?.more).toBe(7);
    // tick berikutnya: yang sudah terlihat tidak dikirim lagi
    const n = c.tick(input({ feed: [rv("6"), rv("5"), rv("4")], pendingReviews: 1 }));
    expect(n?.feed.map((f) => f.id)).toEqual(["6"]);
    expect(n?.more).toBe(0);
  });

  it("tanpa review baru dan tanpa perubahan: null", () => {
    const c = core();
    c.tick(input({ feed: [rv("1")] }));
    expect(c.tick(input({ feed: [rv("1")] }))).toBeNull();
  });
});
