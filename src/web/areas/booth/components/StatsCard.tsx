import type { BoothStatsView } from "@shared/api-types";
import { RatingStars } from "../../../components/shared/RatingStars";
import { Card } from "../../../components/ui/Card";
import { copy } from "../../../lib/copy";
import { formatAverage } from "../../../lib/format";

/** Ringkasan penilaian. Mengikuti aturan tampil publik: bila rating disembunyikan panitia, tidak ada angka sama sekali. */
export function StatsCard({ stats }: { stats: BoothStatsView }) {
  const t = copy.booth.stats;
  if (!stats.ratingsVisible) {
    return (
      <Card title={t.title}>
        <p className="text-sm text-muted">{t.hidden}</p>
      </Card>
    );
  }
  const total = stats.reviewCount ?? 0;
  const dist = stats.distribution ?? [0, 0, 0, 0, 0];
  const max = Math.max(1, ...dist);
  return (
    <Card title={t.title}>
      {total === 0 ? (
        <p className="text-sm text-muted">{t.empty}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-display text-4xl font-extrabold">
              {stats.average !== null ? formatAverage(stats.average) : "–"}
            </span>
            {stats.average !== null && <RatingStars mode="display" value={stats.average} />}
            <span className="text-sm text-muted">{t.reviews(total)}</span>
          </div>
          <ul className="grid gap-1" aria-label={t.title}>
            {[5, 4, 3, 2, 1].map((n) => {
              const count = dist[n - 1] ?? 0;
              return (
                <li key={n} className="grid grid-cols-[5rem_1fr_2rem] items-center gap-2 text-sm">
                  <span>{t.distribution(n)}</span>
                  <span
                    className="h-2 overflow-hidden rounded-full bg-star-off/30"
                    aria-hidden="true"
                  >
                    <span
                      className="block h-full bg-star"
                      style={{ width: `${(count / max) * 100}%` }}
                    />
                  </span>
                  <span className="text-right tabular-nums">{count}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {stats.rankedCount !== null && (
        <p className="text-sm font-bold">
          {stats.rank !== null ? t.rank(stats.rank, stats.rankedCount) : t.unranked}
        </p>
      )}
    </Card>
  );
}
