import { Icon } from "../../../components/ui/Icon";
import type { RevealControls } from "../../../features/reveal/use-reveal";
import { copy } from "../../../lib/copy";
import { useEventState } from "../../../lib/event-state";

/**
 * Tombol terbang pemutar ulang animasi pemenang di kiri atas (hanya ikon Play).
 * Hanya tampil setelah event selesai dan hasil diumumkan (`state.frozen && reveal.canReplay`).
 */
export function ResultsBanner({ reveal }: { reveal: RevealControls }) {
  const state = useEventState();
  if (!state.frozen || !reveal.canReplay) return null;
  return (
    <button
      type="button"
      onClick={reveal.replay}
      aria-label={copy.results.replay}
      title={copy.results.replay}
      style={{ top: "max(1rem, env(safe-area-inset-top))" }}
      className="group fixed left-4 z-40 grid size-12 place-items-center rounded-full border-(length:--border-w) border-line bg-primary text-primary-fg shadow-card transition-transform duration-(--motion-fast) hover:-translate-y-0.5 active:translate-y-px active:shadow-press"
    >
      <Icon name="play" className="size-5 translate-x-0.5" />
    </button>
  );
}
