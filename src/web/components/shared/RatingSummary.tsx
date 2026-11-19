import { copy } from "../../lib/copy";
import { formatAverage } from "../../lib/format";
import { RatingStars } from "./RatingStars";

/**
 * Ringkasan rating: `4,7 ★★★★★ (24)`.
 * - disembunyikan admin → "Rating disembunyikan" (datanya pun tidak dikirim server, A3)
 * - belum ada ulasan   → "Belum ada ulasan" (tidak pernah "0,0 ★")
 */
export function RatingSummary({
  average,
  count,
  hidden = false,
  size = "md",
}: {
  average: number | null;
  count: number;
  hidden?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  if (hidden) return <span className="text-sm text-muted">{copy.visitor.ratingsHidden}</span>;
  if (average === null || count === 0) {
    return <span className="text-sm text-muted">{copy.visitor.noRatingsYet}</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <b className="text-sm">{formatAverage(average)}</b>
      <RatingStars mode="display" value={average} size={size} />
      <span className="text-sm text-muted">({count})</span>
    </span>
  );
}
