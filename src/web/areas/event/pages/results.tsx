import { ResultsList } from "../../../components/shared/ResultsList";
import { ReadOnlyBanner } from "../../../components/shared/WriteAction";
import { EmptyState, ErrorState, Skeleton } from "../../../components/ui/states";
import { useEventData, useResultsQuery, useSnapshotQuery } from "../../../features/event-data";
import { RevealLayer } from "../../../features/reveal/RevealLayer";
import { useReveal } from "../../../features/reveal/use-reveal";
import { copy } from "../../../lib/copy";
import { useEventState } from "../../../lib/event-state";
import { BackButton, SectionHeading } from "../components/chrome";
import { ResultsBanner } from "../components/ResultsBanner";

/** Hasil akhir yang dibekukan (A8). Memutar animasi pemenang otomatis seperti halaman event; bisa dilewati. */
export function Component() {
  const { event } = useEventData();
  const state = useEventState();
  const snapshot = useSnapshotQuery(event);
  const published = snapshot.data?.resultsPublished ?? false;
  const version = snapshot.data?.resultsVersion ?? event.versions.results;
  const results = useResultsQuery(event, published, version);
  const reveal = useReveal({ area: "event", autoReplay: true });

  if (reveal.pending || reveal.overlay !== null) {
    return <RevealLayer reveal={reveal} />;
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 pb-16 pt-6">
      <BackButton>{copy.event.booth.back}</BackButton>
      <h1 className="font-display text-4xl font-extrabold [overflow-wrap:anywhere] sm:text-5xl">
        {event.name}
      </h1>
      <ReadOnlyBanner />
      <ResultsBanner reveal={reveal} />
      <RevealLayer reveal={reveal} />

      <section aria-labelledby="hasil" className="grid gap-4">
        <SectionHeading id="hasil" n={1} {...copy.results.heading} />
        {snapshot.isLoading && <Skeleton className="h-64 w-full" />}
        {snapshot.error && <ErrorState onRetry={() => void snapshot.refetch()} />}
        {snapshot.data && !published && (
          <EmptyState
            title={copy.results.notYet}
            body={state.frozen ? copy.results.ended : copy.event.rate.liveSoon}
          />
        )}
        {published && results.isLoading && <Skeleton className="h-64 w-full" />}
        {published && results.error && <ErrorState onRetry={() => void results.refetch()} />}
        {results.data?.results && <ResultsList results={results.data.results} />}
      </section>
    </div>
  );
}
