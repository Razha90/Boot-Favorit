import { lazy, Suspense } from "react";
import type { RevealControls } from "./use-reveal";

// Dimuat lazy: kode animasi hanya diunduh saat benar-benar akan diputar (B16, B20).
const WinnerReveal = lazy(() =>
  import("../../components/shared/WinnerReveal").then((m) => ({ default: m.WinnerReveal })),
);

export function RevealLayer({
  reveal,
  interactive = true,
}: {
  reveal: RevealControls;
  interactive?: boolean;
}) {
  const o = reveal.overlay;
  if (!o) return null;
  return (
    <Suspense fallback={null}>
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
