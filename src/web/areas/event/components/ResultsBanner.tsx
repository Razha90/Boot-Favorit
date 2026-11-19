import { Button } from "../../../components/ui/Button";
import type { RevealControls } from "../../../features/reveal/use-reveal";
import { copy } from "../../../lib/copy";

/**
 * Banner mode hanya-baca setelah hasil diumumkan (A8): tautan "Putar ulang animasi pemenang" dan saklar putar otomatis.
 * Tidak dirender bila hasil belum diumumkan (tidak ada animasi; bagian 03 menulis "Hasil segera diumumkan").
 */
export function ResultsBanner({ reveal }: { reveal: RevealControls }) {
  if (!reveal.canReplay) return null;
  return (
    <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4">
      <Button size="sm" variant="primary" onClick={reveal.replay}>
        {copy.results.replay}
      </Button>
      <Button
        size="sm"
        aria-pressed={!reveal.optedOut}
        onClick={() => reveal.setOptOut(!reveal.optedOut)}
      >
        {reveal.optedOut ? copy.results.autoplayOff : copy.results.autoplayOn}
      </Button>
    </div>
  );
}
