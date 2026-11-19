import type { LatestReview, PublicBooth, PublicSnapshot } from "@shared/api-types";
import type { ResultEntry } from "@shared/results";
import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { BoothCard } from "../../../components/shared/BoothCard";
import { RatingStars } from "../../../components/shared/RatingStars";
import { ResultsList } from "../../../components/shared/ResultsList";
import { Button } from "../../../components/ui/Button";
import { useToast } from "../../../components/ui/Toast";
import { useLiveStatus } from "../../../features/live/live-context";
import { copy } from "../../../lib/copy";
import { formatScore } from "../../../lib/format";
import { triggerSfx } from "../../../lib/sfx-bridge";
import { SectionHeading } from "./chrome";

function FeedItem({ r }: { r: LatestReview }) {
  return (
    <li className="animate-feed-in grid gap-1 rounded-card border-(length:--border-w) border-line bg-surface-raised p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          to={`/b/${r.boothId}`}
          className="font-bold underline-offset-4 hover:underline [overflow-wrap:anywhere]"
        >
          {r.boothName}
        </Link>
        {r.stars !== null && <RatingStars mode="display" value={r.stars} size="sm" />}
        <span className="text-muted">{r.displayName}</span>
      </div>
      <p className="text-sm [overflow-wrap:anywhere]">{r.text}</p>
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
      <h3 className="font-display text-xl font-extrabold">{copy.standings.latest}</h3>
      {live.more > 0 && (
        <Button size="sm" className="w-fit" onClick={live.resetMore}>
          {copy.standings.newReviews(live.more)}
        </Button>
      )}
      <ul aria-live="polite" className="grid gap-2">
        {feed.map((r) => (
          <FeedItem key={r.id} r={r} />
        ))}
      </ul>
    </div>
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
      <ol className="grid gap-2">
        {rows.map(({ r, booth }, i) => (
          <li key={r.boothId} className={i === 0 ? "rounded-card bg-surface-tint p-1" : undefined}>
            <BoothCard booth={booth} variant="row" rank={r.rank} />
            <p className="px-3 pb-1 text-xs text-muted">
              {copy.standings.score(formatScore(r.score))}
            </p>
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted">{copy.standings.rankingNote}</p>
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
