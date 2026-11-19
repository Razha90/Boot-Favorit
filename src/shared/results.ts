// Visibilitas rating/peringkat dan penyusunan hasil (explore.md A3, A7, A8, B20). Fungsi MURNI: dipakai server
// (penegakan: data yang disembunyikan tidak dikirim sama sekali) dan client.

import { type RankingOptions, rankBooths } from "./scoring";

export type DisplayMode = "visible" | "hidden" | "on_results";

export interface VisibilityInput {
  ratingsMode: DisplayMode;
  rankingMode: DisplayMode;
  resultsPublishedAt: number | null;
}

const shown = (mode: DisplayMode, published: boolean) =>
  mode === "visible" || (mode === "on_results" && published);

/**
 * Rating tampil menurut `ratings_mode`; peringkat menurut `ranking_mode` DAN rating harus tampil
 * (peringkat bergantung pada rating: A3 "Rating disembunyikan").
 */
export function visibility(e: VisibilityInput): { ratings: boolean; ranking: boolean } {
  const published = e.resultsPublishedAt !== null;
  const ratings = shown(e.ratingsMode, published);
  return { ratings, ranking: ratings && shown(e.rankingMode, published) };
}

export interface BoothResultInput {
  boothId: string;
  name: string;
  boothNo: string | null;
  coverThumbKey: string | null;
  reviewCount: number;
  starSum: number;
  lastReviewAt: number | null;
  /** { [categoryId]: jumlah } */
  categoryCounts: Record<string, number>;
}

export interface ResultEntry {
  boothId: string;
  /** null = belum cukup ulasan untuk diperingkat */
  rank: number | null;
  name: string;
  boothNo: string | null;
  coverThumbKey: string | null;
  average: number | null;
  reviewCount: number;
  score: number | null;
  /** Tag ulasan teratas (maks. 3) dengan label SAAT hasil dibekukan */
  topCategories: { label: string; count: number }[];
}

const TOP_TAGS = 3;

/**
 * Hasil akhir SELURUH booth: yang diperingkat urut dari peringkat 1, lalu yang belum cukup ulasan
 * (urut jumlah ulasan lalu nama) agar semua booth tetap tercantum (A8).
 */
export function buildResults(
  inputs: readonly BoothResultInput[],
  labels: ReadonlyMap<string, string>,
  opts: RankingOptions,
): ResultEntry[] {
  const ranked = new Map(
    rankBooths(
      inputs.map((i) => ({
        boothId: i.boothId,
        reviewCount: i.reviewCount,
        starSum: i.starSum,
        lastReviewAt: i.lastReviewAt,
      })),
      opts,
    ).map((r) => [r.boothId, r]),
  );

  const entries: ResultEntry[] = inputs.map((i) => {
    const r = ranked.get(i.boothId);
    const tags = Object.entries(i.categoryCounts)
      .filter(([id, n]) => n > 0 && labels.has(id))
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
      .slice(0, TOP_TAGS)
      .map(([id, count]) => ({ label: labels.get(id) ?? id, count }));
    return {
      boothId: i.boothId,
      rank: r?.rank ?? null,
      name: i.name,
      boothNo: i.boothNo,
      coverThumbKey: i.coverThumbKey,
      average: i.reviewCount > 0 ? i.starSum / i.reviewCount : null,
      reviewCount: i.reviewCount,
      score: r?.score ?? null,
      topCategories: tags,
    };
  });

  return entries.sort((a, b) => {
    if (a.rank !== null && b.rank !== null) return a.rank - b.rank;
    if (a.rank !== null) return -1;
    if (b.rank !== null) return 1;
    return b.reviewCount - a.reviewCount || a.name.localeCompare(b.name, "id");
  });
}

/** Peringkat berubah dibanding hasil beku? (peringatan untuk admin: "Perbarui hasil"). */
export function resultsDiffer(a: readonly ResultEntry[], b: readonly ResultEntry[]): boolean {
  if (a.length !== b.length) return true;
  const key = (r: ResultEntry) => `${r.boothId}:${r.rank}:${r.reviewCount}:${r.average}`;
  const sa = a.map(key).join("|");
  const sb = b.map(key).join("|");
  return sa !== sb;
}
