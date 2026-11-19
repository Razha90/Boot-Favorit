import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { QueryState } from "../../../components/ui/states";
import { copy } from "../../../lib/copy";
import { AllReviewsCard, HeldList, QueueList } from "../components/ModerationLists";
import { TermsCard } from "../components/TermsCard";
import { moderationApi, moderationKeys } from "../moderation-api";

const M = copy.admin.moderation;
type Tab = "queue" | "held" | "all" | "terms";

export function Component() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("queue");
  const queue = useQuery({
    queryKey: moderationKeys.queue(id),
    queryFn: () => moderationApi.queue(id),
  });
  // Satu pintu muat ulang: keputusan mengubah antrean, daftar ulasan, dan statistik.
  const done = () => qc.invalidateQueries({ queryKey: moderationKeys.all() });
  const counts = { queue: queue.data?.reports.length ?? 0, held: queue.data?.held.length ?? 0 };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">{M.title}</h1>
      </div>

      <div role="tablist" aria-label={M.title} className="flex flex-wrap gap-2">
        {(["queue", "held", "all", "terms"] as const).map((t) => (
          <Button
            key={t}
            role="tab"
            aria-selected={tab === t}
            variant={tab === t ? "primary" : "secondary"}
            onClick={() => setTab(t)}
          >
            {M.tabs[t]}
            {t === "queue" || t === "held" ? ` (${counts[t]})` : ""}
          </Button>
        ))}
      </div>

      {tab === "queue" && (
        <Card title={M.tabs.queue}>
          <QueryState loading={queue.isLoading} error={queue.error}>
            <QueueList eventId={id} groups={queue.data?.reports ?? []} done={done} />
          </QueryState>
        </Card>
      )}
      {tab === "held" && (
        <Card title={M.tabs.held}>
          <QueryState loading={queue.isLoading} error={queue.error}>
            <HeldList eventId={id} reviews={queue.data?.held ?? []} done={done} />
          </QueryState>
        </Card>
      )}
      {tab === "all" && <AllReviewsCard eventId={id} done={done} />}
      {tab === "terms" && <TermsCard eventId={id} />}
    </>
  );
}
