import type { LatestReview, PublicBooth, PublicSnapshot } from "@shared/api-types";
import { PhotoFrame } from "../../../components/shared/PhotoFrame";
import { RatingStars } from "../../../components/shared/RatingStars";
import { SafeImage } from "../../../components/shared/SafeImage";
import { copy } from "../../../lib/copy";
import { formatAverage, formatScore } from "../../../lib/format";
import { useMediaUrl } from "../../../lib/media-url";

// Panel Layar Besar: huruf besar, tanpa tombol/tautan (proyektor; A8). Murni tampilan dari snapshot.

const MAX_BOOTH_NAMES = 24;

function Rating({ booth, hidden }: { booth: PublicBooth; hidden: boolean }) {
  if (hidden) return <span className="text-2xl text-muted">{copy.visitor.ratingsHidden}</span>;
  if (booth.ratingAverage === null || booth.ratingCount === 0) {
    return <span className="text-2xl text-muted">{copy.visitor.noRatingsYet}</span>;
  }
  return (
    <span className="inline-flex items-center gap-3 text-3xl font-bold">
      {formatAverage(booth.ratingAverage)}
      <RatingStars mode="display" value={booth.ratingAverage} size="lg" />
      <span className="text-muted">({booth.ratingCount})</span>
    </span>
  );
}

/** Satu booth besar. Tanpa foto → nama sebagai tipografi besar tanpa kolom foto (A16). */
export function SpotlightPanel({
  booth,
  ratingsHidden,
}: {
  booth: PublicBooth;
  ratingsHidden: boolean;
}) {
  const resolve = useMediaUrl();
  const src = resolve(booth.coverKey);
  return (
    <div className="grid h-full content-center gap-8 lg:grid-cols-2 lg:items-center">
      {src && (
        <SafeImage
          src={src}
          aspect="4/3"
          className="w-full rounded-card"
          fallback={
            <PhotoFrame id={booth.id} name={booth.name} boothNo={booth.boothNo} size="winner" />
          }
        />
      )}
      <div className="grid gap-5">
        {booth.boothNo && (
          <span className="w-fit rounded-chip border-(length:--border-w) border-line bg-sticker-3 px-4 py-1 text-3xl font-extrabold text-primary-fg">
            {copy.visitor.boothNo(booth.boothNo)}
          </span>
        )}
        <h2 className="font-display text-7xl font-extrabold leading-none [overflow-wrap:anywhere]">
          {booth.name}
        </h2>
        <Rating booth={booth} hidden={ratingsHidden} />
        {booth.tagline && <p className="font-hand text-5xl">{booth.tagline}</p>}
        <p className="text-3xl font-bold text-accent-strong">{copy.screen.visit}</p>
      </div>
    </div>
  );
}

/** Semua booth sebagai nama besar, urutan acak per putaran (tanpa peringkat, tanpa harga). */
export function BoothsPanel({ booths }: { booths: readonly PublicBooth[] }) {
  const shown = booths.slice(0, MAX_BOOTH_NAMES);
  return (
    <div className="grid h-full content-center gap-6">
      <ul className="grid gap-x-8 gap-y-4 text-4xl font-extrabold sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((b) => (
          <li key={b.id} className="flex items-baseline gap-3 [overflow-wrap:anywhere]">
            {b.boothNo && <span className="shrink-0 text-2xl text-muted">{b.boothNo}</span>}
            {b.name}
          </li>
        ))}
      </ul>
      {booths.length > shown.length && (
        <p className="text-2xl text-muted">+{booths.length - shown.length}</p>
      )}
    </div>
  );
}

export function FeedPanel({ feed }: { feed: readonly LatestReview[] }) {
  return (
    <ul className="grid h-full content-center gap-5">
      {feed.map((r) => (
        <li
          key={r.id}
          className="grid gap-1 rounded-card border-(length:--border-w) border-line bg-surface-raised p-5"
        >
          <div className="flex flex-wrap items-center gap-4 text-2xl">
            <strong className="[overflow-wrap:anywhere]">{r.boothName}</strong>
            {r.stars !== null && <RatingStars mode="display" value={r.stars} size="lg" />}
            <span className="text-muted">{r.displayName}</span>
          </div>
          <p className="text-3xl [overflow-wrap:anywhere]">{r.text}</p>
        </li>
      ))}
    </ul>
  );
}

/** Peringkat saat ini: panel TERAKHIR, hanya bila server mengirim peringkat (mengikuti mode admin). */
export function RankingPanel({
  ranking,
  booths,
}: {
  ranking: NonNullable<PublicSnapshot["ranking"]>;
  booths: ReadonlyMap<string, PublicBooth>;
}) {
  const rows = ranking.slice(0, 8).flatMap((r) => {
    const booth = booths.get(r.boothId);
    return booth ? [{ r, booth }] : [];
  });
  return (
    <ol className="grid h-full content-center gap-4">
      {rows.map(({ r, booth }, i) => (
        <li
          key={r.boothId}
          className={`grid grid-cols-[5rem_minmax(0,1fr)_auto] items-center gap-5 rounded-card border-(length:--border-w) border-line p-4 ${i === 0 ? "bg-surface-tint" : "bg-surface-raised"}`}
        >
          <span className="text-center font-display text-6xl font-extrabold">{r.rank}</span>
          <span className="text-4xl font-extrabold [overflow-wrap:anywhere]">{booth.name}</span>
          <span className="text-right text-2xl">
            {formatAverage(r.average)} ★ · {copy.results.score(formatScore(r.score))}
          </span>
        </li>
      ))}
    </ol>
  );
}
