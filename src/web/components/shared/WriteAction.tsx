import type { ReactNode } from "react";
import { copy } from "../../lib/copy";
import { useEventState } from "../../lib/event-state";

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

/** Banner "tampilan hanya-baca" yang konsisten di halaman publik dan portal booth. */
export function ReadOnlyBanner() {
  const { frozen } = useEventState();
  if (!frozen) return null;
  return (
    <p
      role="status"
      className="rounded-card border-(length:--border-w) border-line bg-surface-tint px-4 py-2 text-sm"
    >
      {copy.readOnly.banner}
    </p>
  );
}
