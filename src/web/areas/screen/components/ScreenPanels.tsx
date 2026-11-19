import type { LatestReview, PublicBooth, PublicSnapshot } from "@shared/api-types";
import { useEffect, useState } from "react";
import { QrCode } from "../../../components/shared/QrCode";
import { RatingStars } from "../../../components/shared/RatingStars";
import { SafeImage } from "../../../components/shared/SafeImage";
import { cn } from "../../../lib/cn";
import { copy } from "../../../lib/copy";
import { formatAverage, formatScore } from "../../../lib/format";
import { useMediaUrl } from "../../../lib/media-url";

// Panel Layar Besar: huruf besar, tanpa tombol/tautan (proyektor; A8). Murni tampilan dari snapshot.

const MAX_BOOTH_NAMES = 24;
const STRIPE_ACCENTS = ["bg-primary", "bg-accent", "bg-sticker-4", "bg-sticker-3"] as const;

function Rating({ booth, hidden }: { booth: PublicBooth; hidden: boolean }) {
  if (hidden) return <span className="text-2xl text-muted">{copy.visitor.ratingsHidden}</span>;
  if (booth.ratingAverage === null || booth.ratingCount === 0) {
    return <span className="text-2xl font-bold text-accent-strong">{copy.screen.firstRater}</span>;
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-3.5 text-3xl font-bold tabular-nums">
      <span className="font-display text-4xl font-extrabold text-accent-strong">
        {formatAverage(booth.ratingAverage)}
      </span>
      <RatingStars mode="display" value={booth.ratingAverage} size="lg" />
      <span className="text-xl font-semibold text-muted">
        {copy.screen.reviewCount(booth.ratingCount)}
      </span>
    </span>
  );
}

/** Satu booth besar + kartu pindai QR bila tersedia; tanpa bingkai inisial bila tak ada gambar. */
export function SpotlightPanel({
  booth,
  ratingsHidden,
  qrUrl,
}: {
  booth: PublicBooth;
  ratingsHidden: boolean;
  qrUrl?: string;
}) {
  const resolve = useMediaUrl();
  const src = resolve(booth.coverKey);
  const [failed, setFailed] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: foto baru = coba lagi
  useEffect(() => setFailed(false), [src]);
  const hasPhoto = !!src && !failed;
  const twoCol = hasPhoto || !!qrUrl;

  return (
    <div
      className={cn(
        "screen-panel-in mx-auto grid w-full max-w-6xl content-center gap-10",
        twoCol && "lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,22rem)] lg:items-center lg:gap-12",
      )}
    >
      <div className="grid gap-5">
        {booth.boothNo && (
          <span className="w-fit -rotate-1 rounded-chip border-(length:--border-w) border-line bg-sticker-3 px-4 py-1 text-2xl font-extrabold text-primary-fg shadow-card">
            {copy.visitor.boothNo(booth.boothNo)}
          </span>
        )}

        <h2 className="font-display text-6xl leading-[0.98] font-extrabold tracking-tight [overflow-wrap:anywhere] xl:text-8xl">
          {booth.name}
        </h2>

        <Rating booth={booth} hidden={ratingsHidden} />

        {booth.tagline && (
          <p className="font-hand text-4xl text-accent-strong xl:text-5xl">{booth.tagline}</p>
        )}

        <p className="w-fit rounded-chip border-(length:--border-w) border-line bg-primary-soft px-5 py-2 text-2xl font-extrabold text-primary-strong shadow-card xl:text-3xl">
          {copy.screen.visit}
        </p>
      </div>

      {hasPhoto && (
        <div className="grid gap-4">
          <div className="overflow-hidden rounded-card border-(length:--border-w) border-line bg-surface-raised p-2 shadow-card">
            <SafeImage
              src={src}
              aspect="4/3"
              className="w-full rounded-card"
              onFail={() => setFailed(true)}
              fallback={null}
            />
          </div>
          {qrUrl && (
            <div className="flex items-center gap-4 rounded-card border-(length:--border-w) border-line bg-qr-bg px-4 py-3 text-qr-fg shadow-card">
              <div className="size-20 shrink-0">
                <QrCode
                  value={qrUrl}
                  label={copy.screen.qrBoothLabel(booth.name)}
                  className="size-full"
                />
              </div>
              <div className="grid gap-0.5">
                <p className="text-base font-extrabold">{copy.screen.scanPrompt}</p>
                <p className="text-xs text-muted">{copy.screen.scanHint}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {!hasPhoto && qrUrl && (
        <div className="screen-card-in overflow-hidden rounded-card border-(length:--border-w) border-line bg-qr-bg text-qr-fg shadow-card">
          <div className="h-3 w-full border-b-2 border-line bg-primary" aria-hidden="true" />
          <div className="grid justify-items-center gap-4 p-6 text-center">
            <QrCode
              value={qrUrl}
              label={copy.screen.qrBoothLabel(booth.name)}
              className="size-48 xl:size-52"
            />
            <div className="grid gap-1 border-t-2 border-dashed border-line/35 pt-3">
              <p className="font-display text-xl font-extrabold text-qr-fg">
                {copy.screen.scanPrompt}
              </p>
              <p className="text-xs font-medium text-muted">{copy.screen.scanHint}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Semua booth sebagai direktori panggung bertahap, urutan acak per putaran (tanpa peringkat, tanpa harga). */
export function BoothsPanel({
  booths,
  ratingsHidden = false,
}: {
  booths: readonly PublicBooth[];
  ratingsHidden?: boolean;
}) {
  const shown = booths.slice(0, MAX_BOOTH_NAMES);
  return (
    <div className="screen-panel-in mx-auto grid w-full max-w-6xl content-center gap-5">
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {shown.map((b, i) => (
          <li
            key={b.id}
            style={{ animationDelay: `${Math.min(i, 15) * 40}ms` }}
            className="screen-card-in flex flex-col justify-between overflow-hidden rounded-card border-(length:--border-w) border-line bg-surface-raised shadow-card"
          >
            <div
              aria-hidden="true"
              className={cn(
                "h-2.5 w-full border-b-2 border-line",
                STRIPE_ACCENTS[i % STRIPE_ACCENTS.length],
              )}
            />
            <div className="flex flex-1 flex-col justify-between gap-3 p-4">
              <div className="flex items-center justify-between gap-2 text-sm font-bold tabular-nums">
                <span className="rounded-chip border border-line bg-surface-tint px-2.5 py-0.5 text-text">
                  {b.boothNo ?? "—"}
                </span>
                {!ratingsHidden && b.ratingAverage !== null && b.ratingCount > 0 && (
                  <span className="text-accent-strong">★ {formatAverage(b.ratingAverage)}</span>
                )}
              </div>
              <p className="font-display text-2xl leading-tight font-extrabold [overflow-wrap:anywhere]">
                {b.name}
              </p>
            </div>
          </li>
        ))}
      </ul>
      {booths.length > shown.length && (
        <p className="text-2xl font-bold text-muted">+{booths.length - shown.length}</p>
      )}
    </div>
  );
}

export function FeedPanel({ feed }: { feed: readonly LatestReview[] }) {
  const visible = feed.slice(0, 6);
  return (
    <ul className="screen-panel-in mx-auto grid w-full max-w-6xl content-center gap-5 lg:grid-cols-2">
      {visible.map((r, i) => (
        <li
          key={r.id}
          style={{ animationDelay: `${i * 65}ms` }}
          className={cn(
            "screen-card-in grid content-between gap-3 rounded-card border-(length:--border-w) border-line p-5 shadow-card",
            i === 0 ? "bg-primary-soft" : "bg-surface-raised",
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-xl">
              <strong className="font-display text-2xl font-extrabold [overflow-wrap:anywhere]">
                {r.boothName}
              </strong>
              {r.stars !== null && <RatingStars mode="display" value={r.stars} size="lg" />}
            </div>
            {i === 0 && (
              <span className="rounded-chip border-2 border-line bg-primary px-3 py-0.5 text-xs font-extrabold uppercase tracking-wider text-primary-fg">
                {copy.screen.latestBadge}
              </span>
            )}
          </div>
          <p className="text-2xl leading-snug text-text [overflow-wrap:anywhere]">“{r.text}”</p>
          <p className="text-base font-bold text-muted">— {r.displayName}</p>
        </li>
      ))}
    </ul>
  );
}

const RANK_BADGE: Record<number, string> = {
  1: "bg-accent text-accent-fg",
  2: "bg-sticker-4 text-primary-fg",
  3: "bg-sticker-5 text-primary-fg",
};

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
    <ol className="screen-panel-in mx-auto grid w-full max-w-5xl content-center gap-4">
      {rows.map(({ r, booth }, i) => {
        const pct = Math.min(100, Math.max(8, (r.score / 5) * 100));
        return (
          <li
            key={r.boothId}
            style={{ animationDelay: `${i * 65}ms` }}
            className={cn(
              "screen-card-in grid grid-cols-[3.75rem_minmax(0,1fr)_auto] items-center gap-5 rounded-card border-(length:--border-w) border-line px-5 py-4 shadow-card",
              i === 0 ? "bg-sticker-3" : "bg-surface-raised",
            )}
          >
            <span
              className={cn(
                "grid size-12 place-items-center justify-self-center rounded-chip border-2 border-line font-display text-2xl font-extrabold tabular-nums",
                RANK_BADGE[r.rank] ?? "bg-surface-tint text-text",
              )}
            >
              {r.rank}
            </span>
            <div className="flex min-w-0 flex-wrap items-baseline gap-2.5">
              <span className="truncate font-display text-3xl font-extrabold">{booth.name}</span>
              {booth.boothNo && (
                <span className="shrink-0 rounded-chip border border-line bg-surface-raised px-2.5 py-0.5 text-sm font-bold text-text">
                  {booth.boothNo}
                </span>
              )}
            </div>
            <div className="grid justify-items-end gap-1.5 text-right tabular-nums">
              <span className="whitespace-nowrap text-xl font-extrabold xl:text-2xl">
                {formatAverage(r.average)} ★ · {copy.results.score(formatScore(r.score))}
              </span>
              <div
                className="h-2 w-36 overflow-hidden rounded-full border border-line bg-surface-raised"
                aria-hidden="true"
              >
                <div
                  style={{ width: `${pct}%`, animationDelay: `${i * 65 + 100}ms` }}
                  className={cn(
                    "screen-bar-grow h-full rounded-full",
                    i === 0 ? "bg-accent" : "bg-primary",
                  )}
                />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
