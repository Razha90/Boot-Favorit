import { type ReactNode, useEffect, useState } from "react";
import { cn } from "../../lib/cn";

/**
 * SATU-SATUNYA tempat <img> boleh ditulis (dijaga lint `no-raw-img`, explore.md B26).
 * Tidak ada gambar ATAU gambar gagal dimuat diperlakukan sama: tampilkan `fallback` (bingkai) atau
 * `null` (komponen hilang). Tidak pernah ikon gambar rusak bawaan browser.
 * `onFail` memberi tahu induk bila gambar GAGAL dimuat (mis. Sorotan beralih ke tata letak hanya-teks).
 */
export function SafeImage({
  src,
  alt = "",
  aspect,
  fallback = null,
  className,
  onFail,
  eager = false,
}: {
  src: string | null | undefined;
  /** Kosongkan untuk gambar dekoratif */
  alt?: string;
  /** mis. "4/3": menahan ruang agar tidak ada layout shift */
  aspect?: string;
  fallback?: ReactNode;
  className?: string;
  onFail?: () => void;
  /** Muat langsung (bukan lazy): untuk poster cetak */
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: kunci/URL baru = coba lagi
  useEffect(() => setFailed(false), [src]);

  if (!src || failed) return fallback;
  return (
    <img
      src={src}
      alt={alt}
      decoding="async"
      loading={eager ? "eager" : "lazy"}
      style={aspect ? { aspectRatio: aspect } : undefined}
      // `h-auto` hanya bila pemanggil tidak menentukan tinggi: kelas h-*/size-* tidak bisa menimpanya (tanpa twMerge), dan
      // foto sangat tinggi akan meledak ke ukuran aslinya.
      className={cn(
        "block max-w-full object-cover",
        !/(^|\s)(size-|h-)/.test(className ?? "") && "h-auto",
        className,
      )}
      onError={() => {
        setFailed(true);
        onFail?.();
      }}
    />
  );
}
