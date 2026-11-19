import type { PublicProduct } from "@shared/api-types";
import { hash32 } from "@shared/fair-order";
import { gridVisualMode } from "@shared/visual";
import { type ReactNode, useEffect, useState } from "react";
import { cn } from "../../lib/cn";
import { copy } from "../../lib/copy";
import { useMediaUrl } from "../../lib/media-url";
import { Badge } from "../ui/Card";
import { FoodSticker } from "./FoodSticker";
import { Present } from "./Present";
import { PriceTag } from "./PriceTag";
import { SafeImage } from "./SafeImage";

/** Mode untuk SELURUH etalase: sebagian berfoto → bingkai untuk yang kosong; tak ada foto sama sekali → daftar kompak. */
export const productGridMode = (products: readonly Pick<PublicProduct, "thumbKey">[]) =>
  gridVisualMode(products.map((p) => ({ coverThumbKey: p.thumbKey })));

const BADGE = { limited: "accent", new: "primary" } as const;
const ART_TONES = [
  "bg-sticker-1",
  "bg-sticker-2",
  "bg-sticker-3",
  "bg-sticker-4",
  "bg-sticker-5",
] as const;

/** Kartu produk di etalase. `actions` = slot (mis. "Simpan ke incaran"). */
export function ProductCard({
  product: p,
  visualMode = "photo",
  actions,
}: {
  product: PublicProduct;
  visualMode?: "photo" | "text";
  actions?: ReactNode;
}) {
  const resolve = useMediaUrl();
  const src = resolve(p.thumbKey);
  const [failed, setFailed] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: foto baru = coba lagi
  useEffect(() => setFailed(false), [src]);
  // Mode "photo" (sebagian produk berfoto): SEMUA kartu punya slot 1:1 yang sama; produk tanpa foto (atau foto gagal)
  // mengisinya dengan ubin ilustrasi, jadi etalase tidak pincang saat booth mengunggah foto di tengah event.
  const slot = visualMode === "photo";
  const photo = slot && !!src && !failed;
  return (
    <article
      className={cn(
        "grid min-w-0 content-start gap-2 rounded-card border-(length:--border-w) border-line bg-surface-raised p-3",
        !slot && "grid-cols-[minmax(0,1fr)_auto] items-start",
      )}
    >
      {slot && (
        <div
          className="relative overflow-hidden rounded-card"
          data-product-visual=""
          style={{ aspectRatio: "1/1" }}
        >
          {photo ? (
            <SafeImage
              src={src}
              aspect="1/1"
              className="size-full rounded-card"
              onFail={() => setFailed(true)}
              fallback={null}
            />
          ) : (
            <div
              data-product-art=""
              className={cn(
                "grid size-full place-items-center rounded-card border-(length:--border-w) border-line",
                ART_TONES[hash32(p.id) % ART_TONES.length],
              )}
            >
              <FoodSticker seed={p.id} className="h-3/4 w-auto" />
            </div>
          )}
          <PriceTag
            priceIdr={p.priceIdr}
            compareIdr={p.comparePriceIdr}
            size="sticker"
            className="absolute bottom-2 left-2"
          />
        </div>
      )}
      <div className="grid gap-1">
        <Present when={p.badge}>
          <Badge tone={p.badge ? BADGE[p.badge] : "muted"}>
            {p.badge ? copy.visitor.badge[p.badge] : ""}
          </Badge>
        </Present>
        <h4 className="font-display font-extrabold leading-tight [overflow-wrap:anywhere]">
          {p.name}
        </h4>
        <Present when={p.description}>
          <p className="line-clamp-2 text-sm text-muted">{p.description}</p>
        </Present>
        <Present when={p.category}>
          <span className="text-xs text-muted">{p.category}</span>
        </Present>
        {actions}
      </div>
      {!slot && <PriceTag priceIdr={p.priceIdr} compareIdr={p.comparePriceIdr} size="sticker" />}
    </article>
  );
}

/** Etalase: satu keputusan mode untuk semua produk. Tanpa produk → tidak dirender sama sekali. */
export function ProductGrid({ products }: { products: readonly PublicProduct[] }) {
  if (products.length === 0) return null;
  const mode = productGridMode(products);
  return (
    <ul
      className={cn(
        "grid gap-3",
        mode === "photo" ? "grid-cols-2 md:grid-cols-3" : "grid-cols-1 sm:grid-cols-2",
      )}
      data-visual-mode={mode}
    >
      {products.map((p) => (
        <li key={p.id} className="grid min-w-0">
          <ProductCard product={p} visualMode={mode} />
        </li>
      ))}
    </ul>
  );
}

/** Produk andalan: blok oranye. Tanpa foto → hanya teks (stiker harga besar, tanpa polaroid). */
export function FeaturedProduct({
  product: p,
  actions,
}: {
  product: PublicProduct;
  actions?: ReactNode;
}) {
  const resolve = useMediaUrl();
  const src = resolve(p.fullKey);
  const [failed, setFailed] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: foto baru = coba lagi
  useEffect(() => setFailed(false), [src]);
  // Tanpa foto ATAU foto gagal dimuat → tata letak hanya-teks (tanpa kolom kosong).
  const hasPhoto = !!src && !failed;
  return (
    <section
      data-layout={hasPhoto ? "photo" : "text"}
      className={cn(
        "grid min-w-0 gap-4 rounded-card border-(length:--border-w) border-line bg-accent p-4 text-accent-fg shadow-card",
        hasPhoto && "sm:grid-cols-2",
      )}
    >
      {hasPhoto && (
        <div className="overflow-hidden rounded-card" style={{ aspectRatio: "1/1" }}>
          <SafeImage
            src={src}
            aspect="1/1"
            className="size-full rounded-card"
            onFail={() => setFailed(true)}
            fallback={null}
          />
        </div>
      )}
      <div className="grid min-w-0 content-center gap-2">
        <h3 className="font-display text-3xl font-extrabold leading-none [overflow-wrap:anywhere]">
          {p.name}
        </h3>
        <PriceTag
          priceIdr={p.priceIdr}
          compareIdr={p.comparePriceIdr}
          size="sticker"
          className="w-fit"
        />
        <Present when={p.description}>
          <p className="text-sm">{p.description}</p>
        </Present>
        {actions}
      </div>
    </section>
  );
}
