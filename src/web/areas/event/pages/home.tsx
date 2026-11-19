import { fairOrder } from "@shared/fair-order";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { BoothGrid } from "../../../components/shared/BoothGrid";
import { HomeInitialSkeleton, SkeletonCrossfade } from "../../../components/shared/PageSkeletons";
import { ReadOnlyBanner } from "../../../components/shared/WriteAction";
import { EmptyState, ErrorState } from "../../../components/ui/states";
import { useGateSkeletonShown } from "../../../features/EventBoundary";
import { useEventData, useResultsQuery, useSnapshotQuery } from "../../../features/event-data";
import { LiveProvider, useLiveStatus } from "../../../features/live/live-context";
import { RevealLayer } from "../../../features/reveal/RevealLayer";
import { useReveal } from "../../../features/reveal/use-reveal";
import { copy } from "../../../lib/copy";
import { useEventState } from "../../../lib/event-state";
import { getVisitorSeed } from "../../../lib/visitor-seed";
import { SectionHeading } from "../components/chrome";
import { Hero } from "../components/Hero";
import { HomeSidebar } from "../components/HomeSidebar";
import { ResultsBanner } from "../components/ResultsBanner";
import { SpotlightSection } from "../components/SpotlightSection";
import { StandingsSection } from "../components/StandingsSection";
import { StatsBand } from "../components/StatsBand";
import { useVisitorQuery } from "../visitor-data";

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
  const gateShown = useGateSkeletonShown();
  const state = useEventState();
  const snapshot = useSnapshotQuery(event);
  const meQ = useVisitorQuery();
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
  const reviewedBoothIds = useMemo(
    () => meQ.data?.reviewed.map((r) => r.boothId) ?? [],
    [meQ.data?.reviewed],
  );
  // Urutan acak per pengunjung yang STABIL (hash(seed + id)): booth baru tidak menggeser yang lama (A8).
  const ordered = useMemo(() => fairOrder(booths, seed), [booths, seed]);
  const { count, sentinel } = useProgressive(ordered.length);
  const ratingsHidden = snapshot.data?.ratingsHidden ?? false;

  const initialPending = snapshot.isLoading && !snapshot.data;

  // Saat animasi pemenang diputar otomatis di awal kunjungan, langsung tampilkan panggung animasi tanpa kilasan beranda dulu.
  if (reveal.pending || reveal.overlay !== null) {
    return <RevealLayer reveal={reveal} />;
  }

  return (
    <SkeletonCrossfade
      loading={initialPending}
      delayMs={gateShown ? 0 : 100}
      skeleton={<HomeInitialSkeleton />}
    >
      <Hero
        event={event}
        state={state}
        boothCount={booths.length}
        serverNow={serverNow}
        registrationVisible={state.registrationButtonVisible}
      />
      {snapshot.data && (
        <StatsBand
          stats={snapshot.data.stats}
          ratingsHidden={snapshot.data.ratingsHidden}
          state={state}
          eventStartAt={event.schedule.eventStartAt}
          eventEndAt={event.schedule.eventEndAt}
          serverNow={serverNow}
          liveConnected={live.connected}
        />
      )}
      <ReadOnlyBanner />
      <ResultsBanner reveal={reveal} />
      <RevealLayer reveal={reveal} />

      <main id="booth" className="mx-auto grid max-w-7xl gap-10 px-4 py-8">
        <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-start">
          <HomeSidebar
            booths={booths}
            state={state}
            eventStartAt={event.schedule.eventStartAt}
            eventEndAt={event.schedule.eventEndAt}
            serverNow={serverNow}
            visitor={meQ.data?.visitor}
            reviewedBoothIds={reviewedBoothIds}
          ></HomeSidebar>
          <div className="grid min-w-0 gap-10 xl:col-start-1 xl:row-start-1">
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
                  {count < ordered.length && (
                    <div ref={sentinel} aria-hidden="true" className="h-8" />
                  )}
                </section>
              </>
            )}
          </div>
        </div>

        {/* Bagian 03: SELALU paling bawah, tidak pernah di atas (A8). */}
        {snapshot.data && booths.length > 0 && (
          <StandingsSection snapshot={snapshot.data} frozen={state.frozen} results={results} />
        )}
      </main>
    </SkeletonCrossfade>
  );
}
