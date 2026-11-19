import { cva } from "class-variance-authority";
import { cn } from "../../lib/cn";
import { copy } from "../../lib/copy";
import { formatRupiah, formatRupiahShort } from "../../lib/format";

const tag = cva("inline-flex items-baseline gap-1.5 font-bold", {
  variants: {
    size: {
      // stiker oranye di pojok foto / kartu
      sticker:
        "rounded-chip border-(length:--border-w) border-line bg-accent px-3 py-1 text-sm text-accent-fg shadow-card",
      inline: "text-base",
      // bentuk ringkas "Rp 14rb" untuk stiker kartu booth
      short:
        "rounded-chip border-(length:--border-w) border-line bg-accent px-2.5 py-0.5 text-xs text-accent-fg",
    },
  },
  defaultVariants: { size: "inline" },
});

/**
 * Harga rupiah bulat (explore.md A14): `Rp 18.000`, `Rp 14rb` (ringkas), atau `Gratis`.
 * Harga normal dicoret hanya bila memang lebih besar daripada harga.
 */
export function PriceTag({
  priceIdr,
  compareIdr,
  size = "inline",
  className,
}: {
  priceIdr: number;
  compareIdr?: number | null;
  size?: "sticker" | "inline" | "short";
  className?: string;
}) {
  const showCompare = compareIdr != null && compareIdr > priceIdr && size !== "short";
  return (
    <span className={cn(tag({ size }), className)}>
      <span>{size === "short" ? formatRupiahShort(priceIdr) : formatRupiah(priceIdr)}</span>
      {showCompare && (
        <s className="text-xs font-normal opacity-70">
          <span className="sr-only">{copy.visitor.was} </span>
          {formatRupiah(compareIdr)}
        </s>
      )}
    </span>
  );
}
