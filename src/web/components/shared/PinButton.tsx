import { burstStars } from "../../features/fx/ClickFx";
import { cn } from "../../lib/cn";
import { copy } from "../../lib/copy";
import { useEventStateOptional } from "../../lib/event-state";
import { usePinsOptional } from "../../lib/pins";
import { triggerSfx } from "../../lib/sfx-bridge";
import { Icon } from "../ui/Icon";

/**
 * Tombol sematkan booth (explore.md B28). Lokal di peramban; tidak dirender di luar PinsProvider atau setelah event
 * selesai. `labeled` = pil bertulisan (halaman booth); bawaan = ikon bulat kecil (kartu).
 */
export function PinButton({
  boothId,
  boothName,
  labeled = false,
  className,
}: {
  boothId: string;
  boothName: string;
  labeled?: boolean;
  className?: string;
}) {
  const pins = usePinsOptional();
  const state = useEventStateOptional();
  if (!pins || state?.frozen) return null;
  const on = pins.has(boothId);
  const P = copy.event.pins;
  return (
    <button
      type="button"
      data-sfx-custom=""
      aria-pressed={on}
      aria-label={on ? P.unpin(boothName) : P.pin(boothName)}
      title={on ? P.unpin(boothName) : P.pin(boothName)}
      onClick={(e) => {
        if (on) {
          pins.unpin(boothId);
          triggerSfx("toggle", false);
        } else if (!pins.pin(boothId)) {
          triggerSfx("no");
        } else {
          triggerSfx("toggle", true);
          burstStars(e.currentTarget);
        }
      }}
      className={cn(
        "group inline-flex items-center justify-center gap-1.5 rounded-chip border-(length:--border-w) border-line text-xs font-bold shadow-card transition-transform hover:-translate-y-0.5 active:translate-y-px active:shadow-press",
        labeled ? "px-3 py-1.5 sm:text-sm" : "size-9",
        on ? "bg-primary text-primary-fg" : "bg-surface-raised text-text",
        className,
      )}
    >
      <Icon name={on ? "bookmark-check" : "bookmark"} className="size-4" />
      {labeled && (on ? P.pinnedLabel : P.pinLabel)}
    </button>
  );
}
