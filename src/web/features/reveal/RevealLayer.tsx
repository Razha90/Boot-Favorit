import { lazy, Suspense } from "react";
import { Spinner } from "../../components/ui/Spinner";
import { copy } from "../../lib/copy";
import type { RevealControls } from "./use-reveal";

// Dimuat lazy: kode animasi hanya diunduh saat benar-benar akan diputar (B16, B20).
const WinnerReveal = lazy(() =>
  import("../../components/shared/WinnerReveal").then((m) => ({ default: m.WinnerReveal })),
);

function RevealLoadingStage() {
  return (
    <output
      data-theme="panggung"
      aria-busy="true"
      aria-label={copy.reveal.label}
      className="reveal-stage fixed inset-0 z-50 grid place-items-center text-text"
    >
      <div className="grid justify-items-center gap-3 text-center">
        <Spinner className="size-8 border-3 text-accent" />
        <p className="text-xs font-extrabold tracking-[0.2em] uppercase text-primary-strong">
          {copy.reveal.drumroll}
        </p>
      </div>
    </output>
  );
}

export function RevealLayer({
  reveal,
  interactive = true,
}: {
  reveal: RevealControls;
  interactive?: boolean;
}) {
  const o = reveal.overlay;
  if (!o) return reveal.pending ? <RevealLoadingStage /> : null;
  return (
    <Suspense fallback={<RevealLoadingStage />}>
      <WinnerReveal
        results={o.results}
        onClose={reveal.close}
        // Pilihan "jangan putar otomatis" hanya untuk putar-ulang; pemutaran langsung admin tidak terpengaruh.
        onOptOut={o.mode === "replay" && interactive ? reveal.setOptOut : undefined}
        optedOut={reveal.optedOut}
        interactive={interactive}
      />
    </Suspense>
  );
}
