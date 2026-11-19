import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "../../lib/cn";
import { Skeleton } from "../ui/states";

const CARD_KEYS = ["a", "b", "c"] as const;

/**
 * Pembungkus transisi mulus antara skeleton dan konten nyata:
 * - Menunda kemunculan skeleton ±110 ms agar koneksi cepat tidak berkedip kilat.
 * - Saat data siap, konten masuk halus (`.content-enter`) sementara lapisan skeleton
 *   memudar perlahan di atasnya (`opacity: 1 → 0`) sebelum dilepas dari DOM.
 */
export function SkeletonCrossfade({
  loading,
  skeleton,
  delayMs = 110,
  children,
}: {
  loading: boolean;
  skeleton: ReactNode;
  delayMs?: number;
  children: ReactNode;
}) {
  const [visible, setVisible] = useState(() => loading && delayMs <= 0);
  const [mounted, setMounted] = useState(loading);
  const wasVisibleRef = useRef(loading && delayMs <= 0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (loading) {
      setMounted(true);
      if (delayMs <= 0) {
        wasVisibleRef.current = true;
        setVisible(true);
      } else {
        timerRef.current = window.setTimeout(() => {
          wasVisibleRef.current = true;
          setVisible(true);
        }, delayMs);
      }
      return () => {
        if (timerRef.current !== null) {
          window.clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      };
    }
    // Data selesai dimuat: bila skeleton sempat tampil, pudarkan perlahan sebelum dilepas.
    if (!wasVisibleRef.current) {
      setMounted(false);
      return;
    }
    wasVisibleRef.current = false;
    setVisible(false);
    timerRef.current = window.setTimeout(() => setMounted(false), 300);
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [loading, delayMs]);

  return (
    <div className="grid">
      {!loading && <div className="content-enter col-start-1 row-start-1 min-w-0">{children}</div>}
      {mounted && (
        <div
          aria-hidden={!loading || undefined}
          onTransitionEnd={() => {
            if (!loading && !visible) setMounted(false);
          }}
          className={cn(
            "col-start-1 row-start-1 min-w-0 transition-opacity duration-250 ease-out",
            visible ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          {skeleton}
        </div>
      )}
    </div>
  );
}

function SectionHeadingSkeleton({ width }: { width: string }) {
  return (
    <div className="flex items-center gap-3">
      <Skeleton className="size-9 shrink-0 rounded-full" />
      <Skeleton className={`h-8 rounded-chip ${width}`} />
    </div>
  );
}

/** Kerangka pemuatan untuk Booth Sorotan + Semua booth (berbagi tata letak antara muat awal dan snapshot). */
export function SnapshotBoothsSkeleton() {
  return (
    <div className="grid gap-10" aria-busy="true">
      <div className="grid gap-4">
        <SectionHeadingSkeleton width="w-48" />
        <div className="grid gap-6 rounded-card border-(length:--border-w) border-line/20 bg-surface-raised p-6 lg:grid-cols-[minmax(0,1.25fr)_14rem] lg:items-center">
          <div className="grid gap-4">
            <Skeleton className="h-6 w-16 rounded-chip" />
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-10 w-48 rounded-chip" />
          </div>
          <Skeleton className="hidden aspect-4/3 w-full lg:block" />
        </div>
      </div>

      <div className="grid gap-4">
        <SectionHeadingSkeleton width="w-44" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CARD_KEYS.map((key) => (
            <div
              key={key}
              className="relative grid gap-3 rounded-card border-(length:--border-w) border-line/20 bg-surface-raised p-4 pt-5"
            >
              <span
                aria-hidden="true"
                className="absolute -top-2 left-1/2 h-3.5 w-14 -translate-x-1/2 bg-sticker-3/60 in-data-[vibe=pro]:hidden"
              />
              <div className="flex items-center justify-between gap-3">
                <div className="grid flex-1 gap-2">
                  <Skeleton className="h-5 w-12 rounded-chip" />
                  <Skeleton className="h-6 w-4/5" />
                </div>
                <Skeleton className="size-12 shrink-0" />
              </div>
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Kerangka muat awal halaman utama: Hero + Polaroid + Sidebar + Sorotan & Booth. */
export function HomeInitialSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 pb-8 pt-8 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:items-center">
        <div className="grid gap-4">
          <Skeleton className="h-7 w-44 rounded-chip" />
          <div className="grid gap-2">
            <Skeleton className="h-11 w-11/12" />
            <Skeleton className="h-11 w-3/4" />
          </div>
          <Skeleton className="h-5 w-4/5" />
          <div className="flex flex-wrap gap-3 pt-2">
            <Skeleton className="h-11 w-48 rounded-chip" />
            <Skeleton className="h-11 w-36 rounded-chip" />
          </div>
        </div>
        <div className="hidden grid-cols-2 gap-4 sm:grid lg:grid-cols-3">
          <div className="-rotate-2 rounded-card border-(length:--border-w) border-line/20 bg-surface-raised p-2 pb-6 in-data-[vibe=pro]:rotate-0">
            <Skeleton className="aspect-3/4 w-full rounded" />
          </div>
          <div className="rotate-2 rounded-card border-(length:--border-w) border-line/20 bg-surface-raised p-2 pb-6 in-data-[vibe=pro]:rotate-0">
            <Skeleton className="aspect-3/4 w-full rounded" />
          </div>
          <div className="hidden -rotate-1 rounded-card border-(length:--border-w) border-line/20 bg-surface-raised p-2 pb-6 lg:block in-data-[vibe=pro]:rotate-0">
            <Skeleton className="aspect-3/4 w-full rounded" />
          </div>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-4 xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-start">
        <SnapshotBoothsSkeleton />
        <aside className="hidden gap-4 xl:grid">
          <div className="flex gap-2">
            <Skeleton className="h-7 w-14 rounded-chip" />
            <Skeleton className="h-7 w-44 rounded-chip" />
          </div>
          <div className="grid gap-3 rounded-card border-(length:--border-w) border-line/20 bg-surface-raised p-4">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-20 rounded-chip" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-2.5 w-full rounded-full" />
            <Skeleton className="h-9 w-full rounded-chip" />
          </div>
        </aside>
      </div>
    </div>
  );
}
