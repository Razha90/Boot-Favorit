import type { PublicReview } from "@shared/api-types";
import { RatingStars } from "../../../components/shared/RatingStars";
import { Button } from "../../../components/ui/Button";
import { copy } from "../../../lib/copy";

/**
 * Satu ulasan. Murni tampilan. Bintang hilang bila rating disembunyikan admin; nama hanya nama depan/alias.
 * Teks sudah disamarkan server bila perlu; komentar yang ditahan/disembunyikan tidak pernah sampai ke sini (B25).
 */
export function ReviewItem({ review, onReport }: { review: PublicReview; onReport?: () => void }) {
  return (
    <article className="grid gap-2 rounded-card border-(length:--border-w) border-line bg-surface p-3">
      <header className="flex flex-wrap items-center gap-2 text-sm">
        <strong className="[overflow-wrap:anywhere]">{review.displayName}</strong>
        {review.stars !== null && <RatingStars mode="display" value={review.stars} size="sm" />}
      </header>
      <p className="whitespace-pre-line text-sm [overflow-wrap:anywhere]">{review.text}</p>
      {review.categories.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {review.categories.map((c) => (
            <li key={c.id} className="rounded-chip bg-surface-tint px-2 py-0.5 text-xs font-bold">
              {c.label}
            </li>
          ))}
        </ul>
      )}
      {onReport && (
        <Button size="sm" variant="ghost" className="w-fit" onClick={onReport}>
          {copy.event.reviews.report}
        </Button>
      )}
    </article>
  );
}
