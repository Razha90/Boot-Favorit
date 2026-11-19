import type { LatestReview } from "@shared/api-types";
import { CONFIG } from "@shared/config";
import { spotlightOrder } from "@shared/fair-order";
import { panelAt, type ScreenPanel, screenPanels } from "@shared/reveal";
import { useEffect, useMemo, useRef, useState } from "react";
import { ResultsList } from "../../../components/shared/ResultsList";
import { useEventData, useResultsQuery, useSnapshotQuery } from "../../../features/event-data";
import { LiveProvider, useLiveStatus } from "../../../features/live/live-context";
import { RevealLayer } from "../../../features/reveal/RevealLayer";
import { useReveal } from "../../../features/reveal/use-reveal";
import { cn } from "../../../lib/cn";
import { copy } from "../../../lib/copy";
import { useEventState } from "../../../lib/event-state";
import { formatAverage } from "../../../lib/format";
import { BoothsPanel, FeedPanel, RankingPanel, SpotlightPanel } from "../components/ScreenPanels";

const TITLES: Record<ScreenPanel, string> = {
  spotlight: copy.screen.spotlight,
  booths: copy.screen.booths,
  feed: copy.screen.feed,
  ranking: copy.screen.ranking,
  results: copy.screen.results,
};

function wrapIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

/** Mode Layar Besar (A8): berganti panel otomatis, tanpa tombol/tautan, tetap responsif keyboard panitia. Slot WebSocket dijamin (`?screen=1`). */
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

  // Kendali operator lokal via keyboard (tanpa tombol/tautan di DOM agar mode proyektor tetap bersih).
  const [paused, setPaused] = useState(false);
  const [panelOffset, setPanelOffset] = useState(0);
  const [boothOffset, setBoothOffset] = useState(0);

  // Jam server, satu kali per detik saat aktif: semua layar berganti panel serentak tanpa pesan server.
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setNow(serverNow()), 1000);
    return () => clearInterval(id);
  }, [paused, serverNow]);

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

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === "Space" || e.key === "p" || e.key === "P") {
        e.preventDefault();
        setPaused((v) => !v);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setPanelOffset((v) => v + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setPanelOffset((v) => v - 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setBoothOffset((v) => v + 1);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setBoothOffset((v) => v - 1);
      } else if (e.key === "r" || e.key === "R") {
        setPaused(false);
        setPanelOffset(0);
        setBoothOffset(0);
        setNow(serverNow());
      } else if (e.key === "f" || e.key === "F") {
        if (document.fullscreenElement) {
          void document.exitFullscreen?.().catch(() => {});
        } else {
          void document.documentElement.requestFullscreen?.().catch(() => {});
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [serverNow]);

  // Suar perayaan singkat saat ulasan baru masuk secara langsung di Layar Besar.
  const latestReview = snapshot?.feed[0] ?? null;
  const lastSeenReviewId = useRef<string | null>(null);
  const [liveFlare, setLiveFlare] = useState<LatestReview | null>(null);
  useEffect(() => {
    if (!latestReview) return;
    if (lastSeenReviewId.current === null) {
      lastSeenReviewId.current = latestReview.id;
      return;
    }
    if (lastSeenReviewId.current === latestReview.id) return;
    lastSeenReviewId.current = latestReview.id;
    setLiveFlare(latestReview);
    const timer = window.setTimeout(() => setLiveFlare(null), 5200);
    return () => window.clearTimeout(timer);
  }, [latestReview]);

  const ms = CONFIG.live.screenPanelMs;
  const start = event.schedule.eventStartAt;
  const basePanel = panelAt(panels, now, start, ms);
  const activeIndex = basePanel
    ? wrapIndex(panels.indexOf(basePanel) + panelOffset, panels.length)
    : 0;
  const panel = panels.length > 0 ? (panels[activeIndex] ?? null) : null;
  const slot = Math.max(0, Math.floor((now - start) / ms));
  const elapsed = (now - start) % ms;

  // Sorotan: tiap kali panel Sorotan muncul, booth berikutnya (adil: satu putaran = semua booth tepat sekali).
  const cycle = panels.length > 0 ? Math.floor(slot / panels.length) : 0;
  const spot = useMemo(() => {
    if (booths.length === 0) return null;
    const idx = wrapIndex(cycle + boothOffset, booths.length);
    const round = Math.floor((cycle + boothOffset) / booths.length);
    const order = spotlightOrder(booths, `layar:${event.id}`, Math.max(0, round));
    return order[idx] ?? null;
  }, [booths, boothOffset, cycle, event.id]);

  const spotQrUrl = useMemo(() => {
    if (!spot) return undefined;
    const origin =
      typeof window !== "undefined" && window.location.origin
        ? window.location.origin
        : "https://eventunimed.id";
    const u = new URL(`/b/${encodeURIComponent(spot.id)}`, origin);
    u.searchParams.set("src", "qr");
    return u.toString();
  }, [spot]);

  const boothMap = useMemo(() => new Map(booths.map((b) => [b.id, b])), [booths]);

  const tickerText = useMemo(() => {
    const items = (snapshot?.feed ?? []).slice(0, 5).map((r) => `${r.boothName}: “${r.text}”`);
    if (items.length === 0) return copy.screen.tickerInvite;
    return `${copy.screen.tickerInvite}  ·  ${items.join("  ·  ")}`;
  }, [snapshot?.feed]);

  const clockLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(now),
    [now],
  );

  if (!snapshot || !panel) {
    return (
      <main className="grid min-h-dvh w-full grid-cols-[minmax(0,1fr)] place-items-center p-8 text-center">
        <div className="screen-panel-in grid gap-3 border-l-4 border-primary pl-6 text-left">
          <p className="font-display text-5xl font-extrabold">{event.name}</p>
          <p className="text-3xl text-muted">{copy.screen.waiting}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative grid h-dvh w-full max-w-full grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)_auto] gap-6 overflow-hidden px-8 pt-7 pb-6">
      <div
        aria-hidden="true"
        className="fixed inset-x-0 top-0 z-20 grid h-2 grid-cols-[2fr_1fr] border-b-2 border-line"
      >
        <span className="bg-primary" />
        <span className="bg-accent" />
      </div>

      <RevealLayer reveal={reveal} interactive={false} />

      <header className="flex min-w-0 flex-wrap items-center justify-between gap-4 border-b-2 border-line pb-4">
        <div className="grid min-w-0 gap-1">
          <h1 className="font-display text-3xl leading-tight font-extrabold [overflow-wrap:anywhere] xl:text-4xl">
            {event.name}
          </h1>
          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm font-bold text-muted tabular-nums">
            <span>{copy.screen.boothCount(snapshot.stats.boothCount)}</span>
            <span aria-hidden="true">/</span>
            <span key={snapshot.stats.reviewCount} className="screen-flare-in text-primary-strong">
              {copy.screen.reviewCount(snapshot.stats.reviewCount)}
            </span>
            {!snapshot.ratingsHidden && snapshot.stats.average !== null && (
              <>
                <span aria-hidden="true">/</span>
                <span className="text-accent-strong">
                  ★ {copy.screen.avgLabel(formatAverage(snapshot.stats.average))}
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3.5">
          <span className="font-hand text-4xl text-accent-strong">{TITLES[panel]}</span>
          {paused && (
            <span className="rounded-chip border-2 border-line bg-sticker-3 px-3 py-1 text-sm font-extrabold text-primary-fg">
              {copy.screen.paused}
            </span>
          )}
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-chip border-(length:--border-w) border-line px-3.5 py-1 text-lg font-extrabold shadow-card",
              live.connected ? "bg-sticker-4 text-primary-fg" : "bg-surface-raised text-muted",
            )}
          >
            <span className="relative flex size-2.5">
              {live.connected && (
                <span
                  aria-hidden="true"
                  className="screen-live-ring absolute inline-flex size-full rounded-full bg-primary-strong"
                />
              )}
              <span
                aria-hidden="true"
                className={cn(
                  "relative inline-flex size-2.5 rounded-full",
                  live.connected ? "bg-primary-strong" : "bg-muted",
                )}
              />
            </span>
            {live.connected ? copy.screen.live : copy.screen.syncing}
          </span>
        </div>
      </header>

      {liveFlare && (
        <aside
          key={liveFlare.id}
          aria-live="polite"
          className="screen-flare-in pointer-events-none fixed top-24 right-8 z-30 flex items-center gap-3 rounded-card border-(length:--border-w) border-line bg-surface-raised px-5 py-3 shadow-card"
        >
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-line bg-primary text-primary-fg"
          >
            <svg viewBox="0 0 24 24" className="size-5 fill-current">
              <path d="m12 2 2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.1-1.01z" />
            </svg>
          </span>
          <div className="grid gap-0.5">
            <p className="text-xs font-extrabold uppercase tracking-wider text-primary-strong">
              {copy.screen.newReview}
            </p>
            <p className="text-base font-extrabold text-text">
              {liveFlare.boothName}
              {liveFlare.stars !== null ? ` · ★ ${liveFlare.stars}` : ""} · {liveFlare.displayName}
            </p>
          </div>
        </aside>
      )}

      <section
        aria-label={TITLES[panel]}
        className="flex min-h-0 min-w-0 items-center overflow-hidden py-2"
      >
        {panel === "spotlight" && spot && (
          <SpotlightPanel
            key={spot.id}
            booth={spot}
            ratingsHidden={snapshot.ratingsHidden}
            qrUrl={spotQrUrl}
          />
        )}
        {panel === "booths" && (
          <BoothsPanel
            key={`booths-${slot}`}
            booths={booths}
            ratingsHidden={snapshot.ratingsHidden}
          />
        )}
        {panel === "feed" && <FeedPanel key={`feed-${slot}`} feed={snapshot.feed} />}
        {panel === "ranking" && snapshot.ranking && (
          <RankingPanel key={`ranking-${slot}`} ranking={snapshot.ranking} booths={boothMap} />
        )}
        {panel === "results" && results && (
          <div className="screen-panel-in mx-auto h-full w-full max-w-5xl overflow-y-auto pr-1">
            <ResultsList results={results} interactive={false} />
          </div>
        )}
      </section>

      <footer className="grid min-w-0 gap-3 border-t-2 border-line pt-3.5">
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-5 text-sm">
          <div className="flex shrink-0 items-center gap-2">
            {panels.map((p, i) => (
              <span
                key={p}
                aria-hidden="true"
                className={cn(
                  "h-2 rounded-full border border-line transition-all",
                  i === activeIndex ? "w-7 bg-primary" : "w-2.5 bg-surface-tint",
                )}
              />
            ))}
            <span className="ml-1 font-bold text-text tabular-nums">
              {copy.screen.panelStep(activeIndex + 1, panels.length)}
            </span>
          </div>

          <div
            aria-hidden="true"
            className="min-w-0 overflow-hidden rounded-chip border-2 border-line bg-surface-raised px-4 py-1"
          >
            <div
              className="flex w-max gap-12 whitespace-nowrap text-sm font-bold text-text"
              style={{
                animation: "fx-marquee 26s linear infinite",
                animationPlayState: paused ? "paused" : "running",
              }}
            >
              <span>{tickerText}</span>
              <span>{tickerText}</span>
            </div>
          </div>

          <span className="shrink-0 font-display text-lg font-extrabold text-text tabular-nums">
            {clockLabel}
          </span>
        </div>

        {/* Garis waktu tipis: kapan panel berganti. Animasi CSS; mulai dari posisi waktu server saat ini. */}
        <div
          className="h-2.5 overflow-hidden rounded-full border-2 border-line bg-surface-tint"
          aria-hidden="true"
        >
          <div
            key={`${panel}-${slot}-${panelOffset}`}
            className="h-full origin-left bg-primary"
            style={{
              animation: `slide-fill ${ms}ms linear forwards`,
              animationDelay: `-${elapsed}ms`,
              animationPlayState: paused ? "paused" : "running",
            }}
          />
        </div>
      </footer>
    </main>
  );
}
