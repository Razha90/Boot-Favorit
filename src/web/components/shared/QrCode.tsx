import { useMemo } from "react";
import { encode } from "uqr";
import { cn } from "../../lib/cn";

const QUIET = 2; // zona tenang (modul) di sekeliling kode, agar mudah dipindai

/**
 * QR sebagai SVG yang digambar dari matriks modul (tanpa innerHTML, tanpa gambar). Warna dari token tetap `qr-*`:
 * selalu gelap di atas terang walau tema panggung. `label` dibacakan pembaca layar.
 */
export function QrCode({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const { size, path } = useMemo(() => {
    const { data, size: n } = encode(value, { ecc: "M", border: 0 });
    let d = "";
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (data[y]?.[x]) d += `M${x + QUIET} ${y + QUIET}h1v1h-1z`;
      }
    }
    return { size: n + QUIET * 2, path: d };
  }, [value]);

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className={cn("aspect-square w-full rounded-card bg-qr-bg text-qr-fg", className)}
    >
      <path d={path} fill="currentColor" />
    </svg>
  );
}
