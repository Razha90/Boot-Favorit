import type { LatestReview, PublicBooth, PublicSnapshot } from "@shared/api-types";
import type { ResultEntry } from "@shared/results";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { RatingStars } from "../../../components/shared/RatingStars";
import { ResultsList } from "../../../components/shared/ResultsList";
import { SafeImage } from "../../../components/shared/SafeImage";
import { Button } from "../../../components/ui/Button";
import { Icon } from "../../../components/ui/Icon";
import { useToast } from "../../../components/ui/Toast";
import { pointerTiltProps } from "../../../features/fx/ClickFx";
import { useLiveStatus } from "../../../features/live/live-context";
import { cn } from "../../../lib/cn";
import { copy } from "../../../lib/copy";
import { formatAverage, formatScore } from "../../../lib/format";
import { useMediaUrl } from "../../../lib/media-url";
import { triggerSfx } from "../../../lib/sfx-bridge";
import { SectionHeading } from "./chrome";

function FeedItem({ r, index }: { r: LatestReview; index: number }) {
  const newest = index === 0;
  return (
    <li className="animate-feed-in">
      <Link
        to={`/b/${r.boothId}`}
        {...pointerTiltProps()}
        className={cn(
          "group flex h-full flex-col justify-between gap-3 rounded-card border-(length:--border-w) border-line p-4 shadow-card transition-transform duration-(--motion-fast) hover:-translate-y-0.5 active:translate-y-px active:shadow-press",
          newest ? "bg-primary-soft" : "bg-surface-raised",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 grid gap-1">
            <p className="truncate text-sm font-extrabold text-text">{r.displayName}</p>
            {r.stars !== null && <RatingStars mode="display" value={r.stars} size="sm" />}
          </div>
          {newest && (
            <span className="shrink-0 rounded-chip border-2 border-line bg-primary px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-primary-fg">
              {copy.standings.latestBadge}
            </span>
          )}
        </div>

        <div className="relative flex-1 pt-1">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="mb-1 size-4 text-primary-strong/40 fill-current"
          >
            <path d="M9.5 6A4.5 4.5 0 0 0 5 10.5v2.75A2.75 2.75 0 0 0 7.75 16h1.5A1.75 1.75 0 0 1 11 17.75v.25A2 2 0 0 1 9 20H7.5v2H9a4 4 0 0 0 4-4v-7.5A4.5 4.5 0 0 0 9.5 6Zm9 0A4.5 4.5 0 0 0 14 10.5v2.75A2.75 2.75 0 0 0 16.75 16h1.5A1.75 1.75 0 0 1 20 17.75v.25A2 2 0 0 1 18 20h-1.5v2H18a4 4 0 0 0 4-4v-7.5A4.5 4.5 0 0 0 18.5 6Z" />
          </svg>
          <p className="text-sm leading-relaxed font-medium text-text [overflow-wrap:anywhere]">
            {r.text}
          </p>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-line/15 pt-2.5 text-xs font-extrabold">
          <span className="inline-flex min-w-0 items-center gap-1.5 text-text">
            <Icon name="store" className="size-3.5 shrink-0 text-primary-strong" />
            <span className="truncate">{r.boothName}</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-primary-strong">
            <span>{copy.standings.visitBooth}</span>
            <Icon
              name="arrow-right"
              className="size-3.5 transition-transform group-hover:translate-x-0.5"
            />
          </span>
        </div>
      </Link>
    </li>
  );
}

/** Ulasan terbaru (5 item). `aria-live="polite"`: pembaruan datang per tick (2,5 detik), tidak per review. */
export function LatestReviews({ feed }: { feed: readonly LatestReview[] }) {
  const live = useLiveStatus();
  const prevTop = useRef<string | null>(feed[0]?.id ?? null);
  useEffect(() => {
    const top = feed[0]?.id ?? null;
    if (top && prevTop.current && top !== prevTop.current) {
      triggerSfx("ding");
    }
    if (top) prevTop.current = top;
  }, [feed]);
  if (feed.length === 0) return null;
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-xl font-extrabold">{copy.standings.latest}</h3>
        {live.more > 0 && (
          <Button size="sm" className="w-fit" onClick={live.resetMore}>
            {copy.standings.newReviews(live.more)}
          </Button>
        )}
      </div>
      <ul aria-live="polite" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {feed.map((r, i) => (
          <FeedItem key={r.id} r={r} index={i} />
        ))}
      </ul>
    </div>
  );
}

const RANK_BADGE_TONE: Record<number, string> = {
  1: "bg-accent text-accent-fg",
  2: "bg-sticker-4 text-primary-fg",
  3: "bg-sticker-5 text-primary-fg",
};

function RankingItem({
  rank,
  score,
  booth,
  isTop,
}: {
  rank: number;
  score: number;
  booth: PublicBooth;
  isTop: boolean;
}) {
  const resolve = useMediaUrl();
  const src = resolve(booth.coverThumbKey);
  const [failed, setFailed] = useState(false);
  const hasThumb = !!src && !failed;
  const pct = Math.min(100, Math.max(8, (score / 5) * 100));

  return (
    <li>
      <Link
        to={`/b/${booth.id}`}
        className={cn(
          "group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3.5 rounded-card border-(length:--border-w) border-line px-4 py-3.5 shadow-card transition-transform duration-(--motion-fast) hover:-translate-y-0.5 active:translate-y-px active:shadow-press sm:gap-5",
          isTop ? "bg-sticker-3" : "bg-surface-raised",
        )}
      >
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-chip border-2 border-line font-display text-lg font-extrabold tabular-nums",
              RANK_BADGE_TONE[rank] ?? "bg-surface-tint text-text",
            )}
          >
            {rank}
          </span>
          {hasThumb && (
            <SafeImage
              src={src}
              aspect="1/1"
              className="hidden size-11 shrink-0 rounded-card border-2 border-line sm:block"
              onFail={() => setFailed(true)}
              fallback={null}
            />
          )}
        </div>

        <div className="grid min-w-0 gap-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="truncate font-display text-base font-extrabold text-text sm:text-lg">
              {booth.name}
            </span>
            {booth.boothNo && (
              <span className="shrink-0 rounded-chip border border-line bg-surface-raised px-2 py-0.5 text-[11px] font-extrabold text-text">
                {booth.boothNo}
              </span>
            )}
          </div>
          {booth.teamName && <p className="truncate text-xs text-muted">{booth.teamName}</p>}
          {booth.ratingAverage !== null && booth.ratingCount > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-text tabular-nums">
              <span>{formatAverage(booth.ratingAverage)}</span>
              <RatingStars mode="display" value={booth.ratingAverage} size="sm" />
              <span className="text-muted">({booth.ratingCount})</span>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="grid justify-items-end gap-1 text-right tabular-nums">
            <span className="rounded-chip border-2 border-line bg-surface-raised px-2.5 py-0.5 text-xs font-extrabold text-text">
              {copy.standings.score(formatScore(score))}
            </span>
            <div
              aria-hidden="true"
              className="hidden h-1.5 w-24 overflow-hidden rounded-full border border-line bg-surface-raised sm:block sm:w-28"
            >
              <div
                style={{ width: `${pct}%` }}
                className={cn("h-full rounded-full", isTop ? "bg-accent" : "bg-primary")}
              />
            </div>
          </div>
          <Icon
            name="arrow-right"
            className="hidden size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-text sm:block"
          />
        </div>
      </Link>
    </li>
  );
}

/** Peringkat saat ini. Baris pertama diberi latar; tanpa mahkota/confetti. Kartu booth lain TIDAK memuat peringkat. */
function Ranking({
  ranking,
  booths,
}: {
  ranking: NonNullable<PublicSnapshot["ranking"]>;
  booths: ReadonlyMap<string, PublicBooth>;
}) {
  const rows = ranking.flatMap((r) => {
    const booth = booths.get(r.boothId);
    return booth ? [{ r, booth }] : [];
  });
  if (rows.length === 0) return null;
  return (
    <div className="grid gap-3">
      <h3 className="font-display text-xl font-extrabold">{copy.standings.ranking}</h3>
      <ol className="grid gap-3">
        {rows.map(({ r, booth }, i) => (
          <RankingItem
            key={r.boothId}
            rank={r.rank}
            score={r.score}
            booth={booth}
            isTop={i === 0}
          />
        ))}
      </ol>
    </div>
  );
}

/**
 * Bagian 03 (A8): SELALU paling bawah. Peringkat hanya bila server mengirimnya (mode peringkat/rating); setelah hasil
 * diumumkan dan event selesai, isinya hasil akhir yang dibekukan. Tanpa peringkat → hanya "Ulasan terbaru".
 */
export function StandingsSection({
  snapshot,
  frozen,
  results,
}: {
  snapshot: PublicSnapshot;
  frozen: boolean;
  /** Hasil beku (hanya terisi setelah diumumkan) */
  results: readonly ResultEntry[] | null;
}) {
  const toast = useToast();
  const live = useLiveStatus();
  const booths = new Map(snapshot.booths.map((b) => [b.id, b]));

  // Toast "X naik ke peringkat 1" (peringkat 1 berganti); hanya bila peringkat memang tampil, sekali per kejadian.
  const shownNonce = useRef(0);
  const { leader } = live;
  useEffect(() => {
    if (!leader || leader.nonce === shownNonce.current || snapshot.ranking === null) return;
    const name = snapshot.booths.find((b) => b.id === leader.boothId)?.name;
    shownNonce.current = leader.nonce;
    if (name) {
      triggerSfx("rank");
      toast.push(copy.standings.leaderUp(name), "success");
    }
  }, [leader, snapshot.ranking, snapshot.booths, toast]);

  const finished = frozen && snapshot.resultsPublished && results !== null;
  const hasRanking = snapshot.ranking !== null && snapshot.ranking.length > 0;
  if (
    !finished &&
    !hasRanking &&
    snapshot.feed.length === 0 &&
    !(frozen && !snapshot.resultsPublished)
  )
    return null;

  return (
    <section aria-labelledby="peringkat" className="grid gap-6">
      <SectionHeading
        id="peringkat"
        n={3}
        {...(finished ? copy.results.heading : copy.standings.heading)}
      />
      {finished ? (
        <ResultsList results={results} />
      ) : (
        <>
          {frozen && !snapshot.resultsPublished && (
            <p className="text-sm font-bold">{copy.standings.waiting}</p>
          )}
          {snapshot.ranking && <Ranking ranking={snapshot.ranking} booths={booths} />}
        </>
      )}
      <LatestReviews feed={snapshot.feed} />
    </section>
  );
}
