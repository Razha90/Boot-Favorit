import { useEffect, useId, useRef, useState } from "react";
import { cn } from "../../lib/cn";
import { copy } from "../../lib/copy";
import { Icon } from "./Icon";

/**
 * Ikon informasi interaktif dengan modal/popover Info Tip saat di-hover, difokus, atau diklik.
 * Menggantikan keterangan tambahan dalam tanda kurung pada label atau judul.
 */
export function InfoTip({
  text,
  title,
  label,
  className,
}: {
  text: string;
  title?: string;
  label?: string;
  className?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [align, setAlign] = useState<"center" | "start" | "end">("center");
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tipId = useId();
  const open = hovered || pinned;

  useEffect(() => {
    if (!pinned) return;
    const onPointerDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setPinned(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPinned(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [pinned]);

  useEffect(() => {
    if (!open || !wrapRef.current || typeof window === "undefined") return;
    const r = wrapRef.current.getBoundingClientRect();
    if (r.left < 140) setAlign("start");
    else if (window.innerWidth - r.right < 140) setAlign("end");
    else setAlign("center");
  }, [open]);

  return (
    <span ref={wrapRef} className={cn("relative inline-flex items-center align-middle", className)}>
      <button
        type="button"
        aria-label={label ?? (title ? `Informasi: ${title}` : "Informasi")}
        aria-expanded={open}
        aria-controls={open ? tipId : undefined}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setPinned((v) => !v);
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        className={cn(
          "group inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-tint hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2",
          open && "bg-primary-soft text-primary-strong",
        )}
      >
        <Icon name="info" className="size-3.5" />
      </button>

      {open && (
        <div
          id={tipId}
          role="tooltip"
          className={cn(
            "reveal-pop absolute bottom-full z-50 mb-2 w-64 max-w-[calc(100vw-2rem)] rounded-card border-(length:--border-w) border-line bg-surface-raised p-3 text-left text-xs font-normal leading-relaxed text-text shadow-card",
            align === "start" && "left-0",
            align === "end" && "right-0",
            align === "center" && "left-1/2 -translate-x-1/2",
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="grid gap-1">
              {title && <p className="font-bold text-text">{title}</p>}
              <p className="text-muted">{text}</p>
            </div>
            {pinned && (
              <button
                type="button"
                aria-label={copy.states.close}
                onClick={(e) => {
                  e.stopPropagation();
                  setPinned(false);
                  setHovered(false);
                }}
                className="-mr-1 -mt-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-tint hover:text-text"
              >
                <Icon name="close" className="size-3" />
              </button>
            )}
          </div>
        </div>
      )}
    </span>
  );
}
