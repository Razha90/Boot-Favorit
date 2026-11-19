import type { CSSProperties, ReactNode } from "react";
import { cn } from "../../lib/cn";
import { copy } from "../../lib/copy";

export type AlertTone = "info" | "success" | "warning" | "danger";

const CARD_TONE: Record<AlertTone, string> = {
  info: "bg-surface-raised text-text",
  success: "bg-primary text-primary-fg",
  warning: "bg-accent text-accent-fg",
  danger: "bg-danger text-surface-raised",
};

const BADGE_TONE: Record<AlertTone, string> = {
  info: "bg-surface-tint text-text",
  success: "bg-surface-raised text-primary-strong",
  warning: "bg-surface-raised text-text",
  danger: "bg-surface-raised text-danger",
};

const BAR_TONE: Record<AlertTone, string> = {
  info: "bg-primary",
  success: "bg-text",
  warning: "bg-text",
  danger: "bg-surface-raised",
};

function ToneIcon({ tone, loading }: { tone: AlertTone; loading?: boolean }) {
  if (loading) {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-4 animate-spin fill-none stroke-current"
        strokeWidth={2.6}
        strokeLinecap="round"
      >
        <circle cx="12" cy="12" r="9" className="opacity-25" />
        <path d="M12 3a9 9 0 0 1 9 9" />
      </svg>
    );
  }
  switch (tone) {
    case "success":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-4 fill-none stroke-current"
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      );
    case "warning":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-4 fill-none stroke-current"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
          <path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
      );
    case "danger":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-4 fill-none stroke-current"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M15 9l-6 6M9 9l6 6" />
        </svg>
      );
    default:
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-4 fill-none stroke-current"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      );
  }
}

/**
 * Kartu alert animasi (ala plugin notifikasi) di kanan atas: ikon per nada, tombol tutup, dan bilah loader
 * hitung-mundur (`durationMs`) atau sapuan loader (`loading` / `loaderBar`). Untuk alert persisten yang hanya
 * hilang saat ditutup (`persistent` atau tanpa `durationMs` saat tidak `loading`), animasi loader disembunyikan.
 */
export function AlertCard({
  tone = "info",
  message,
  loading = false,
  loaderBar = false,
  persistent = false,
  durationMs,
  exiting = false,
  onClose,
  role = "status",
  className,
}: {
  tone?: AlertTone;
  message: ReactNode;
  loading?: boolean;
  /** Menampilkan bilah animasi loader menyapu tanpa spinner ikon penuh (diabaikan bila alert persisten) */
  loaderBar?: boolean;
  /** Alert tetap sampai ditutup manual: menyembunyikan seluruh animasi loader agar tidak mengganggu */
  persistent?: boolean;
  /** Lama tampil (ms); bila diisi menampilkan animasi bar progres di bagian bawah */
  durationMs?: number;
  exiting?: boolean;
  onClose?: () => void;
  role?: "status" | "alert";
  className?: string;
}) {
  const hasAutoDismiss = typeof durationMs === "number" && durationMs > 0;
  const isPersistent = persistent || (!loading && !hasAutoDismiss);
  const showProgress = !isPersistent && !loading && hasAutoDismiss;
  const showSweep = !isPersistent && (loading || loaderBar);

  return (
    <div
      role={role}
      className={cn(
        "alert-card pointer-events-auto relative overflow-hidden rounded-card border-(length:--border-w) border-line shadow-card",
        exiting ? "alert-exit" : "alert-enter",
        CARD_TONE[tone],
        className,
      )}
    >
      <div className="flex items-start gap-3 px-3.5 py-3">
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-line",
            BADGE_TONE[tone],
          )}
        >
          <ToneIcon tone={tone} loading={loading} />
        </span>

        <div className="min-w-0 flex-1 text-sm font-bold leading-snug [overflow-wrap:anywhere]">
          {message}
        </div>

        {onClose && (
          <button
            type="button"
            aria-label={copy.states.close}
            onClick={onClose}
            className="-mr-1 -mt-0.5 grid size-7 shrink-0 place-items-center rounded-full transition-colors hover:bg-text/10 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-4 fill-none stroke-current"
              strokeWidth={2.4}
              strokeLinecap="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {(showProgress || showSweep) && (
        <div aria-hidden="true" className="h-1 w-full overflow-hidden bg-text/15">
          {showSweep ? (
            <div className={cn("alert-loader-bar h-full w-1/2 rounded-full", BAR_TONE[tone])} />
          ) : (
            <div
              className={cn("alert-progress-bar h-full w-full", BAR_TONE[tone])}
              style={{ "--alert-ms": `${durationMs}ms` } as CSSProperties}
            />
          )}
        </div>
      )}
    </div>
  );
}
