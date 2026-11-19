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
}: {
  src: string | null | undefined;
  /** Kosongkan untuk gambar dekoratif */
  alt?: string;
  /** mis. "4/3": menahan ruang agar tidak ada layout shift */
  aspect?: string;
  fallback?: ReactNode;
  className?: string;
  onFail?: () => void;
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
      loading="lazy"
      style={aspect ? { aspectRatio: aspect } : undefined}
      className={cn("block h-auto max-w-full object-cover", className)}
      onError={() => {
        setFailed(true);
        onFail?.();
      }}
    />
  );
}
