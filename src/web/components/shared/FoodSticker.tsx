import { foodArtFor, foodArtPath } from "@shared/food-art";
import { cn } from "../../lib/cn";
import { SafeImage } from "./SafeImage";

/**
 * Stiker kartun makanan sebagai hiasan pengganti foto (explore.md A16, B27). Ilustrasi dipilih dari `seed`
 * (id booth/event) sehingga tetap sama tiap dimuat. Dekoratif: tanpa teks alternatif, tidak bisa diklik, dan
 * tidak pernah menyisakan ikon rusak (gagal dimuat = hilang). Bukan sinyal tentang dagangan atau peringkat.
 */
export function FoodSticker({
  seed,
  offset = 0,
  className,
  eager,
}: {
  seed: string;
  /** Menggeser pilihan agar beberapa stiker dalam satu tampilan tidak kembar */
  offset?: number;
  className?: string;
  eager?: boolean;
}) {
  return (
    <SafeImage
      src={foodArtPath(foodArtFor(seed, offset))}
      aspect="1/1"
      className={cn("pointer-events-none select-none", className)}
      fallback={null}
      eager={eager}
    />
  );
}
