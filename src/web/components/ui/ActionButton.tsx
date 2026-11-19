import { ApiError } from "@shared/errors";
import {
  type MouseEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { ActionContext, ActionStatus } from "../../lib/action";
import { NetworkError } from "../../lib/api";
import { copy } from "../../lib/copy";
import { useAction } from "../../lib/use-action";
import { Button, type ButtonProps } from "./Button";
import { Spinner } from "./Spinner";

/** Teks galat untuk pengguna: kode API dipetakan di copy.ts; galat jaringan dibedakan per sebab. */
export function describeError(err: Error): string {
  if (err instanceof NetworkError) return copy.action[err.reason];
  if (err instanceof ApiError) return copy.errors[err.code];
  return copy.errors.internal_error;
}

export interface ActionButtonProps
  extends Omit<ButtonProps, "onClick" | "onError" | "children" | "type"> {
  /** Fungsi aksi. `ctx.key` WAJIB dikirim sebagai Idempotency-Key bila aksi menulis ke server. */
  action: (ctx: ActionContext) => Promise<unknown>;
  children: ReactNode;
  /** Label saat memproses; bawaan copy.action.pending */
  pendingLabel?: string;
  /** Tombol submit form: aksi dijalankan lewat onClick yang sama (Enter pada form ikut terlindungi). */
  type?: "button" | "submit";
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  /** Dipanggil setiap status berubah; dipakai dialog untuk tidak menutup saat pending (B21). */
  onStatusChange?: (status: ActionStatus) => void;
  /**
   * Bila nilai ini berubah (mis. isian form), niat aksi dianggap BARU: status kembali idle dan kunci
   * idempotensi dibuang. Tanpa ini, "Coba lagi" memakai kunci lama walau isiannya sudah diubah.
   */
  resetOn?: unknown;
}

/**
 * SATU-SATUNYA tombol untuk aksi yang mengubah data (explore.md B21 lapis 1): penjaga klik ganda sinkron,
 * loader, lebar terkunci (tanpa layout shift), aria-busy, "Coba lagi" setelah galat dengan kunci yang sama.
 */
export function ActionButton({
  action,
  children,
  pendingLabel,
  type = "button",
  onSuccess,
  onError,
  onStatusChange,
  resetOn,
  disabled,
  ...rest
}: ActionButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const [lockedWidth, setLockedWidth] = useState<number | undefined>();
  const { run, reset, status, error } = useAction(action);
  const pending = status === "pending";

  const firstRender = useRef(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: hanya `resetOn` yang boleh memicu reset
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    reset();
  }, [resetOn]);

  // Kunci lebar sebelum label berganti supaya tombol tidak bergeser.
  useLayoutEffect(() => {
    if (!pending) setLockedWidth(undefined);
  }, [pending]);

  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    if (type === "submit") e.preventDefault(); // pengiriman ditangani runner, bukan navigasi form
    if (ref.current && !pending) setLockedWidth(ref.current.offsetWidth);
    void run(); // klik ganda diabaikan oleh penjaga sinkron di runner
  }

  const prev = useRef(status);
  useLayoutEffect(() => {
    if (prev.current !== status) {
      onStatusChange?.(status);
      if (status === "success") onSuccess?.();
      if (status === "error" && error) onError?.(error);
      prev.current = status;
    }
  }, [status, error, onSuccess, onError, onStatusChange]);

  const label = pending
    ? (pendingLabel ?? copy.action.pending)
    : status === "error"
      ? copy.action.retry
      : children;

  return (
    <span className="inline-grid gap-1">
      <Button
        ref={ref}
        type={type}
        disabled={disabled || pending}
        aria-busy={pending || undefined}
        style={lockedWidth ? { width: lockedWidth } : undefined}
        onClick={handleClick}
        {...rest}
        icon={pending ? false : rest.icon}
      >
        {pending && <Spinner />}
        {label}
      </Button>
      {status === "error" && error && (
        <span role="alert" className="text-xs text-danger">
          {describeError(error)}
        </span>
      )}
    </span>
  );
}
