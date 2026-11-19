import type { EventState } from "@shared/event-state";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "../../../components/ui/Icon";
import { copy } from "../../../lib/copy";
import { countdownText } from "../../../lib/hero-copy";

export interface StatsBandProps {
  stats: { reviewCount: number; boothCount: number; average: number | null };
  /** Rating disembunyikan admin: angka ulasan dan rata-rata tidak ditampilkan (A3) */
  ratingsHidden: boolean;
  state: Pick<EventState, "phase" | "frozen">;
  eventStartAt: number;
  eventEndAt: number;
  serverNow: () => number;
  /** Koneksi live aktif: tanda LIVE di kotak waktu */
  liveConnected: boolean;
}

const avgText = (n: number) => n.toFixed(2).replace(".", ",");

/**
 * Pita statistik langsung di antara hero dan daftar booth: angka besar yang hidup (booth, ulasan, rata-rata, hitung
 * mundur voting). Hanya ringkasan; tidak memuat peringkat atau skor booth mana pun (keadilan A8). Angka yang berubah
 * (ulasan baru) memainkan animasi kecil.
 */
export function StatsBand({
  stats,
  ratingsHidden,
  state,
  eventStartAt,
  eventEndAt,
  serverNow,
  liveConnected,
}: StatsBandProps) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (state.frozen) return;
    const id = setInterval(() => setTick((n) => n + 1), 30_000); // hitung mundur
    return () => clearInterval(id);
  }, [state.frozen]);

  const B = copy.event.statsBand;
  const now = serverNow();
  const time =
    state.phase === "upcoming"
      ? { value: countdownText(eventStartAt, now), label: B.opensIn }
      : state.phase === "live"
        ? { value: countdownText(eventEndAt, now), label: B.closesIn }
        : { value: B.endedValue, label: B.ended };

  const tiles: { key: string; icon: IconName; tone: string; value: string; label: string }[] = [
    {
      key: "booths",
      icon: "store",
      tone: "bg-sticker-4",
      value: String(stats.boothCount),
      label: B.booths,
    },
  ];
  if (!ratingsHidden) {
    tiles.push({
      key: "reviews",
      icon: "sparkles",
      tone: "bg-sticker-3",
      value: String(stats.reviewCount),
      label: B.reviews,
    });
    if (stats.average !== null) {
      tiles.push({
        key: "average",
        icon: "star",
        tone: "bg-accent",
        value: avgText(stats.average),
        label: B.average,
      });
    }
  }
  tiles.push({ key: "time", icon: "activity", tone: "bg-sticker-2", ...time });

  return (
    <section
      aria-label={B.label}
      data-stats-band=""
      className="border-y-(length:--border-w) border-line bg-text text-surface"
    >
      <ul className="mx-auto grid max-w-7xl grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(0,1fr))]">
        {tiles.map((t) => (
          <li
            key={t.key}
            className="flex items-center gap-3 border-b border-surface/15 px-4 py-4 sm:px-6 sm:py-5 lg:border-r lg:border-b-0 lg:last:border-r-0"
          >
            <span
              aria-hidden="true"
              className={`grid size-11 shrink-0 place-items-center rounded-full border-2 border-surface/80 text-primary-fg ${t.tone}`}
            >
              <Icon name={t.icon} className="size-5" />
            </span>
            <span className="grid min-w-0 leading-tight">
              <b
                key={t.value}
                data-stat={t.key}
                className={`animate-feed-in font-display font-extrabold tabular-nums ${
                  t.key === "time" ? "text-xl sm:text-2xl" : "text-3xl sm:text-4xl"
                }`}
              >
                {t.value}
              </b>
              <span className="flex flex-wrap items-center gap-1.5 text-[0.7rem] font-bold tracking-widest uppercase opacity-80">
                {t.key === "time" && liveConnected && state.phase === "live" && (
                  <span className="inline-flex items-center gap-1 rounded-chip bg-primary px-1.5 py-0.5 text-primary-fg">
                    <span className="size-1.5 animate-pulse rounded-full bg-primary-fg" />
                    {B.live}
                  </span>
                )}
                {t.label}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
