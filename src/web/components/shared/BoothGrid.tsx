import type { PublicBooth } from "@shared/api-types";
import { gridVisualMode } from "@shared/visual";
import { copy } from "../../lib/copy";
import { EmptyState } from "../ui/states";
import { BoothCard } from "./BoothCard";
import { PinButton } from "./PinButton";

/**
 * Grid "Semua booth". Mode tampilan diputuskan SEKALI untuk seluruh daftar (explore.md A16):
 * sebagian berfoto → yang tanpa foto memakai bingkai; tak satu pun berfoto → semua kartu hanya-teks.
 * Urutan datang dari pemanggil (urutan acak per pengunjung, A8); komponen ini tidak mengacak.
 */
export function BoothGrid({
  booths,
  ratingsHidden = false,
  modeFrom,
}: {
  booths: readonly PublicBooth[];
  ratingsHidden?: boolean;
  /** Daftar LENGKAP untuk memutuskan mode, bila  hanya sebagian (pemuatan bertahap) */
  modeFrom?: readonly PublicBooth[];
}) {
  if (booths.length === 0) {
    return <EmptyState title={copy.visitor.noBooths} body={copy.visitor.noBoothsHint} />;
  }
  const mode = gridVisualMode(modeFrom ?? booths);
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-visual-mode={mode}>
      {booths.map((b) => (
        <li key={b.id} className="relative grid">
          <BoothCard booth={b} variant="card" visualMode={mode} ratingsHidden={ratingsHidden} />
          <PinButton
            boothId={b.id}
            boothName={b.name}
            className="absolute right-2.5 bottom-2.5 z-20"
          />
        </li>
      ))}
    </ul>
  );
}
