import type { PublicBooth, PublicProduct, PublicProducts } from "@shared/api-types";
import { useQueries } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { PriceTag } from "../../../components/shared/PriceTag";
import { SafeImage } from "../../../components/shared/SafeImage";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { useToast } from "../../../components/ui/Toast";
import { api } from "../../../lib/api";
import { cn } from "../../../lib/cn";
import { copy } from "../../../lib/copy";
import { useEventState } from "../../../lib/event-state";
import { formatRupiah } from "../../../lib/format";
import { useMediaUrl } from "../../../lib/media-url";
import {
  buildShareText,
  buildShareUrl,
  canNativeShare,
  whatsappShareLink,
} from "../../../lib/share";
import { compareBoothNo, useWishlist } from "../../../lib/wishlist";
import { eventKeys, useEventData } from "../data";

// ---------- Bagikan ----------

/** Panel bagikan: salin tautan, WhatsApp (tanpa nomor), dan Web Share API bila ada. Esc menutup. */
export function ShareButton({
  boothId,
  boothName,
  productId,
  productName,
  label,
  size = "sm",
}: {
  boothId: string;
  boothName: string;
  productId?: string;
  productName?: string;
  label?: string;
  size?: "sm" | "md";
}) {
  const { event } = useEventData();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const url = buildShareUrl({ origin: window.location.origin, boothId, productId });
  const text = buildShareText({ eventName: event.name, boothName, productName });

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      toast.push(copy.event.share.copied, "success");
    } catch {
      toast.push(copy.event.share.copyFailed, "danger");
    }
  }

  return (
    <>
      <Button size={size} onClick={() => setOpen(true)}>
        {label ?? copy.event.share.button}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={copy.event.share.title}>
        <label className="grid gap-1 text-sm font-bold">
          {copy.event.share.link}
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded-card border-(length:--border-w) border-line bg-surface-raised px-3 py-2 text-xs font-normal"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={copyLink}>
            {copy.event.share.copy}
          </Button>
          <a
            href={whatsappShareLink(text, url)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-chip border-(length:--border-w) border-line bg-sticker-4 px-4 py-2 text-sm font-bold text-primary-fg"
          >
            {copy.event.share.whatsapp}
          </a>
          {canNativeShare() && (
            <Button
              onClick={() => {
                void navigator.share({ title: event.name, text, url }).catch(() => {});
              }}
            >
              {copy.event.share.native}
            </Button>
          )}
        </div>
        <div className="flex justify-end">
          <Button onClick={() => setOpen(false)}>{copy.event.share.close}</Button>
        </div>
      </Modal>
    </>
  );
}

// ---------- Daftar incaran ----------

/** Tombol "Simpan ke incaran". Tidak dirender setelah event selesai (A14). */
export function SaveButton({ boothId, productId }: { boothId: string; productId: string }) {
  const wl = useWishlist();
  const toast = useToast();
  const state = useEventState();
  if (state.frozen) return null;
  const saved = wl.has(boothId, productId);
  return (
    <button
      type="button"
      aria-pressed={saved}
      onClick={() => {
        if (saved) wl.remove(boothId, productId);
        else if (!wl.add(boothId, productId)) toast.push(copy.event.wishlist.full, "danger");
      }}
      className={cn(
        "w-fit rounded-chip border-(length:--border-w) border-line px-3 py-1 text-xs font-bold",
        saved ? "bg-primary text-primary-fg" : "bg-surface-raised",
      )}
    >
      {saved ? `✓ ${copy.event.wishlist.saved}` : copy.event.wishlist.save}
    </button>
  );
}

interface Line {
  booth: PublicBooth;
  products: PublicProduct[];
}

/**
 * Tombol melayang "Incaranku (n)" + panel. Produk dikelompokkan per booth menurut nomor booth (rute keliling),
 * ditambah perkiraan total. Dicocokkan dengan data terbaru saat dibuka: produk yang hilang atau disembunyikan
 * dibuang dari daftar. Tidak dirender setelah event selesai atau bila daftar kosong.
 */
export function WishlistFab({ booths }: { booths: readonly PublicBooth[] }) {
  const wl = useWishlist();
  const state = useEventState();
  const [open, setOpen] = useState(false);

  if (state.frozen || wl.count === 0) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 4.5rem)" }}
        className="fixed right-4 z-40 rounded-chip border-(length:--border-w) border-line bg-accent px-4 py-2 text-sm font-bold text-accent-fg shadow-card active:translate-y-px active:shadow-press"
      >
        {copy.event.wishlist.floating(wl.count)}
      </button>
      <WishlistPanel open={open} onClose={() => setOpen(false)} booths={booths} />
    </>
  );
}

function WishlistPanel({
  open,
  onClose,
  booths,
}: {
  open: boolean;
  onClose: () => void;
  booths: readonly PublicBooth[];
}) {
  const wl = useWishlist();
  const resolve = useMediaUrl();
  const boothIds = useMemo(() => [...new Set(wl.entries.map((e) => e.boothId))], [wl.entries]);

  const queries = useQueries({
    queries: boothIds.map((id) => ({
      queryKey: eventKeys.products(id),
      queryFn: () => api<PublicProducts>("GET", `/api/booths/${id}/products`),
      staleTime: 30_000,
      enabled: open,
    })),
  });
  const ready = open && queries.length > 0 && queries.every((q) => q.isSuccess || q.isError);

  // Buang yang sudah hilang: produk dihapus/disembunyikan atau booth tidak tayang lagi.
  const validKeys = useMemo(() => {
    const s = new Set<string>();
    boothIds.forEach((bid, i) => {
      for (const p of queries[i]?.data?.products ?? []) s.add(`${bid}:${p.id}`);
    });
    return s;
  }, [boothIds, queries]);
  useEffect(() => {
    if (ready && queries.every((q) => q.isSuccess)) wl.prune(validKeys);
  }, [ready, queries, validKeys, wl]);

  const lines: Line[] = boothIds
    .map((bid, i) => {
      const booth = booths.find((b) => b.id === bid);
      const all = queries[i]?.data?.products ?? [];
      const mine = wl.entries
        .filter((e) => e.boothId === bid)
        .map((e) => all.find((p) => p.id === e.productId));
      return booth ? { booth, products: mine.filter((p): p is PublicProduct => !!p) } : null;
    })
    .filter((l): l is Line => l !== null && l.products.length > 0)
    .sort((a, b) => compareBoothNo(a.booth.boothNo, b.booth.boothNo));
  const total = lines.reduce((sum, l) => sum + l.products.reduce((s, p) => s + p.priceIdr, 0), 0);

  return (
    <Modal open={open} onClose={onClose} title={copy.event.wishlist.title}>
      {!ready && wl.count > 0 && (
        <p className="text-sm text-muted">{copy.event.wishlist.loading}</p>
      )}
      {ready && lines.length === 0 && <p className="text-sm">{copy.event.wishlist.empty}</p>}
      <div className="grid max-h-[60dvh] gap-4 overflow-y-auto">
        {lines.map((l) => (
          <section key={l.booth.id} className="grid gap-2">
            <h3 className="font-display text-lg font-extrabold">
              {l.booth.boothNo ? `${l.booth.boothNo} · ` : ""}
              {l.booth.name}
              {!l.booth.boothNo && (
                <span className="ml-2 text-xs font-normal text-muted">
                  {copy.event.wishlist.noNumber}
                </span>
              )}
            </h3>
            <ul className="grid gap-2">
              {l.products.map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <SafeImage
                    src={resolve(p.thumbKey)}
                    aspect="1/1"
                    className="size-10 rounded"
                    fallback={null}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{p.name}</span>
                  <PriceTag priceIdr={p.priceIdr} size="short" />
                  <button
                    type="button"
                    onClick={() => wl.remove(l.booth.id, p.id)}
                    className="text-xs underline"
                  >
                    {copy.event.wishlist.remove}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {lines.length > 0 && (
        <p className="text-sm">
          <b>
            {copy.event.wishlist.total}: {formatRupiah(total)}
          </b>
          <br />
          <span className="text-muted">{copy.event.wishlist.note}</span>
        </p>
      )}
      <div className="flex justify-between gap-2">
        <Button onClick={() => wl.clear()} disabled={wl.count === 0}>
          {copy.event.wishlist.clear}
        </Button>
        <Button variant="primary" onClick={onClose}>
          {copy.event.share.close}
        </Button>
      </div>
    </Modal>
  );
}
