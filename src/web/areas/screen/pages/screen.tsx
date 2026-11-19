import { CONFIG } from "@shared/config";
import { spotlightOrder } from "@shared/fair-order";
import { panelAt, type ScreenPanel, screenPanels } from "@shared/reveal";
import { useEffect, useMemo, useState } from "react";
import { ResultsList } from "../../../components/shared/ResultsList";
import { useEventData, useResultsQuery, useSnapshotQuery } from "../../../features/event-data";
import { LiveProvider, useLiveStatus } from "../../../features/live/live-context";
import { RevealLayer } from "../../../features/reveal/RevealLayer";
import { useReveal } from "../../../features/reveal/use-reveal";
import { copy } from "../../../lib/copy";
import { useEventState } from "../../../lib/event-state";
import { BoothsPanel, FeedPanel, RankingPanel, SpotlightPanel } from "../components/ScreenPanels";

const TITLES: Record<ScreenPanel, string> = {
  spotlight: copy.screen.spotlight,
  booths: copy.screen.booths,
  feed: copy.screen.feed,
  ranking: copy.screen.ranking,
  results: copy.screen.results,
};

/** Mode Layar Besar (A8): berganti panel otomatis, tanpa interaksi. Slot WebSocket dijamin (`?screen=1`). */
export function Component() {
  // Layar Besar tetap tersambung setelah event selesai: animasi pemenang diputar admin sesudahnya (soket `screen`).
  return (
    <LiveProvider enabled screen>
      <ScreenView />
    </LiveProvider>
  );
}

function ScreenView() {
  const { event, serverNow } = useEventData();
  const state = useEventState();
  const live = useLiveStatus();
  const snapshot = useSnapshotQuery(event).data;
  const results =
    useResultsQuery(event, snapshot?.resultsPublished ?? false, snapshot?.resultsVersion ?? 0).data
      ?.results ?? null;
  const reveal = useReveal({ area: "screen", autoReplay: false });

  // Jam server, satu kali per detik: semua layar berganti panel serentak tanpa satu pesan pun dari server.
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), 1000);
    return () => clearInterval(id);
  }, [serverNow]);

  const booths = snapshot?.booths ?? [];
  const panels = useMemo(
    () =>
      screenPanels({
        boothCount: booths.length,
        feedCount: snapshot?.feed.length ?? 0,
        rankingCount: snapshot?.ranking?.length ?? null,
        resultsPublished: snapshot?.resultsPublished ?? false,
        frozen: state.frozen,
      }),
    [booths.length, snapshot, state.frozen],
  );
  const ms = CONFIG.live.screenPanelMs;
  const start = event.schedule.eventStartAt;
  const panel = panelAt(panels, now, start, ms);
  const slot = Math.max(0, Math.floor((now - start) / ms));
  const elapsed = (now - start) % ms;

  // Sorotan: tiap kali panel Sorotan muncul, booth berikutnya (adil: satu putaran = semua booth tepat sekali).
  const cycle = panels.length > 0 ? Math.floor(slot / panels.length) : 0;
  const spot = useMemo(() => {
    if (booths.length === 0) return null;
    const order = spotlightOrder(booths, `layar:${event.id}`, Math.floor(cycle / booths.length));
    return order[cycle % booths.length] ?? null;
  }, [booths, event.id, cycle]);
  const boothMap = useMemo(() => new Map(booths.map((b) => [b.id, b])), [booths]);

  if (!snapshot || !panel) {
    return (
      <main className="grid min-h-dvh place-items-center p-8 text-center">
        <p className="font-display text-5xl font-extrabold">{event.name}</p>
        <p className="text-3xl text-muted">{copy.screen.waiting}</p>
      </main>
    );
  }

  return (
    <main className="grid min-h-dvh grid-rows-[auto_minmax(0,1fr)_auto] gap-6 p-8">
      <RevealLayer reveal={reveal} interactive={false} />
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-display text-4xl font-extrabold [overflow-wrap:anywhere]">
          {event.name}
        </h1>
        <div className="flex items-center gap-4">
          <span className="font-hand text-4xl text-accent-strong">{TITLES[panel]}</span>
          {live.connected && (
            <span className="rounded-chip border-(length:--border-w) border-line bg-sticker-4 px-3 py-1 text-xl font-extrabold text-primary-fg">
              {copy.screen.live}
            </span>
          )}
        </div>
      </header>

      <section aria-label={TITLES[panel]} className="min-h-0 overflow-hidden">
        {panel === "spotlight" && spot && (
          <SpotlightPanel key={spot.id} booth={spot} ratingsHidden={snapshot.ratingsHidden} />
        )}
        {panel === "booths" && <BoothsPanel booths={booths} />}
        {panel === "feed" && <FeedPanel feed={snapshot.feed} />}
        {panel === "ranking" && snapshot.ranking && (
          <RankingPanel ranking={snapshot.ranking} booths={boothMap} />
        )}
        {panel === "results" && results && <ResultsList results={results} interactive={false} />}
      </section>

      {/* Garis waktu tipis: kapan panel berganti. Animasi CSS; mulai dari posisi waktu server saat ini. */}
      <div className="h-1.5 overflow-hidden rounded-full bg-star-off" aria-hidden="true">
        <div
          key={`${panel}-${slot}`}
          className="h-full origin-left bg-primary-strong"
          style={{
            animation: `slide-fill ${ms}ms linear forwards`,
            animationDelay: `-${elapsed}ms`,
          }}
        />
      </div>
    </main>
  );
}
