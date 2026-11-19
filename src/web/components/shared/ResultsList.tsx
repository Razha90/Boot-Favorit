import type { ResultEntry } from "@shared/results";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { cn } from "../../lib/cn";
import { copy } from "../../lib/copy";
import { formatAverage, formatScore } from "../../lib/format";
import { useMediaUrl } from "../../lib/media-url";
import { RatingStars } from "./RatingStars";
import { SafeImage } from "./SafeImage";

// Bingkai khusus HANYA untuk hasil akhir (A8): peringkat saat event berlangsung tidak memakainya, agar tidak ada sorotan
// sebelum diumumkan. Juara 1 paling besar dengan garis hijau tebal; juara 2 dan 3 sedang dengan nada garis berbeda;
// peringkat 4 dan seterusnya baris biasa yang sama.
const TIER = {
  1: {
    box: "border-primary border-[6px] p-4 sm:p-6",
    name: "text-4xl sm:text-5xl",
    photo: "winner" as const,
  },
  2: { box: "border-accent border-[4px] p-3 sm:p-4", name: "text-3xl", photo: "lg" as const },
  3: { box: "border-sticker-4 border-[4px] p-3 sm:p-4", name: "text-3xl", photo: "lg" as const },
};

function Rating({ r, big = false }: { r: ResultEntry; big?: boolean }) {
  if (r.average === null)
    return <span className="text-sm text-muted">{copy.visitor.noRatingsYet}</span>;
  return (
    <span
      className={cn(
        "inline-flex flex-wrap items-center gap-x-2 gap-y-1",
        big ? "text-base" : "text-sm",
      )}
    >
      <b>{formatAverage(r.average)}</b>
      <RatingStars mode="display" value={r.average} size={big ? "md" : "sm"} />
      <span className="text-muted">({copy.results.reviews(r.reviewCount)})</span>
      {r.score !== null && (
        <span className="text-muted">· {copy.results.score(formatScore(r.score))}</span>
      )}
    </span>
  );
}

function Tags({ r }: { r: ResultEntry }) {
  if (r.topCategories.length === 0) return null;
  return (
    <p className="text-xs">
      <span className="font-bold">{copy.results.tags}: </span>
      {r.topCategories.map((c) => `${c.label} ${c.count}`).join(" · ")}
    </p>
  );
}

function useOptionalPhoto(key: string | null) {
  const resolve = useMediaUrl();
  const src = resolve(key);
  const [failed, setFailed] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: foto baru = coba lagi
  useEffect(() => setFailed(false), [src]);
  return { src, show: !!src && !failed, onFail: () => setFailed(true) };
}

function Name({
  r,
  interactive,
  className,
}: {
  r: ResultEntry;
  interactive: boolean;
  className: string;
}) {
  const title = (
    <h3
      className={cn(
        "font-display font-extrabold leading-tight [overflow-wrap:anywhere]",
        className,
      )}
    >
      {r.name}
    </h3>
  );
  return interactive ? (
    <Link to={`/b/${r.boothId}`} className="underline-offset-4 hover:underline">
      {title}
    </Link>
  ) : (
    title
  );
}

function Podium({
  r,
  rank,
  interactive,
}: {
  r: ResultEntry;
  rank: 1 | 2 | 3;
  interactive: boolean;
}) {
  const t = TIER[rank];
  const photo = useOptionalPhoto(r.coverThumbKey);
  return (
    <li
      data-tier={rank}
      className={cn(
        "grid gap-3 rounded-card border-solid bg-surface-raised shadow-card",
        t.box,
        photo.show &&
          (rank === 1
            ? "md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-center"
            : "sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:items-center"),
      )}
    >
      {photo.show && (
        <SafeImage
          src={photo.src}
          aspect="4/3"
          className="w-full rounded-card"
          onFail={photo.onFail}
          fallback={null}
        />
      )}
      <div className="grid content-center gap-2">
        <span className="font-hand text-3xl text-accent-strong">{copy.results.place(rank)}</span>
        <Name r={r} interactive={interactive} className={t.name} />
        {r.boothNo && (
          <span className="w-fit rounded-chip border-(length:--border-w) border-line px-2 text-xs font-bold">
            {copy.visitor.boothNo(r.boothNo)}
          </span>
        )}
        <Rating r={r} big />
        <Tags r={r} />
      </div>
    </li>
  );
}

function PlainRow({
  r,
  interactive,
  muted = false,
}: {
  r: ResultEntry;
  interactive: boolean;
  muted?: boolean;
}) {
  const photo = useOptionalPhoto(r.coverThumbKey);
  return (
    <li
      data-tier="row"
      className={cn(
        "grid items-center gap-3 rounded-card border-(length:--border-w) border-line bg-surface-raised p-2",
        photo.show ? "grid-cols-[2.5rem_5rem_minmax(0,1fr)]" : "grid-cols-[2.5rem_minmax(0,1fr)]",
        muted && "opacity-80",
      )}
    >
      <span className="text-center font-display text-2xl font-extrabold">{r.rank ?? "–"}</span>
      {photo.show && (
        <SafeImage
          src={photo.src}
          aspect="4/3"
          className="w-full rounded-card"
          onFail={photo.onFail}
          fallback={null}
        />
      )}
      <div className="grid gap-0.5">
        <Name r={r} interactive={interactive} className="text-lg" />
        <Rating r={r} />
        <Tags r={r} />
      </div>
    </li>
  );
}

/**
 * Daftar hasil akhir SELURUH booth (A8): peringkat 1–3 berbingkai khusus, 4 dan seterusnya baris sama, lalu yang belum
 * cukup ulasan. Murni tampilan dari `results_json`; tanpa foto → bingkai (A16).
 */
export function ResultsList({
  results,
  interactive = true,
}: {
  results: readonly ResultEntry[];
  interactive?: boolean;
}) {
  if (results.length === 0) return <p className="text-sm text-muted">{copy.results.empty}</p>;
  const ranked = results.filter((r) => r.rank !== null);
  const unranked = results.filter((r) => r.rank === null);
  return (
    <div className="grid gap-4">
      <ol className="grid gap-4">
        {ranked.map((r) =>
          r.rank !== null && r.rank <= 3 ? (
            <Podium key={r.boothId} r={r} rank={r.rank as 1 | 2 | 3} interactive={interactive} />
          ) : (
            <PlainRow key={r.boothId} r={r} interactive={interactive} />
          ),
        )}
      </ol>
      {unranked.length > 0 && (
        <section className="grid gap-2" aria-label={copy.results.unranked}>
          <h4 className="text-sm font-bold text-muted">{copy.results.unranked}</h4>
          <ul className="grid gap-2">
            {unranked.map((r) => (
              <PlainRow key={r.boothId} r={r} interactive={interactive} muted />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
