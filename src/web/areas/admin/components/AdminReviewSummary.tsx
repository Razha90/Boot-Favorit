import type { AdminReview } from "@shared/api-types";
import { RatingStars } from "../../../components/shared/RatingStars";
import { Badge } from "../../../components/ui/Card";
import { copy } from "../../../lib/copy";

const M = copy.admin.moderation;

/**
 * Ringkasan satu ulasan untuk admin (khusus admin: memperlihatkan teks ASLI, status, dan sinyal risiko).
 * Murni tampilan; semua teks asli di-escape oleh React.
 */
export function AdminReviewSummary({ review: r }: { review: AdminReview }) {
  const flags = r.flags.join(", ");
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <strong className="[overflow-wrap:anywhere]">{r.boothName}</strong>
        <RatingStars mode="display" value={r.stars} size="sm" />
        <span className="text-muted">{r.displayName ?? copy.event.reviews.anonymous}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge tone={r.status === "visible" ? "primary" : "danger"}>
          {M.reviewStatus}: {M.status[r.status]}
        </Badge>
        {r.comment !== null && (
          <Badge tone={r.commentStatus === "visible" ? "primary" : "accent"}>
            {M.commentStatus}: {M.status[r.commentStatus]}
          </Badge>
        )}
        {r.commentLocked && <Badge>{M.locked}</Badge>}
        {(r.riskScore ?? 0) > 0 && <Badge tone="muted">{M.risk(r.riskScore ?? 0, flags)}</Badge>}
      </div>
      {r.comment === null ? (
        <p className="text-sm text-muted">{M.noComment}</p>
      ) : (
        <div className="grid gap-1 text-sm">
          <p>
            <span className="font-bold">{M.originalText}: </span>
            <span className="whitespace-pre-line [overflow-wrap:anywhere]">{r.comment}</span>
          </p>
          {r.commentMasked && (
            <p className="text-muted">
              <span className="font-bold">{M.maskedText}: </span>
              <span className="[overflow-wrap:anywhere]">{r.commentMasked}</span>
            </p>
          )}
        </div>
      )}
      {r.originalComment !== null && r.originalComment !== r.comment && (
        <p className="text-xs text-muted">
          {M.originalText} (sebelum disunting): {r.originalComment}
        </p>
      )}
    </div>
  );
}
