import type { PublicEvent } from "@shared/api-types";
import type { EventState } from "@shared/event-state";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Present } from "../../../components/shared/Present";
import { SafeImage } from "../../../components/shared/SafeImage";
import { Icon } from "../../../components/ui/Icon";
import { pointerTiltProps } from "../../../features/fx/ClickFx";
import { cn } from "../../../lib/cn";
import { copy } from "../../../lib/copy";
import { countdownText, heroCopy, splitHighlight } from "../../../lib/hero-copy";
import { useMediaUrl } from "../../../lib/media-url";
import { HeroArt } from "./HeroArt";
import { ShareButton } from "./share-wishlist";

const TILTS = ["-rotate-3", "rotate-2", "-rotate-1"] as const;

/**
 * Kolase polaroid 0–3 foto suasana acara (netral, bukan booth tertentu). Jumlah bingkai mengikuti jumlah foto;
 * foto yang gagal dimuat dibuang; tak ada satu pun → tidak dirender dan hero menjadi satu kolom (A16).
 */
export function PolaroidCollage({
  heroKeys,
  onEmpty,
}: {
  heroKeys: readonly string[];
  onEmpty?: () => void;
}) {
  const resolve = useMediaUrl();
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const keys = heroKeys.filter((k) => !failed.has(k)).slice(0, 3);

  useEffect(() => {
    if (heroKeys.length > 0 && keys.length === 0) onEmpty?.();
  }, [heroKeys.length, keys.length, onEmpty]);

  if (keys.length === 0) return null;
  return (
    <div
      data-collage={keys.length}
      className="flex snap-x gap-4 overflow-x-auto px-1 pb-4 pt-3 lg:grid lg:grid-cols-3 lg:overflow-visible"
    >
      {keys.map((k, i) => (
        <figure
          key={k}
          {...pointerTiltProps()}
          className={cn(
            "seru-tilt relative w-[74%] shrink-0 snap-center rounded-card border-(length:--border-w) border-line bg-surface-raised p-2 pb-8 shadow-card lg:w-auto in-data-[vibe=pro]:rotate-0",
            TILTS[i % TILTS.length],
            keys.length === 1 && "lg:col-start-2",
          )}
        >
          <span
            aria-hidden="true"
            className="absolute -top-2 left-1/2 h-4 w-16 -translate-x-1/2 -rotate-2 bg-sticker-3/90 in-data-[vibe=pro]:hidden"
          />
          <SafeImage
            src={resolve(k)}
            aspect="3/4"
            className="w-full rounded"
            onFail={() => setFailed((s) => new Set(s).add(k))}
            fallback={null}
          />
        </figure>
      ))}
    </div>
  );
}

function StatusPill({ live, children }: { live: boolean; children: React.ReactNode }) {
  return (
    <span className="inline-flex w-fit items-center gap-2 rounded-chip border-(length:--border-w) border-line bg-surface-raised px-3 py-1 text-xs font-extrabold tracking-widest">
      <span
        aria-hidden="true"
        className={cn("size-2.5 rounded-full", live ? "animate-pulse bg-primary" : "bg-muted")}
      />
      {children}
    </span>
  );
}

function useTicker(ms: number) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

export interface HeroProps {
  event: PublicEvent;
  state: EventState;
  boothCount: number;
  serverNow: () => number;
  /** Tombol "Daftar Toko" tampil selama pendaftaran reguler (B17) */
  registrationVisible: boolean;
}

/**
 * Hero halaman utama. Judul = nama resmi acara (kata sorotan pada blok hijau). Teks, lencana, dan CTA selalu
 * selaras dengan status event (dihitung dari `getEventState`). Tanpa foto suasana: satu kolom berisi teks.
 */
export function Hero({ event, state, boothCount, serverNow, registrationVisible }: HeroProps) {
  const c = heroCopy(state);
  const [collageEmpty, setCollageEmpty] = useState(false);
  const hasCollage = event.media.heroKeys.length > 0 && !collageEmpty;
  const parts = splitHighlight(event.name, event.titleHighlight);
  useTicker(30_000); // hitung mundur diperbarui tiap 30 detik

  const registerLine = registrationVisible
    ? copy.event.hero.registerCloses(countdownText(event.schedule.registrationCloseAt, serverNow()))
    : null;

  return (
    <header
      id="top"
      data-hero-layout={hasCollage ? "collage" : "text"}
      className={cn(
        "relative mx-auto grid max-w-7xl gap-8 overflow-x-clip px-4 pb-10 pt-8",
        "lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:items-center",
      )}
    >
      <div className="grid content-center gap-5">
        <span className="flex flex-wrap items-center gap-3">
          <StatusPill live={c.live}>{c.badge}</StatusPill>
          {state.phase === "upcoming" && (
            <span className="text-sm font-bold">
              {copy.event.hero.votingOpensIn(
                countdownText(event.schedule.eventStartAt, serverNow()),
              )}
            </span>
          )}
        </span>

        <h1 className="font-display text-5xl font-extrabold leading-[1.25] tracking-tight [overflow-wrap:anywhere] sm:text-6xl xl:text-7xl">
          {parts.map((p) =>
            p.hl ? (
              <mark
                key={p.text}
                className="box-decoration-clone rounded-card bg-primary px-2 text-primary-fg"
              >
                {p.text}
              </mark>
            ) : (
              <span key={p.text}>{p.text}</span>
            ),
          )}
        </h1>

        <p className="font-hand text-3xl">{copy.event.hero.greeting}</p>
        <p className="max-w-prose">{c.sub}</p>

        <ul className="flex flex-wrap items-center gap-2 text-sm font-bold">
          <Present when={boothCount > 0}>
            <li className="rounded-chip border-(length:--border-w) border-line bg-sticker-4 px-3 py-1 text-primary-fg">
              {copy.event.hero.boothsJoined(boothCount)}
            </li>
          </Present>
          {copy.event.hero.steps.map((s, i) => (
            <li key={s} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="grid size-6 place-items-center rounded-full bg-text text-xs text-surface"
              >
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-4">
          <a
            href="#booth"
            className="group inline-flex items-center gap-3 rounded-chip border-(length:--border-w) border-line bg-text px-6 py-3 font-bold text-surface shadow-[6px_6px_0_var(--accent)] transition-all duration-(--motion-fast) hover:-translate-y-0.5 hover:shadow-[8px_8px_0_var(--accent)] active:translate-x-1 active:translate-y-1 active:shadow-[2px_2px_0_var(--accent)]"
          >
            {c.cta}
            <span
              aria-hidden="true"
              className="grid size-7 place-items-center rounded-full bg-accent text-accent-fg transition-transform group-hover:translate-x-0.5"
            >
              <Icon name="arrow-right" className="size-4" />
            </span>
          </a>
          <ShareButton size="md" />
          {registrationVisible && (
            <span className="grid gap-0.5">
              <Link to="/register" className="text-sm font-bold underline underline-offset-4">
                {copy.event.hero.register}
              </Link>
              <span className="text-xs text-muted">{registerLine}</span>
            </span>
          )}
        </div>
      </div>

      {hasCollage ? (
        <PolaroidCollage heroKeys={event.media.heroKeys} onEmpty={() => setCollageEmpty(true)} />
      ) : (
        // Tanpa foto suasana: kolase ilustrasi kartun makanan agar hero tidak kosong di sisi kanan.
        <HeroArt seed={event.id} />
      )}
    </header>
  );
}
