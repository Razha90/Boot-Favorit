import { hash32 } from "@shared/fair-order";
import { hasText, initials } from "@shared/visual";
import { cva } from "class-variance-authority";
import type { CSSProperties } from "react";
import { cn } from "../../lib/cn";

// Kelas ditulis utuh agar Tailwind dapat mendeteksinya. Palet stiker hanya hijau-oranye-krem (keputusan 31).
const COLORS = [
  "bg-sticker-1",
  "bg-sticker-2",
  "bg-sticker-3",
  "bg-sticker-4",
  "bg-sticker-5",
] as const;
const TILTS = ["-1.5deg", "1.2deg", "-0.6deg", "2deg"] as const;

const frame = cva(
  "relative grid shrink-0 place-items-center overflow-hidden border-(length:--border-w) border-line text-primary-fg",
  {
    variants: {
      size: {
        xs: "size-10 rounded-card text-sm",
        sm: "size-16 rounded-card text-xl",
        // md+ : ukuran SAMA dengan foto 4:3 di kartu; miring + selotip hanya pada gaya seru
        md: "aspect-[4/3] w-full rounded-card text-5xl shadow-card rotate-(--t) in-data-[vibe=pro]:rotate-0",
        lg: "aspect-[4/3] w-full rounded-card text-7xl shadow-card rotate-(--t) in-data-[vibe=pro]:rotate-0",
        winner: "aspect-[4/3] w-full rounded-card text-8xl shadow-card",
      },
      shape: { landscape: "", square: "aspect-square" },
    },
    defaultVariants: { size: "md", shape: "landscape" },
  },
);

export type PhotoFrameSize = "xs" | "sm" | "md" | "lg" | "winner";

/**
 * Bingkai yang MEMANG dirancang untuk menggantikan foto (explore.md A16): polaroid dengan inisial nama,
 * nomor booth kecil di pojok, dan warna stabil dari hash id. Tanpa ikon, tanpa teks keterangan, tanpa
 * permintaan jaringan. Tampil sama dengan bingkai biasa: bagian desain, bukan pesan kesalahan.
 */
export function PhotoFrame({
  id,
  name,
  boothNo,
  size = "md",
  shape = "landscape",
  className,
}: {
  id: string;
  name: string;
  boothNo?: string | null;
  size?: PhotoFrameSize;
  shape?: "landscape" | "square";
  className?: string;
}) {
  const h = hash32(id);
  const color = COLORS[h % COLORS.length];
  const tilt = TILTS[h % TILTS.length];
  const large = size === "md" || size === "lg" || size === "winner";

  return (
    <div
      aria-hidden="true"
      data-photo-frame=""
      className={cn(frame({ size, shape }), color, className)}
      style={{ "--t": tilt } as CSSProperties}
    >
      {large && (
        <span className="absolute -top-1 left-1/2 h-4 w-16 -translate-x-1/2 -rotate-2 bg-sticker-3/80 in-data-[vibe=pro]:hidden" />
      )}
      <span className="line-clamp-2 max-w-[90%] text-center font-display font-extrabold leading-none [overflow-wrap:anywhere]">
        {initials(name, boothNo)}
      </span>
      {large && hasText(boothNo) && (
        <span className="absolute bottom-2 left-2 max-w-[70%] truncate rounded-chip border-(length:--border-w) border-line bg-surface-raised px-2 py-0.5 text-xs font-bold text-text">
          {boothNo}
        </span>
      )}
    </div>
  );
}
