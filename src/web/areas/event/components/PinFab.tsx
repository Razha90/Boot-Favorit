import type { PublicBooth } from "@shared/api-types";
import { CONFIG } from "@shared/config";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { RatingSummary } from "../../../components/shared/RatingSummary";
import { Button } from "../../../components/ui/Button";
import { Icon } from "../../../components/ui/Icon";
import { Modal } from "../../../components/ui/Modal";
import { copy } from "../../../lib/copy";
import { useEventState } from "../../../lib/event-state";
import { usePins } from "../../../lib/pins";
import { compareBoothNo } from "../../../lib/wishlist";

/**
 * Tombol "Sematan" di kanan atas + daftar booth yang disematkan pengunjung (B28). Daftar diurutkan menurut nomor
 * booth (rute keliling), bukan menurut rating, dan dicocokkan dengan snapshot terbaru: booth yang tidak tayang lagi
 * dibuang. Tidak dirender setelah event selesai.
 */
export function PinFab({
  booths,
  ratingsHidden,
}: {
  booths: readonly PublicBooth[];
  ratingsHidden: boolean;
}) {
  const pins = usePins();
  const state = useEventState();
  const [open, setOpen] = useState(false);
  const P = copy.event.pins;

  const known = useMemo(() => new Map(booths.map((b) => [b.id, b])), [booths]);
  // Snapshot sudah dimuat: buang sematan yang booth-nya sudah tidak ada.
  useEffect(() => {
    if (booths.length > 0) pins.prune(new Set(known.keys()));
  }, [booths.length, known, pins]);

  const list = pins.ids
    .map((id) => known.get(id))
    .filter((b): b is PublicBooth => !!b)
    .sort((a, b) => compareBoothNo(a.boothNo, b.boothNo));

  if (state.frozen) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={P.buttonAria(pins.count)}
        style={{ top: "max(1rem, env(safe-area-inset-top))" }}
        className="group fixed right-4 z-40 inline-flex h-11 items-center gap-2 rounded-chip border-(length:--border-w) border-line bg-accent px-3 text-sm font-bold text-accent-fg shadow-card transition-transform duration-(--motion-fast) hover:-translate-y-0.5 active:translate-y-px active:shadow-press"
      >
        <Icon name={pins.count > 0 ? "bookmark-check" : "bookmark"} className="size-5" />
        <span className="hidden sm:inline">{P.button}</span>
        <b className="grid min-w-6 place-items-center rounded-full bg-text px-1.5 text-xs text-surface">
          {pins.count}
        </b>
      </button>

      {open && (
        <Modal open onClose={() => setOpen(false)} title={P.title}>
          <p className="text-xs text-muted">{P.hint}</p>
          {list.length === 0 ? (
            <p className="text-sm">{P.empty}</p>
          ) : (
            <ul className="grid max-h-[55dvh] gap-2 overflow-y-auto">
              {list.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center gap-2 rounded-card border-(length:--border-w) border-line bg-surface p-2"
                >
                  <Link
                    to={`/b/${b.id}`}
                    onClick={() => setOpen(false)}
                    className="grid min-w-0 flex-1 gap-0.5"
                  >
                    <span className="flex items-center gap-2">
                      <span className="rounded-chip border-(length:--border-w) border-line bg-surface-raised px-2 text-xs font-bold">
                        {b.boothNo ?? P.noNumber}
                      </span>
                      <span className="truncate font-bold">{b.name}</span>
                    </span>
                    {b.teamName && (
                      <span className="truncate text-xs text-muted">{b.teamName}</span>
                    )}
                    <RatingSummary
                      average={b.ratingAverage}
                      count={b.ratingCount}
                      hidden={ratingsHidden}
                      size="sm"
                    />
                  </Link>
                  <button
                    type="button"
                    aria-label={P.unpin(b.name)}
                    title={P.unpin(b.name)}
                    onClick={() => pins.unpin(b.id)}
                    className="grid size-9 shrink-0 place-items-center rounded-chip border-(length:--border-w) border-line bg-primary text-primary-fg"
                  >
                    <Icon name="bookmark-check" className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted">{P.count(pins.count, CONFIG.booth.pinsMax)}</p>
          <div className="flex justify-between gap-2">
            <Button onClick={() => pins.clear()} disabled={pins.count === 0}>
              {P.clear}
            </Button>
            <Button variant="primary" onClick={() => setOpen(false)}>
              {P.close}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
