import type { PublicBooth } from "@shared/api-types";
import { hash32 } from "@shared/fair-order";
import type { Completeness } from "@shared/visual";
import { hasText } from "@shared/visual";
import { type ReactNode, useEffect, useState } from "react";
import { Link } from "react-router";
import { pointerTiltProps } from "../../features/fx/ClickFx";
import { cn } from "../../lib/cn";
import { copy } from "../../lib/copy";
import { useMediaUrl } from "../../lib/media-url";
import { Icon } from "../ui/Icon";
import { Present } from "./Present";
import { PriceTag } from "./PriceTag";
import { ProfileCompleteness } from "./ProfileCompleteness";
import { RatingSummary } from "./RatingSummary";
import { SafeImage } from "./SafeImage";

export type BoothCardVariant = "card" | "spotlight" | "row" | "compact" | "admin";
export type VisualMode = "photo" | "text";

export interface BoothCardProps {
  booth: PublicBooth;
  variant?: BoothCardVariant;
  /**
   * Satu keputusan untuk SELURUH daftar (`gridVisualMode`), bukan per kartu (A16):
   * "photo" = item tanpa foto memakai bingkai (ukuran seragam); "text" = tak satu pun berfoto.
   */
  visualMode?: VisualMode;
  /** Rating disembunyikan admin (A3): tidak tampil, datanya pun tidak dikirim server */
  ratingsHidden?: boolean;
  /** Peringkat (varian row) */
  rank?: number;
  /** Tautan; bawaan `/b/:id` */
  href?: string;
  /** Admin: kelengkapan profil dan slot aksi */
  completeness?: Completeness;
  actions?: ReactNode;
  className?: string;
}

const BLOCKS = [
  "bg-sticker-1",
  "bg-sticker-2",
  "bg-sticker-3",
  "bg-sticker-4",
  "bg-sticker-5",
] as const;

/** Stiker nomor booth. Tidak dirender bila nomor kosong (A16). */
function NoSticker({ no, className }: { no: string | null; className?: string }) {
  return (
    <Present when={no}>
      <span
        className={cn(
          "inline-flex rounded-chip border-(length:--border-w) border-line bg-surface-raised px-2 py-0.5 text-xs font-bold",
          className,
        )}
      >
        {no}
      </span>
    </Present>
  );
}

/** Stiker harga: "mulai Rp 14rb" atau "Gratis" bila semua produk gratis; tidak ada = tidak dirender. */
function PriceSticker({ booth }: { booth: PublicBooth }) {
  if (booth.priceFrom !== null) return <PriceTag priceIdr={booth.priceFrom} size="short" />;
  if (booth.allFree) return <PriceTag priceIdr={0} size="short" />;
  return null;
}

export function BoothCard({
  booth,
  variant = "card",
  visualMode = "photo",
  ratingsHidden = false,
  rank,
  href,
  completeness,
  actions,
  className,
}: BoothCardProps) {
  const resolve = useMediaUrl();
  const to = href ?? `/b/${booth.id}`;
  const thumbSrc = resolve(booth.coverThumbKey);
  const [thumbFailed, setThumbFailed] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: foto baru = coba lagi
  useEffect(() => setThumbFailed(false), [thumbSrc]);
  const hasThumb = !!thumbSrc && !thumbFailed;

  const rating = (
    <RatingSummary
      average={booth.ratingAverage}
      count={booth.ratingCount}
      hidden={ratingsHidden}
      size="sm"
    />
  );

  // ---------- compact: satu baris ----------
  if (variant === "compact") {
    return (
      <Link to={to} className={cn("flex flex-wrap items-center gap-2 text-sm", className)}>
        <span className="font-bold">{booth.name}</span>
        <NoSticker no={booth.boothNo} />
        {rating}
      </Link>
    );
  }

  // ---------- row: baris peringkat/hasil; tanpa gambar → cukup nama dan rating secara bersih ----------
  if (variant === "row") {
    return (
      <Link
        to={to}
        className={cn(
          "flex items-center gap-3 rounded-card border-(length:--border-w) border-line bg-surface-raised p-2",
          className,
        )}
      >
        <Present when={rank}>
          <span className="w-8 text-center font-display text-xl font-extrabold">{rank}</span>
        </Present>
        {hasThumb && (
          <SafeImage
            src={thumbSrc}
            aspect="1/1"
            className="size-10 shrink-0 rounded-card"
            onFail={() => setThumbFailed(true)}
            fallback={null}
          />
        )}
        <span className="grid min-w-0 gap-0.5">
          <span className="truncate font-bold">{booth.name}</span>
          {rating}
        </span>
      </Link>
    );
  }

  // ---------- admin: foto bila ada; tanpa foto → nama + kelengkapan + label Tanpa foto ----------
  if (variant === "admin") {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-3 rounded-card border-(length:--border-w) border-line bg-surface-raised p-3",
          className,
        )}
      >
        {hasThumb && (
          <SafeImage
            src={thumbSrc}
            aspect="1/1"
            className="size-12 shrink-0 rounded-card"
            onFail={() => setThumbFailed(true)}
            fallback={null}
          />
        )}
        <div className="grid min-w-0 flex-1 gap-1">
          <span className="truncate font-bold">{booth.name}</span>
          <span className="flex flex-wrap items-center gap-2">
            <NoSticker no={booth.boothNo} />
            {completeness && <ProfileCompleteness level={completeness} />}
            {!hasText(booth.coverThumbKey) && (
              <span className="text-xs text-muted">{copy.visitor.noPhoto}</span>
            )}
          </span>
        </div>
        {actions}
      </div>
    );
  }

  // ---------- spotlight: dua kolom bila ada foto; hanya-teks bila tidak ----------
  if (variant === "spotlight") {
    return <Spotlight booth={booth} to={to} rating={rating} className={className} />;
  }

  // ---------- card: kartu grid. Tanpa gambar → bersih hanya nama (tanpa kotak inisial BD) ----------
  const photoMode = visualMode === "photo" && hasThumb;
  return (
    <Link
      to={to}
      {...pointerTiltProps()}
      className={cn(
        "seru-tilt group relative grid content-start gap-2 rounded-card border-(length:--border-w) border-line bg-surface-raised p-3 shadow-card",
        !photoMode && "min-h-32 content-between",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-2.5 left-1/2 z-10 h-4 w-16 -translate-x-1/2 -rotate-2 bg-sticker-3/90 in-data-[vibe=pro]:hidden"
      />
      {photoMode && (
        <div data-card-visual="" className="relative" style={{ aspectRatio: "4/3" }}>
          <SafeImage
            src={thumbSrc}
            aspect="4/3"
            className="w-full rounded-card"
            onFail={() => setThumbFailed(true)}
            fallback={null}
          />
          <span className="absolute right-2 top-2">
            <PriceSticker booth={booth} />
          </span>
        </div>
      )}
      <div className="grid gap-1">
        <span className="flex min-h-7 flex-wrap items-center gap-2">
          <NoSticker no={booth.boothNo} />
          {!photoMode && <PriceSticker booth={booth} />}
        </span>
        <h3
          title={booth.name}
          className="line-clamp-2 min-h-[2lh] font-display text-lg font-extrabold leading-tight [overflow-wrap:anywhere]"
        >
          {booth.name}
        </h3>
        <span className="flex min-h-5 items-center">{rating}</span>
      </div>
    </Link>
  );
}

function Spotlight({
  booth,
  to,
  rating,
  className,
}: {
  booth: PublicBooth;
  to: string;
  rating: ReactNode;
  className?: string;
}) {
  const resolve = useMediaUrl();
  const src = resolve(booth.coverKey);
  const [failed, setFailed] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: foto baru = coba lagi
  useEffect(() => setFailed(false), [src]);
  // Tanpa foto ATAU foto gagal dimuat → tata letak hanya-teks (nama sebagai tipografi besar).
  const hasPhoto = !!src && !failed;
  const block = BLOCKS[hash32(booth.id) % BLOCKS.length];

  return (
    <article
      data-layout={hasPhoto ? "photo" : "text"}
      className={cn(
        "grid min-h-72 gap-4 rounded-card border-(length:--border-w) border-line bg-surface-raised p-4 shadow-card",
        hasPhoto && "md:grid-cols-2",
        className,
      )}
    >
      {hasPhoto && (
        <SafeImage
          src={src}
          aspect="4/3"
          className="w-full rounded-card"
          onFail={() => setFailed(true)}
          fallback={null}
        />
      )}
      <div
        className={cn(
          "grid content-center gap-3",
          // Di atas warna stiker teks "muted" tidak terbaca (AA): dalam blok ini muted = warna teks gelap.
          !hasPhoto &&
            cn(
              "rounded-card border-(length:--border-w) border-line p-6 text-primary-fg [--muted:var(--primary-fg)]",
              block,
            ),
        )}
      >
        <NoSticker no={booth.boothNo} className="w-fit" />
        <h2
          className={cn(
            "font-display font-extrabold leading-none [overflow-wrap:anywhere]",
            hasPhoto ? "text-4xl" : "text-5xl md:text-6xl",
          )}
        >
          {booth.name}
        </h2>
        {rating}
        <Present when={booth.description}>
          <p className="max-w-prose text-sm">{booth.description}</p>
        </Present>
        <Present when={booth.featuredProduct}>
          <FeaturedMini booth={booth} />
        </Present>
        <Link
          to={to}
          className="group inline-flex w-fit items-center gap-2 rounded-chip border-(length:--border-w) border-line bg-text px-5 py-2 text-sm font-bold text-surface shadow-card transition-transform hover:-translate-y-0.5 active:translate-y-px"
        >
          {copy.visitor.seeAndRate}
          <Icon name="arrow-right" className="size-4" />
        </Link>
      </div>
    </article>
  );
}

/** Kartu mini produk andalan di sorotan. Tanpa foto → hanya nama dan harga (thumbnail hilang). */
function FeaturedMini({ booth }: { booth: PublicBooth }) {
  const resolve = useMediaUrl();
  const p = booth.featuredProduct;
  if (!p) return null;
  return (
    <div className="flex items-center gap-3 rounded-card bg-surface-raised/70 p-2 text-text">
      <SafeImage
        src={resolve(p.thumbKey)}
        aspect="1/1"
        className="size-12 rounded-card"
        fallback={null}
      />
      <span className="grid gap-0.5">
        <span className="text-sm font-bold [overflow-wrap:anywhere]">{p.name}</span>
        <PriceTag priceIdr={p.priceIdr} />
      </span>
    </div>
  );
}
