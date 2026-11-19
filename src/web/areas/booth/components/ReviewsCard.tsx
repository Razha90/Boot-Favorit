import type { PublicReview } from "@shared/api-types";
import { REPORT_REASONS } from "@shared/schemas";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { RatingStars } from "../../../components/shared/RatingStars";
import { ActionButton } from "../../../components/ui/ActionButton";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Field, Input, Select } from "../../../components/ui/Form";
import { Modal } from "../../../components/ui/Modal";
import { QueryState } from "../../../components/ui/states";
import { copy } from "../../../lib/copy";
import { formatDateTime } from "../../../lib/format";
import { boothApi, boothKeys } from "../booth-api";

/**
 * Ulasan masuk: HANYA BACA. Booth tidak bisa menghapus atau menyembunyikan ulasan (A4, A15): satu-satunya aksi adalah
 * melaporkan ke panitia, yang memutuskan.
 */
export function ReviewsCard({ timezone }: { timezone: string }) {
  const t = copy.booth.reviews;
  const q = useInfiniteQuery({
    queryKey: boothKeys.reviews,
    queryFn: ({ pageParam }) => boothApi.reviews(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next,
  });
  const [reporting, setReporting] = useState<PublicReview | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const items = q.data?.pages.flatMap((p) => p.reviews) ?? [];

  return (
    <Card title={t.title}>
      <p className="text-xs text-muted">{t.hint}</p>
      {note && (
        <p role="status" className="text-sm font-bold text-primary-strong">
          {note}
        </p>
      )}
      <QueryState loading={q.isLoading} error={q.error}>
        {items.length === 0 ? (
          <p className="text-sm text-muted">{t.empty}</p>
        ) : (
          <ul className="grid gap-3">
            {items.map((r) => (
              <li
                key={r.id}
                className="grid gap-1 rounded-card border-(length:--border-w) border-line p-3"
              >
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {r.stars !== null && <RatingStars mode="display" value={r.stars} size="sm" />}
                  <span className="font-bold">{r.displayName || t.anonymous}</span>
                  <span className="text-xs text-muted">
                    {formatDateTime(r.createdAt, timezone)}
                  </span>
                </div>
                {r.text ? (
                  <p className="text-sm [overflow-wrap:anywhere]">{r.text}</p>
                ) : (
                  <p className="text-sm text-muted">{copy.event.reviews.starsOnly}</p>
                )}
                {r.text && (
                  <div>
                    <Button size="sm" onClick={() => setReporting(r)}>
                      {t.report}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {q.hasNextPage && (
          <div>
            <ActionButton action={async () => void (await q.fetchNextPage())}>
              {t.more}
            </ActionButton>
          </div>
        )}
      </QueryState>
      <ReportDialog
        review={reporting}
        onClose={() => setReporting(null)}
        onDone={(already) => setNote(already ? t.alreadyReported : t.reported)}
      />
    </Card>
  );
}

function ReportDialog({
  review,
  onClose,
  onDone,
}: {
  review: PublicReview | null;
  onClose: () => void;
  onDone: (alreadyReported: boolean) => void;
}) {
  const t = copy.booth.reviews;
  const [reason, setReason] = useState<string>("other");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={review !== null} onClose={onClose} title={t.reportTitle} locked={busy}>
      {review?.text && <p className="text-sm [overflow-wrap:anywhere]">“{review.text}”</p>}
      <Field label={t.reportReason}>
        {(id) => (
          <Select id={id} value={reason} onChange={(e) => setReason(e.target.value)}>
            {REPORT_REASONS.map((r) => (
              <option key={r} value={r}>
                {t.reasons[r]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label={t.reportNote} info={t.reportNoteInfo}>
        {(id) => (
          <Input id={id} maxLength={200} value={text} onChange={(e) => setText(e.target.value)} />
        )}
      </Field>
      <div className="flex flex-wrap gap-2">
        <ActionButton
          variant="primary"
          resetOn={`${reason}|${text}|${review?.id}`}
          onStatusChange={(s) => setBusy(s === "pending")}
          action={async (ctx) => {
            if (!review) return;
            const r = await boothApi.report(
              review.id,
              { reason, ...(text.trim() && { note: text.trim() }) },
              ctx,
            );
            setText("");
            onDone(r.alreadyReported);
            onClose();
          }}
        >
          {t.send}
        </ActionButton>
        <Button onClick={onClose} disabled={busy}>
          {t.cancel}
        </Button>
      </div>
    </Modal>
  );
}
