import { Icon } from "../../../components/ui/Icon";
import type { RevealControls } from "../../../features/reveal/use-reveal";
import { copy } from "../../../lib/copy";

/**
 * Tombol terbang pemutar ulang animasi pemenang di kanan bawah (hanya ikon Play).
 * Tidak dirender bila hasil belum diumumkan (tidak ada animasi; bagian 03 menulis "Hasil segera diumumkan").
 */
export function ResultsBanner({ reveal }: { reveal: RevealControls }) {
  if (!reveal.canReplay) return null;
  return (
    <button
      type="button"
      onClick={reveal.replay}
      aria-label={copy.results.replay}
      title={copy.results.replay}
      style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
      className="group fixed right-4 z-40 grid size-12 place-items-center rounded-full border-(length:--border-w) border-line bg-primary text-primary-fg shadow-card transition-transform duration-(--motion-fast) hover:-translate-y-0.5 active:translate-y-px active:shadow-press"
    >
      <Icon name="play" className="size-5 translate-x-0.5" />
    </button>
  );
}
