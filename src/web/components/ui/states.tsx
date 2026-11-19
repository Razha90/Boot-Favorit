import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { copy } from "../../lib/copy";
import { Button } from "./Button";

/**
 * Kerangka pemuatan. Hanya untuk DATA YANG SEDANG DIMUAT, bukan data kosong (A16):
 * data kosong ditangani EmptyState/Present, tidak pernah kotak abu-abu berkedip.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-card bg-surface-tint", className ?? "h-6 w-full")}
    />
  );
}

/** Keadaan kosong yang ramah: judul, penjelasan singkat, dan satu ajakan bertindak (opsional). */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid justify-items-center gap-2 rounded-card border-(length:--border-w) border-dashed border-line px-6 py-10 text-center">
      <p className="font-display text-lg font-extrabold">{title}</p>
      {body && <p className="max-w-prose text-sm text-muted">{body}</p>}
      {action}
    </div>
  );
}

/** Galat yang bisa dicoba lagi. Pesan berperan `alert` agar dibacakan pembaca layar. */
export function ErrorState({
  message = copy.states.error,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="grid justify-items-center gap-2 px-6 py-8 text-center">
      <p className="text-sm text-danger">{message}</p>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          {copy.action.retry}
        </Button>
      )}
    </div>
  );
}
