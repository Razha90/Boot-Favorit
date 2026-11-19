import type { PublicBooth, VisitorMe } from "@shared/api-types";
import type { EventState } from "@shared/event-state";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "../../../components/ui/Button";
import { Icon } from "../../../components/ui/Icon";
import { burstStars } from "../../../features/fx/ClickFx";
import { copy } from "../../../lib/copy";
import { countdownText } from "../../../lib/hero-copy";
import { triggerSfx } from "../../../lib/sfx-bridge";

/**
 * Kolom samping beranda di kanan Booth Sorotan (`>= 1280px`) dan ringkas di atas daftar pada layar kecil.
 * Menampilkan progres penilaian pengunjung, hitung mundur waktu voting, dan pemilih booth acak yang adil
 * (memprioritaskan booth yang belum dinilai). Tidak memuat peringkat atau skor booth mana pun (A8).
 */
export function HomeSidebar({
  booths,
  state,
  eventStartAt,
  eventEndAt,
  serverNow,
  visitor,
  reviewedBoothIds,
  children,
}: {
  booths: readonly PublicBooth[];
  state: Pick<EventState, "phase" | "frozen" | "resultsPublished">;
  eventStartAt: number;
  eventEndAt: number;
  serverNow: () => number;
  visitor: VisitorMe["visitor"] | null | undefined;
  reviewedBoothIds: readonly string[];
  children?: ReactNode;
}) {
  const navigate = useNavigate();
  const [, setTick] = useState(0);
  useEffect(() => {
    if (state.frozen) return;
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [state.frozen]);

  const S = copy.event.sidebar;
  const boothIdSet = useMemo(() => new Set(booths.map((b) => b.id)), [booths]);
  const reviewedSet = useMemo(
    () => new Set(reviewedBoothIds.filter((id) => boothIdSet.has(id))),
    [reviewedBoothIds, boothIdSet],
  );
  const doneCount = reviewedSet.size;
  const totalCount = booths.length;
  const unreviewed = useMemo(
    () => booths.filter((b) => !reviewedSet.has(b.id)),
    [booths, reviewedSet],
  );
  const pct = totalCount > 0 ? Math.min(100, Math.round((doneCount / totalCount) * 100)) : 0;

  const now = serverNow();
  const timeBadge =
    state.phase === "upcoming"
      ? S.startsIn(countdownText(eventStartAt, now))
      : state.phase === "live"
        ? S.closesIn(countdownText(eventEndAt, now))
        : S.endedBadge;

  function pickRandomBooth(anchor: HTMLElement) {
    const pool = unreviewed.length > 0 ? unreviewed : booths;
    if (pool.length === 0) return;
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    if (!chosen) return;
    triggerSfx("pop");
    burstStars(anchor);
    void navigate(`/b/${chosen.id}`);
  }

  return (
    <aside data-home-sidebar="" className="grid content-start gap-4 xl:col-start-2 xl:row-start-1">
      {children}
      {totalCount > 0 && (
        <div className="grid gap-3 rounded-card border-(length:--border-w) border-line bg-surface-raised p-4 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-base font-extrabold text-text">
              {state.phase === "upcoming" ? S.upcoming : S.title}
            </h2>
            <span
              className={
                state.phase === "live"
                  ? "rounded-chip border border-line bg-sticker-3 px-2.5 py-0.5 text-xs font-extrabold text-primary-fg"
                  : "rounded-chip border border-line bg-surface-tint px-2.5 py-0.5 text-xs font-bold text-muted"
              }
            >
              {timeBadge}
            </span>
          </div>

          {visitor && (
            <p className="text-xs font-extrabold text-primary-strong">
              {S.greeting(visitor.displayName?.trim() || S.guestName)}
            </p>
          )}

          <div className="grid gap-1.5">
            <p className="text-sm font-bold text-text">
              {doneCount === 0
                ? S.noneYet
                : doneCount >= totalCount
                  ? S.allDone(totalCount)
                  : S.progress(doneCount, totalCount)}
            </p>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={totalCount}
              aria-valuenow={doneCount}
              aria-label={S.title}
              className="h-2.5 overflow-hidden rounded-full border-2 border-line bg-surface-tint"
            >
              <div
                style={{ width: `${pct}%` }}
                className="h-full rounded-full bg-primary transition-[width] duration-300"
              />
            </div>
          </div>

          {!state.frozen ? (
            <Button
              size="sm"
              variant="primary"
              icon="sparkles"
              onClick={(e) => pickRandomBooth(e.currentTarget)}
              className="w-full justify-center"
            >
              {doneCount > 0 && unreviewed.length > 0 ? S.pickNext : S.pickRandom}
            </Button>
          ) : (
            state.resultsPublished && (
              <Link
                to="/results"
                className="inline-flex w-full items-center justify-center gap-2 rounded-chip border-(length:--border-w) border-line bg-primary-soft px-3.5 py-2 text-sm font-extrabold text-primary-strong transition-transform hover:-translate-y-0.5"
              >
                <Icon name="trophy" className="size-4" />
                <span>{S.seeResults}</span>
              </Link>
            )
          )}
        </div>
      )}
    </aside>
  );
}
