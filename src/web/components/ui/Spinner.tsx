import { cn } from "../../lib/cn";

/** Pemutar kecil; mengikuti warna teks. Berhenti berputar pada gerak minimal (diatur di theme.css). */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent",
        className,
      )}
    />
  );
}
