import { fairOrder } from "@shared/fair-order";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { BoothGrid } from "../../../components/shared/BoothGrid";
import { ReadOnlyBanner } from "../../../components/shared/WriteAction";
import { EmptyState, ErrorState, Skeleton } from "../../../components/ui/states";
import { useEventData, useResultsQuery, useSnapshotQuery } from "../../../features/event-data";
import { LiveProvider, useLiveStatus } from "../../../features/live/live-context";
import { RevealLayer } from "../../../features/reveal/RevealLayer";
import { useReveal } from "../../../features/reveal/use-reveal";
import { copy } from "../../../lib/copy";
import { useEventState } from "../../../lib/event-state";
import { getVisitorSeed } from "../../../lib/visitor-seed";
import { SectionHeading } from "../components/chrome";
import { Hero } from "../components/Hero";
import { ResultsBanner } from "../components/ResultsBanner";
import { SpotlightSection } from "../components/SpotlightSection";
import { StandingsSection } from "../components/StandingsSection";

const STEP = 24; // dimuat bertahap ±24 kartu (A8)

/** Memuat bertahap saat sentinel terlihat. Urutan tidak diacak ulang saat data bertambah. */
function useProgressive(total: number) {
  const [count, setCount] = useState(STEP);
  const sentinel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || count >= total || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setCount((c) => c + STEP);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [count, total]);
  return { count, sentinel };
}

/** WebSocket live hanya di halaman ini (dashboard terbuka); halaman booth/QR tanpa realtime (B8). */
export function Component() {
  const state = useEventState();
  return (
    <LiveProvider enabled={!state.frozen}>
      <HomeContent />
    </LiveProvider>
  );
}

function HomeContent() {
  const { event, serverNow } = useEventData();
  const state = useEventState();
  const snapshot = useSnapshotQuery(event);
  const live = useLiveStatus();
  const reveal = useReveal({ area: "event", autoReplay: true });
  const results =
    useResultsQuery(
      event,
      snapshot.data?.resultsPublished ?? false,
      snapshot.data?.resultsVersion ?? 0,
    ).data?.results ?? null;
  const seed = useMemo(() => getVisitorSeed(), []);

  const booths = snapshot.data?.booths ?? [];
  // Urutan acak per pengunjung yang STABIL (hash(seed + id)): booth baru tidak menggeser yang lama (A8).
  const ordered = useMemo(() => fairOrder(booths, seed), [booths, seed]);
  const { count, sentinel } = useProgressive(ordered.length);
  const ratingsHidden = snapshot.data?.ratingsHidden ?? false;

  return (
    <>
      <Hero
        event={event}
        state={state}
        boothCount={booths.length}
        serverNow={serverNow}
        registrationVisible={state.registrationButtonVisible}
      />
      <div className="mx-auto grid max-w-6xl gap-4 px-4">
        <ReadOnlyBanner />
        {snapshot.data && !snapshot.data.ratingsHidden && snapshot.data.stats.reviewCount > 0 && (
          <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
            {live.connected && (
              <span className="rounded-chip border-(length:--border-w) border-line bg-sticker-4 px-2 text-xs text-primary-fg">
                {copy.screen.live}
              </span>
            )}
            {copy.event.hero.stats(
              snapshot.data.stats.reviewCount,
              snapshot.data.stats.boothCount,
              snapshot.data.stats.average,
            )}
          </p>
        )}
      </div>
      <ResultsBanner reveal={reveal} />
      <RevealLayer reveal={reveal} />

      <main id="booth" className="mx-auto grid max-w-6xl gap-12 px-4 py-6">
        {snapshot.isLoading && (
          <div className="grid gap-4" aria-busy="true">
            <Skeleton className="h-72 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}
        {snapshot.error && <ErrorState onRetry={() => void snapshot.refetch()} />}

        {snapshot.data && booths.length === 0 && (
          <EmptyState
            title={copy.event.empty.title}
            body={copy.event.empty.body}
            action={
              state.registrationButtonVisible ? (
                <Link to="/register" className="text-sm font-bold underline underline-offset-4">
                  {copy.event.hero.register}
                </Link>
              ) : undefined
            }
          />
        )}

        {booths.length > 0 && (
          <>
            <section aria-labelledby="sorotan" className="grid gap-4">
              <SectionHeading id="sorotan" n={1} {...copy.event.sections.spotlight} />
              <SpotlightSection
                booths={booths}
                seed={seed}
                serverNow={serverNow}
                ratingsHidden={ratingsHidden}
              />
            </section>

            <section aria-labelledby="semua" className="grid gap-4">
              <SectionHeading id="semua" n={2} {...copy.event.sections.all} />
              <BoothGrid
                booths={ordered.slice(0, count)}
                modeFrom={booths}
                ratingsHidden={ratingsHidden}
              />
              {count < ordered.length && <div ref={sentinel} aria-hidden="true" className="h-8" />}
            </section>
          </>
        )}

        {/* Bagian 03: SELALU paling bawah, tidak pernah di atas (A8). */}
        {snapshot.data && booths.length > 0 && (
          <StandingsSection snapshot={snapshot.data} frozen={state.frozen} results={results} />
        )}
      </main>
    </>
  );
}
