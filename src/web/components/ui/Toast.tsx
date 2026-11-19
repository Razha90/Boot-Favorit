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
import { cn } from "../../lib/cn";
import { copy } from "../../lib/copy";

export type ToastTone = "info" | "success" | "danger";
interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

const TOAST_MS = 5000;
const MAX_TOASTS = 3;

interface ToastApi {
  push: (message: string, tone?: ToastTone) => void;
}
const ToastContext = createContext<ToastApi | null>(null);

const TONES: Record<ToastTone, string> = {
  info: "bg-surface-raised text-text",
  success: "bg-primary text-primary-fg",
  danger: "bg-danger text-surface-raised",
};

/** Pemberitahuan singkat. Wilayah aria-live sopan (polite), maksimal 3, hilang sendiri setelah 5 detik. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setItems((l) => l.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (message: string, tone: ToastTone = "info") => {
      const id = nextId.current++;
      setItems((l) => [...l, { id, tone, message }].slice(-MAX_TOASTS));
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), TOAST_MS),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const all = timers.current;
    return () => {
      for (const t of all.values()) clearTimeout(t);
    };
  }, []);

  const api = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 grid justify-items-center gap-2 px-4"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto flex items-center gap-3 rounded-card border-(length:--border-w) border-line px-4 py-2 text-sm shadow-card",
              TONES[t.tone],
            )}
          >
            <span>{t.message}</span>
            <button type="button" className="font-bold underline" onClick={() => dismiss(t.id)}>
              {copy.states.close}
            </button>
          </div>
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
