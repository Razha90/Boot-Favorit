import type { ReactNode } from "react";
import { WriteAction } from "../../../components/shared/WriteAction";

/**
 * Pembungkus bagian yang bisa disunting pemilik. Dua penguncian terpisah: event selesai (`WriteAction`, B17) dan booth
 * ditolak/ditangguhkan (`locked`). Keduanya menonaktifkan isian; server tetap menolak penulisan (`event_ended`,
 * `booth_not_editable`), jadi ini hanya kejelasan tampilan, bukan satu-satunya pagar.
 */
export function Editable({ locked, children }: { locked: boolean; children: ReactNode }) {
  return (
    <WriteAction>
      <fieldset disabled={locked} className="m-0 grid min-w-0 gap-3 border-0 p-0">
        {children}
      </fieldset>
    </WriteAction>
  );
}
