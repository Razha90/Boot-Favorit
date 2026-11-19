import type { TopCategory } from "@shared/api-types";
import { useState } from "react";
import { Present } from "../../../components/shared/Present";
import { Button } from "../../../components/ui/Button";
import { copy } from "../../../lib/copy";
import { useEventState } from "../../../lib/event-state";
import { useReviewsQuery } from "../visitor-data";
import { ReportDialog } from "./ReportDialog";
import { ReviewItem } from "./ReviewItem";

/** "Sering disebut: Seru (12) · Ramah (9)"; hilang bila belum ada kategori yang dipilih siapa pun. */
export function TopCategories({ items }: { items: readonly TopCategory[] }) {
  return (
    <Present when={items.length > 0 ? items : null}>
      <p className="text-sm">
        <span className="font-bold">{copy.event.reviews.often}: </span>
        {items.map((c) => `${c.label} (${c.count})`).join(" · ")}
      </p>
    </Present>
  );
}

/** Ulasan pengunjung lain, terbaru dulu, dimuat bertahap. Tombol lapor hilang setelah event selesai (hanya-baca). */
export function ReviewsSection({ boothId }: { boothId: string }) {
  const q = useReviewsQuery(boothId);
  const { frozen } = useEventState();
  const [reporting, setReporting] = useState<string | null>(null);
  const reviews = q.data?.pages.flatMap((p) => p.reviews) ?? [];
  if (reviews.length === 0) return null;

  return (
    <div className="grid gap-3">
      <ul className="grid gap-3">
        {reviews.map((r) => (
          <li key={r.id}>
            <ReviewItem review={r} onReport={frozen ? undefined : () => setReporting(r.id)} />
          </li>
        ))}
      </ul>
      {q.hasNextPage && (
        <Button size="sm" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>
          {copy.event.reviews.more}
        </Button>
      )}
      {reporting && <ReportDialog reviewId={reporting} onClose={() => setReporting(null)} />}
    </div>
  );
}
