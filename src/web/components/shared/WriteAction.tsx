import { type ReactNode, useEffect, useState } from "react";
import { copy } from "../../lib/copy";
import { useEventState } from "../../lib/event-state";
import { AlertCard } from "../ui/Alert";

const EXIT_MS = 220;

/**
 * Membungkus tombol/form/uploader yang mengubah data. Setelah event selesai semuanya hanya-baca
 * (explore.md B17): `disable` menonaktifkan isian (fieldset), `hide` tidak merender sama sekali.
 * Admin tidak memakai pembungkus ini karena tidak pernah dibekukan.
 */
export function WriteAction({
  children,
  mode = "disable",
}: {
  children: ReactNode;
  mode?: "disable" | "hide";
}) {
  const { frozen } = useEventState();
  if (mode === "hide") return frozen ? null : children;
  return (
    <fieldset disabled={frozen} className="m-0 min-w-0 border-0 p-0">
      {children}
    </fieldset>
  );
}

/**
 * Alert mengambang di kanan atas ("Event telah berakhir. Tampilan ini hanya-baca.") pada halaman
 * publik dan portal booth. Bersifat persisten sampai ditutup manual, sehingga tanpa animasi loader.
 */
export function ReadOnlyBanner() {
  const { frozen } = useEventState();
  const [exiting, setExiting] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!exiting) return;
    const t = setTimeout(() => setDismissed(true), EXIT_MS);
    return () => clearTimeout(t);
  }, [exiting]);

  if (!frozen || dismissed) return null;
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-40 w-[min(23rem,calc(100vw-2rem))]">
      <AlertCard
        tone="warning"
        role="status"
        persistent
        exiting={exiting}
        message={copy.readOnly.banner}
        onClose={() => setExiting(true)}
      />
    </div>
  );
}
