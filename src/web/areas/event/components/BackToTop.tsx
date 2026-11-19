import { useEffect, useState } from "react";
import { Icon } from "../../../components/ui/Icon";
import { copy } from "../../../lib/copy";

/** Jarak gulir (px) sebelum tombol muncul: kira-kira satu layar. */
const SHOW_AFTER = 480;

const prefersReducedMotion = () =>
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Tombol terbang bulat "kembali ke atas" di kanan bawah. Muncul setelah halaman digulir satu layar; gulir mulus
 * kecuali gerak minimal diminta. Pasangan simetris tombol suara di kiri bawah.
 */
export function BackToTop() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!visible) return null;
  return (
    <button
      type="button"
      onClick={() =>
        window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" })
      }
      aria-label={copy.event.footer.top}
      title={copy.event.footer.top}
      style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
      className="group fixed right-4 z-40 grid size-11 place-items-center rounded-full border-(length:--border-w) border-line bg-accent text-accent-fg shadow-card transition-transform duration-(--motion-fast) hover:-translate-y-0.5 active:translate-y-px active:shadow-press"
    >
      <Icon name="arrow-up" className="size-5" />
    </button>
  );
}
