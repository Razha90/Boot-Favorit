import { type KeyboardEvent, useRef } from "react";
import { cn } from "../../lib/cn";
import { copy } from "../../lib/copy";

/** Angka untuk pembaca layar, koma Indonesia dan tanpa ",0" (4,7 / 5 / 0). */
const ariaNumber = (v: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(Math.round(v * 10) / 10);

const SIZES = { sm: "text-sm", md: "text-lg", lg: "text-3xl" } as const;

/**
 * Bintang rating (explore.md B14): `display` untuk menampilkan nilai (boleh pecahan), `input` untuk memberi
 * nilai (radiogroup yang bisa dioperasikan keyboard). Aksesibilitas ditanam di sini, bukan di tiap halaman.
 */
export function RatingStars(
  props:
    | { mode: "display"; value: number | null; size?: keyof typeof SIZES; className?: string }
    | {
        mode: "input";
        value: number;
        onChange: (stars: number) => void;
        size?: keyof typeof SIZES;
        disabled?: boolean;
        className?: string;
      },
) {
  const size = props.size ?? "md";

  if (props.mode === "display") {
    const v = Math.min(5, Math.max(0, props.value ?? 0));
    const pct = (v / 5) * 100;
    return (
      <span
        role="img"
        aria-label={copy.visitor.stars(ariaNumber(v))}
        className={cn(
          "inline-block bg-clip-text leading-none tracking-wider text-transparent",
          SIZES[size],
          props.className,
        )}
        // `background` (bukan background-image): gradasi dari token, terpotong ke bentuk bintang
        style={{
          background: `linear-gradient(90deg, var(--star) ${pct}%, var(--star-off) ${pct}%)`,
          WebkitBackgroundClip: "text",
        }}
      >
        ★★★★★
      </span>
    );
  }
  return <StarInput {...props} size={size} />;
}

function StarInput({
  value,
  onChange,
  size,
  disabled,
  className,
}: {
  value: number;
  onChange: (stars: number) => void;
  size: keyof typeof SIZES;
  disabled?: boolean;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const move = (to: number) => {
      const next = Math.min(5, Math.max(1, to));
      onChange(next);
      refs.current[next - 1]?.focus();
      e.preventDefault();
    };
    if (e.key === "ArrowRight" || e.key === "ArrowUp") move(i + 2);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") move(i);
    else if (e.key === "Home") move(1);
    else if (e.key === "End") move(5);
  }

  return (
    <div
      role="radiogroup"
      aria-label={copy.visitor.rateStars}
      className={cn("inline-flex gap-1", className)}
    >
      {[1, 2, 3, 4, 5].map((n, i) => (
        // biome-ignore lint/a11y/useSemanticElements: bintang bergaya kustom dengan roving tabindex; <input type="radio"> tidak bisa digayakan sebagai bintang
        <button
          key={n}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={copy.visitor.stars(n)}
          // Satu titik fokus (roving tabindex): bintang terpilih, atau yang pertama bila belum memilih.
          tabIndex={value === n || (value === 0 && n === 1) ? 0 : -1}
          disabled={disabled}
          onClick={() => onChange(n)}
          onKeyDown={(e) => onKey(e, i)}
          className={cn(
            "leading-none transition-transform duration-(--motion-fast) active:scale-90 disabled:opacity-60",
            SIZES[size],
            n <= value ? "text-star" : "text-star-off",
          )}
        >
          ★
        </button>
      ))}
    </div>
  );
}
