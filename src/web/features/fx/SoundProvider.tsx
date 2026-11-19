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
import { useLocation } from "react-router";
import { cn } from "../../lib/cn";
import { copy } from "../../lib/copy";
import { createSafeStorage } from "../../lib/safe-storage";
import type { SfxMap, SfxName } from "../../lib/sfx";
import { setSfxGlobalEnabled, triggerSfx, unlockSfx } from "../../lib/sfx-bridge";

const SFX_KEY = "sfx";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

export interface SfxApi {
  enabled: boolean;
  setEnabled: (on: boolean) => void;
  toggle: () => void;
  play: <K extends SfxName>(name: K, ...args: SfxMap[K]) => void;
}

const SfxContext = createContext<SfxApi>({
  enabled: false,
  setEnabled: () => {},
  toggle: () => {},
  play: (name, ...args) => triggerSfx(name, ...args),
});

export function useSfx(): SfxApi {
  return useContext(SfxContext);
}

/**
 * Penyedia efek suara sintesis B23 (`SoundProvider`). Bawaan nyala kecuali `prefers-reduced-motion: reduce`.
 * Pilihan disimpan di penyimpanan peramban aman (`sfx`). Pindah halaman memutar suara `swish` pelan.
 */
export function SoundProvider({ children }: { children: ReactNode }) {
  const store = useMemo(() => createSafeStorage(), []);
  const [enabled, setEnabledState] = useState<boolean>(() => {
    const saved = store.get(SFX_KEY);
    if (saved === "on") return true;
    if (saved === "off") return false;
    return !prefersReducedMotion();
  });

  useEffect(() => {
    setSfxGlobalEnabled(enabled);
    document.documentElement.dataset.sfx = enabled ? "on" : "off";
    const onGesture = () => unlockSfx();
    document.addEventListener("pointerdown", onGesture, { passive: true, capture: true });
    return () => {
      document.removeEventListener("pointerdown", onGesture, true);
      setSfxGlobalEnabled(false);
    };
  }, [enabled]);

  // Putar swish saat pindah rute (lewati render awal).
  const { pathname } = useLocation();
  const prevPath = useRef(pathname);
  useEffect(() => {
    if (prevPath.current !== pathname) {
      prevPath.current = pathname;
      triggerSfx("swish");
    }
  }, [pathname]);

  const setEnabled = useCallback(
    (on: boolean) => {
      store.set(SFX_KEY, on ? "on" : "off");
      setSfxGlobalEnabled(on);
      setEnabledState(on);
      if (on) {
        unlockSfx();
        triggerSfx("toggle", true);
      }
    },
    [store],
  );

  const toggle = useCallback(() => {
    setEnabled(!enabled);
  }, [enabled, setEnabled]);

  const play = useCallback(<K extends SfxName>(name: K, ...args: SfxMap[K]) => {
    triggerSfx(name, ...args);
  }, []);

  const api = useMemo(
    () => ({ enabled, setEnabled, toggle, play }),
    [enabled, setEnabled, toggle, play],
  );
  return <SfxContext.Provider value={api}>{children}</SfxContext.Provider>;
}

/** Tombol mengambang kiri bawah untuk menyalakan/mematikan efek suara (B23). */
export function SoundToggle() {
  const { enabled, toggle } = useSfx();
  const { pathname } = useLocation();
  const isBoothPage = pathname.startsWith("/b/");
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      aria-label={enabled ? copy.fx.soundOn : copy.fx.soundOff}
      title={enabled ? copy.fx.soundOn : copy.fx.soundOff}
      className={cn(
        "fixed left-4 z-40 grid size-11 place-items-center rounded-full border-(length:--border-w) border-line shadow-card transition-transform duration-(--motion-fast) hover:-translate-y-0.5 active:translate-y-px active:shadow-press",
        isBoothPage ? "bottom-20 md:bottom-4" : "bottom-4",
        enabled ? "bg-accent text-accent-fg" : "bg-surface-raised text-text",
      )}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="size-5 fill-none stroke-current"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M11 5 6 9H3v6h3l5 4V5Z" />
        {enabled ? (
          <>
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M18.5 6a8.5 8.5 0 0 1 0 12" />
          </>
        ) : (
          <path d="M16 9l5 6m0-6-5 6" />
        )}
      </svg>
    </button>
  );
}
