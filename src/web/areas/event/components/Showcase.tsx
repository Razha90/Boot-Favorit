import type { PublicProduct } from "@shared/api-types";
import { CONFIG } from "@shared/config";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { ProductCard, productGridMode } from "../../../components/shared/ProductCard";
import { Icon } from "../../../components/ui/Icon";
import { cn } from "../../../lib/cn";
import { copy } from "../../../lib/copy";

/**
 * Etalase produk (explore.md A14): 6 dulu lalu "Tampilkan lebih banyak"; chip kategori hanya bila produk lebih
 * dari 8; mode foto/hanya-teks diputuskan untuk SELURUH etalase. `highlightId` (dari ?p=) membuka halaman yang
 * memuat produk itu, menggulir ke sana, dan menyorotnya sebentar. Tanpa produk → tidak dirender (judul ikut hilang).
 */
export function Showcase({
  products,
  highlightId,
  actions,
}: {
  products: readonly PublicProduct[];
  highlightId?: string | null;
  actions?: (p: PublicProduct) => ReactNode;
}) {
  const page = CONFIG.booth.productPageSize;
  const [category, setCategory] = useState<string | null>(null);
  const [shown, setShown] = useState<number>(page);
  const [flash, setFlash] = useState<string | null>(null);
  const targetRef = useRef<HTMLLIElement | null>(null);

  // Kategori dikelompokkan tanpa membedakan huruf besar-kecil; label memakai penulisan pertama pemilik.
  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) {
      const label = p.category?.trim();
      if (label && !map.has(label.toLowerCase())) map.set(label.toLowerCase(), label);
    }
    return [...map.entries()];
  }, [products]);
  const showChips =
    products.length > CONFIG.booth.productFilterMinProducts && categories.length > 1;

  const filtered = category
    ? products.filter((p) => p.category?.trim().toLowerCase() === category)
    : products;
  const mode = productGridMode(products); // keputusan untuk seluruh etalase, bukan untuk halaman ini saja

  // Tautan produk: buka halaman yang memuatnya, lalu gulir dan sorot.
  useEffect(() => {
    if (!highlightId) return;
    const idx = products.findIndex((p) => p.id === highlightId);
    if (idx < 0) return;
    setCategory(null);
    setShown((s) => Math.max(s, Math.ceil((idx + 1) / page) * page));
    setFlash(highlightId);
    const t = setTimeout(() => setFlash(null), 2500);
    return () => clearTimeout(t);
  }, [highlightId, products, page]);

  useEffect(() => {
    if (flash && targetRef.current)
      targetRef.current.scrollIntoView?.({ block: "center", behavior: "smooth" });
  }, [flash]);

  if (products.length === 0) return null;
  const visible = filtered.slice(0, shown);
  const remaining = filtered.length - visible.length;

  return (
    <div className="grid gap-3">
      {showChips && (
        <fieldset className="m-0 flex min-w-0 flex-wrap gap-2 border-0 p-0">
          <legend className="sr-only">{copy.event.booth.showcase}</legend>
          {[[null, copy.event.booth.allCategories] as const, ...categories].map(([key, label]) => (
            <button
              key={key ?? "semua"}
              type="button"
              aria-pressed={category === key}
              onClick={() => {
                setCategory(key);
                setShown(page); // mengganti kategori mengembalikan ke 6 pertama
              }}
              className={cn(
                "group inline-flex items-center gap-1.5 rounded-chip border-(length:--border-w) border-line px-3 py-1 text-sm font-bold transition-transform hover:-translate-y-0.5 active:scale-95",
                category === key ? "bg-primary text-primary-fg" : "bg-surface-raised",
              )}
            >
              <Icon name={category === key ? "check" : "sparkles"} className="size-3.5" />
              {label}
            </button>
          ))}
        </fieldset>
      )}

      <ul
        data-visual-mode={mode}
        className={cn(
          "grid gap-3",
          mode === "photo" ? "grid-cols-2 md:grid-cols-3" : "grid-cols-1 sm:grid-cols-2",
        )}
      >
        {visible.map((p) => (
          <li
            key={p.id}
            id={`produk-${p.id}`}
            ref={p.id === flash ? targetRef : undefined}
            className={cn(
              "grid rounded-card transition-shadow",
              p.id === flash && "ring-4 ring-accent",
            )}
          >
            <ProductCard product={p} visualMode={mode} actions={actions?.(p)} />
          </li>
        ))}
      </ul>

      <p aria-live="polite" className="text-sm text-muted">
        {copy.event.booth.showing(visible.length, filtered.length)}
      </p>
      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setShown((s) => s + page)}
          className="group inline-flex w-fit items-center gap-2 rounded-chip border-(length:--border-w) border-line bg-surface-raised px-5 py-2 text-sm font-bold shadow-card transition-transform hover:-translate-y-0.5 active:translate-y-px active:shadow-press"
        >
          <Icon name="arrow-down" className="size-4" />
          {copy.event.booth.more(Math.min(page, remaining))}
        </button>
      )}
    </div>
  );
}
