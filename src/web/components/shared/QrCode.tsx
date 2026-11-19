import { useMemo } from "react";
import { encode } from "uqr";
import { cn } from "../../lib/cn";

// Zona tenang 4 modul = syarat standar QR agar pemindai selalu menemukan kode (2 modul sering gagal di kertas/layar).
const QUIET = 4;

/**
 * QR sebagai SVG yang digambar dari matriks modul (tanpa innerHTML, tanpa gambar). Warna dari token tetap `qr-*`:
 * selalu gelap di atas terang walau tema panggung. `label` dibacakan pembaca layar.
 */
export function QrCode({
  value,
  label,
  className,
  ecc = "M",
  plain = false,
}: {
  value: string;
  label: string;
  className?: string;
  /** Tingkat koreksi galat: Q/H lebih tahan kotor atau lipatan, tetapi kode lebih padat */
  ecc?: "L" | "M" | "Q" | "H";
  /** Tanpa sudut membulat (untuk dibingkai sendiri, mis. poster) */
  plain?: boolean;
}) {
  const { size, path } = useMemo(() => {
    const { data, size: n } = encode(value, { ecc, border: 0 });
    let d = "";
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (data[y]?.[x]) d += `M${x + QUIET} ${y + QUIET}h1v1h-1z`;
      }
    }
    return { size: n + QUIET * 2, path: d };
  }, [value, ecc]);

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className={cn(
        "aspect-square w-full bg-qr-bg text-qr-fg",
        !plain && "rounded-card",
        className,
      )}
    >
      <path d={path} fill="currentColor" />
    </svg>
  );
}
