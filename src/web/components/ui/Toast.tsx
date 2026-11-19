import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { triggerSfx } from "../../lib/sfx-bridge";
import { AlertCard, type AlertTone } from "./Alert";

export type ToastTone = AlertTone;

export interface ToastOptions {
  loading?: boolean;
  /** Alert hanya hilang saat ditutup manual (tanpa animasi loader/hitung-mundur) */
  persistent?: boolean;
  /** 0 atau `null` = bertahan sampai ditutup manual atau diperbarui */
  durationMs?: number | null;
}

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
  loading: boolean;
  persistent: boolean;
  durationMs: number | null;
  exiting: boolean;
}

const TOAST_MS = 5000;
const EXIT_MS = 220;
const MAX_TOASTS = 3;

interface ToastApi {
  push: (message: string, tone?: ToastTone, options?: ToastOptions) => number;
  loading: (message: string) => number;
  update: (id: number, message: string, tone?: ToastTone, options?: ToastOptions) => void;
  dismiss: (id: number) => void;
}
const ToastContext = createContext<ToastApi | null>(null);

/**
 * Sistem alert & pemberitahuan kanan atas (`fixed right-4 top-4`). Mendukung animasi masuk/keluar,
 * ikon nada, loader animasi (`loading` dan progress hitung-mundur), serta `aria-live="polite"`.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const exitTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const clearItemTimers = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    const et = exitTimers.current.get(id);
    if (et) clearTimeout(et);
    exitTimers.current.delete(id);
  }, []);

  const dismiss = useCallback(
    (id: number) => {
      clearItemTimers(id);
      setItems((list) => list.map((x) => (x.id === id ? { ...x, exiting: true } : x)));
      exitTimers.current.set(
        id,
        setTimeout(() => {
          exitTimers.current.delete(id);
          setItems((list) => list.filter((x) => x.id !== id));
        }, EXIT_MS),
      );
    },
    [clearItemTimers],
  );

  const scheduleAutoDismiss = useCallback(
    (id: number, ms: number | null) => {
      const prev = timers.current.get(id);
      if (prev) clearTimeout(prev);
      timers.current.delete(id);
      if (ms !== null && ms > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), ms),
        );
      }
    },
    [dismiss],
  );

  const push = useCallback(
    (message: string, tone: ToastTone = "info", options: ToastOptions = {}) => {
      if (!options.loading) triggerSfx("pop");
      const id = nextId.current++;
      const isLoading = options.loading === true;
      const persistent = options.persistent === true;
      const durationMs = persistent
        ? null
        : options.durationMs === undefined
          ? isLoading
            ? null
            : TOAST_MS
          : options.durationMs;
      setItems((l) =>
        [
          ...l,
          { id, tone, message, loading: isLoading, persistent, durationMs, exiting: false },
        ].slice(-MAX_TOASTS),
      );
      scheduleAutoDismiss(id, durationMs);
      return id;
    },
    [scheduleAutoDismiss],
  );

  const loading = useCallback(
    (message: string) => push(message, "info", { loading: true, durationMs: null }),
    [push],
  );

  const update = useCallback(
    (id: number, message: string, tone: ToastTone = "success", options: ToastOptions = {}) => {
      const isLoading = options.loading === true;
      const persistent = options.persistent === true;
      const durationMs = persistent
        ? null
        : options.durationMs === undefined
          ? isLoading
            ? null
            : TOAST_MS
          : options.durationMs;
      if (!isLoading) triggerSfx("pop");
      setItems((l) =>
        l.map((x) =>
          x.id === id
            ? { ...x, message, tone, loading: isLoading, persistent, durationMs, exiting: false }
            : x,
        ),
      );
      scheduleAutoDismiss(id, durationMs);
    },
    [scheduleAutoDismiss],
  );

  useEffect(() => {
    const auto = timers.current;
    const exits = exitTimers.current;
    return () => {
      for (const t of auto.values()) clearTimeout(t);
      for (const t of exits.values()) clearTimeout(t);
    };
  }, []);

  const api = useMemo(() => ({ push, loading, update, dismiss }), [push, loading, update, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 top-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col items-stretch gap-2.5"
      >
        {items.map((t) => (
          <AlertCard
            key={t.id}
            tone={t.tone}
            message={t.message}
            loading={t.loading}
            persistent={
              t.persistent ||
              (!t.loading && !(typeof t.durationMs === "number" && t.durationMs > 0))
            }
            durationMs={t.durationMs ?? undefined}
            exiting={t.exiting}
            onClose={() => dismiss(t.id)}
            role="status"
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast harus dipakai di dalam ToastProvider");
  return ctx;
}
