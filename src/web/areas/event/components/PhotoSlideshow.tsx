import { CONFIG } from "@shared/config";
import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from "react";
import { SafeImage } from "../../../components/shared/SafeImage";
import { cn } from "../../../lib/cn";
import { copy } from "../../../lib/copy";
import { useMediaUrl } from "../../../lib/media-url";

export interface SlidePhoto {
  keyFull: string;
  keyThumb: string;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/**
 * Slideshow foto booth (explore.md B20). Pewaktu = animasi CSS pada segmen progres (`animationend` memicu foto
 * berikutnya), jadi saat animasi dijeda pergantian ikut berhenti. Berhenti sementara saat: kursor di atas,
 * fokus keyboard, sentuhan (lanjut setelah `resumeAfterTouchMs`), tab tersembunyi, atau tombol jeda. Gerak
 * minimal → mulai dijeda. Satu foto: tanpa kontrol dan tanpa pewaktu. Tanpa foto (atau semua gagal dimuat):
 * tidak dirender sama sekali dan `onEmpty` memberi tahu induk agar hero menjadi satu kolom (A16).
 */
export function PhotoSlideshow({
  photos,
  onEmpty,
}: {
  photos: readonly SlidePhoto[];
  onEmpty?: () => void;
}) {
  const resolve = useMediaUrl();
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const list = photos.filter((p) => !failed.has(p.keyFull));
  const [index, setIndex] = useState(0);
  const [userPaused, setUserPaused] = useState(prefersReducedMotion);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [touch, setTouch] = useState(false);
  const [hidden, setHidden] = useState(false);
  const touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startX = useRef<number | null>(null);

  const n = list.length;
  const current = n === 0 ? 0 : Math.min(index, n - 1);
  const go = (to: number) => setIndex(((to % n) + n) % n);

  useEffect(() => {
    if (photos.length > 0 && n === 0) onEmpty?.();
  }, [photos.length, n, onEmpty]);

  useEffect(() => {
    const onVis = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);
  useEffect(
    () => () => {
      if (touchTimer.current) clearTimeout(touchTimer.current);
    },
    [],
  );

  if (n === 0) return null;
  const running = n > 1 && !userPaused && !hover && !focus && !touch && !hidden;

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    startX.current = e.clientX;
    if (e.pointerType === "touch") {
      setTouch(true);
      if (touchTimer.current) clearTimeout(touchTimer.current);
    }
  }
  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    const dx = startX.current === null ? 0 : e.clientX - startX.current;
    startX.current = null;
    if (Math.abs(dx) > 40) go(current + (dx < 0 ? 1 : -1)); // geser kiri = berikutnya
    if (e.pointerType === "touch") {
      touchTimer.current = setTimeout(() => setTouch(false), CONFIG.gallery.resumeAfterTouchMs);
    }
  }
  function onKey(e: KeyboardEvent<HTMLElement>) {
    if (e.key === "ArrowRight") go(current + 1);
    else if (e.key === "ArrowLeft") go(current - 1);
    else return;
    e.preventDefault();
  }

  // Panah keyboard bekerja saat salah satu kontrol di dalam (tombol sebelumnya/berikutnya, jeda, thumbnail)
  // difokuskan: kejadian keyboard dan fokus naik (bubble) ke wilayah ini.
  return (
    <section
      aria-roledescription="carousel"
      aria-label={copy.event.booth.slideshow.label}
      onKeyDown={onKey}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      data-photo-count={n}
      className="grid gap-3"
    >
      <div className="relative rounded-card border-(length:--border-w) border-line bg-surface-raised p-2 pb-3 shadow-card -rotate-1 in-data-[vibe=pro]:rotate-0">
        <span
          aria-hidden="true"
          className="absolute -top-2 left-1/2 z-10 h-4 w-20 -translate-x-1/2 rotate-1 bg-sticker-3/90 in-data-[vibe=pro]:hidden"
        />
        <div
          className="relative overflow-hidden rounded"
          style={{ aspectRatio: "4/3" }}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
        >
          {list.map((p, i) => (
            <div
              key={p.keyFull}
              aria-hidden={i !== current}
              className={cn(
                "absolute inset-0 transition-opacity duration-500",
                i === current ? "opacity-100" : "pointer-events-none opacity-0",
              )}
            >
              <SafeImage
                src={resolve(p.keyFull)}
                alt={i === current ? copy.event.booth.slideshow.counter(i + 1, n) : ""}
                className="size-full"
                onFail={() => setFailed((s) => new Set(s).add(p.keyFull))}
                fallback={null}
              />
            </div>
          ))}
          {n > 1 && (
            <>
              <button
                type="button"
                aria-label={copy.event.booth.slideshow.prev}
                onClick={() => go(current - 1)}
                className="absolute left-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full border-(length:--border-w) border-line bg-surface-raised font-bold"
              >
                ←
              </button>
              <button
                type="button"
                aria-label={copy.event.booth.slideshow.next}
                onClick={() => go(current + 1)}
                className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full border-(length:--border-w) border-line bg-surface-raised font-bold"
              >
                →
              </button>
              <span className="absolute bottom-2 right-2 rounded-chip bg-text/70 px-2 py-0.5 text-xs font-bold text-surface">
                {current + 1}/{n}
              </span>
            </>
          )}
        </div>

        {n > 1 && (
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              aria-label={
                userPaused ? copy.event.booth.slideshow.play : copy.event.booth.slideshow.pause
              }
              aria-pressed={userPaused}
              onClick={() => setUserPaused((p) => !p)}
              className="grid size-7 shrink-0 place-items-center rounded-full border-(length:--border-w) border-line text-xs font-bold"
            >
              {userPaused ? "▶" : "❚❚"}
            </button>
            <ol aria-hidden="true" className="flex flex-1 gap-1">
              {list.map((p, i) => (
                <li
                  key={p.keyFull}
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-star-off"
                >
                  {i < current && <span className="block size-full bg-primary-strong" />}
                  {i === current && (
                    <span
                      key={`fill-${current}`}
                      data-progress=""
                      className="block size-full origin-left bg-primary-strong"
                      style={{
                        animation: `slide-fill ${CONFIG.gallery.intervalMs}ms linear forwards`,
                        animationPlayState: running ? "running" : "paused",
                      }}
                      onAnimationEnd={() => running && go(current + 1)}
                    />
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {n > 1 && (
        <ul className="flex gap-2 overflow-x-auto px-1">
          {list.map((p, i) => (
            <li key={p.keyFull} className="shrink-0">
              <button
                type="button"
                aria-label={copy.event.booth.slideshow.goTo(i + 1)}
                aria-current={i === current}
                onClick={() => go(i)}
                className={cn(
                  "block w-16 overflow-hidden rounded border-(length:--border-w) border-line",
                  i === current ? "opacity-100" : "opacity-60",
                )}
              >
                <SafeImage
                  src={resolve(p.keyThumb)}
                  aspect="4/3"
                  className="w-full"
                  fallback={null}
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
