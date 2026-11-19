import { PosterPrintButton } from "../../../components/shared/PosterPrint";
import { type PosterContent, QrPoster } from "../../../components/shared/QrPoster";

/**
 * Isi panel "Kode QR" di menu Bagikan: poster yang SAMA dengan poster cetak admin (QrPoster), ditambah tombol cetak.
 * Dimuat malas (berisi pembuat QR) hanya saat panel dibuka.
 */
export default function SharePoster({ content }: { content: PosterContent }) {
  return (
    <div className="grid gap-3">
      <QrPoster size="a4" {...content} />
      <PosterPrintButton content={content} />
    </div>
  );
}
