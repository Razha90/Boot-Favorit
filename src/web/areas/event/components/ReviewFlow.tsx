import type { PublicBoothDetail, ReviewSubmitResult } from "@shared/api-types";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ErrorState, Skeleton } from "../../../components/ui/states";
import { useEventData } from "../../../features/event-data";
import { copy } from "../../../lib/copy";
import { useTurnstile } from "../../../lib/turnstile";
import {
  invalidateAfterReview,
  invalidateAfterSession,
  useMyReviewsQuery,
  useVisitorQuery,
  visitorApi,
} from "../visitor-data";
import { LoginPanel } from "./LoginPanel";
import { ReviewForm } from "./ReviewForm";
import { ThankYou } from "./ThankYou";

/** Isi kartu "Beri penilaian" saat voting berjalan: masuk → isi form → terima kasih (A5). */
export function ReviewFlow({ booth }: { booth: PublicBoothDetail }) {
  const { event } = useEventData();
  const qc = useQueryClient();
  const meQ = useVisitorQuery();
  const me = meQ.data;
  const turnstile = useTurnstile(me?.turnstileSiteKey ?? null);
  const mine = useMyReviewsQuery(!!me?.visitor);
  const [result, setResult] = useState<ReviewSubmitResult | null>(null);

  if (meQ.error) return <ErrorState onRetry={() => void meQ.refetch()} />;
  if (meQ.isLoading || !me) return <Skeleton className="h-40 w-full" />;

  const humanReady = !turnstile.required || !!turnstile.token;
  const initial = mine.data?.reviews.find((r) => r.boothId === booth.id) ?? null;

  return (
    <div className="grid gap-4">
      <div ref={turnstile.ref} />
      {!me.visitor ? (
        <LoginPanel
          me={me}
          turnstile={turnstile}
          onLoggedIn={() => void invalidateAfterSession(qc)}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-card bg-surface-tint px-3 py-2 text-sm">
            <span className="font-bold">
              {copy.event.login.as(me.visitor.displayName ?? copy.event.login.anonymousName)}
            </span>
          </div>

          {result ? (
            <ThankYou result={result} onEdit={() => setResult(null)} />
          ) : mine.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <ReviewForm
              key={initial ? `edit-${initial.boothId}` : "new"}
              categories={event.reviewCategories}
              initial={initial}
              disabled={!humanReady}
              submit={async (values, ctx) => {
                const r = await visitorApi.submitReview(booth.id, values, turnstile.token, ctx);
                turnstile.reset();
                setResult(r);
                await invalidateAfterReview(qc, booth.id);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
