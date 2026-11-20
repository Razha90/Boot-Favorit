import type { PublicBooth, PublicProduct, PublicProducts } from "@shared/api-types";
import { DEFAULT_OG_PATH, foodArtFor, foodOgPath } from "@shared/food-art";
import { useQueries } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useId, useMemo, useState } from "react";
import { useLocation } from "react-router";
import { PriceTag } from "../../../components/shared/PriceTag";
import type { PosterContent } from "../../../components/shared/QrPoster";
import { SafeImage } from "../../../components/shared/SafeImage";
import { Button } from "../../../components/ui/Button";
import { Icon } from "../../../components/ui/Icon";
import { Modal } from "../../../components/ui/Modal";
import { Spinner } from "../../../components/ui/Spinner";
import { useToast } from "../../../components/ui/Toast";
import { eventKeys, useEventData } from "../../../features/event-data";
import { burstStars } from "../../../features/fx/ClickFx";
import { api } from "../../../lib/api";
import { cn } from "../../../lib/cn";
import { copy } from "../../../lib/copy";
import { useEventState } from "../../../lib/event-state";
import { formatRupiah } from "../../../lib/format";
import { useMediaUrl } from "../../../lib/media-url";
import { triggerSfx } from "../../../lib/sfx-bridge";
import {
  buildEventShareText,
  buildEventShareUrl,
  buildQrUrl,
  buildShareText,
  buildShareUrl,
  canNativeShare,
  emailShareLink,
  facebookShareLink,
  lineShareLink,
  telegramShareLink,
  threadsShareLink,
  whatsappShareLink,
  xShareLink,
} from "../../../lib/share";
import { compareBoothNo, useWishlist } from "../../../lib/wishlist";

// ---------- Bagikan ----------

const LazySharePoster = lazy(() => import("./SharePoster"));

type ChannelId = "wa" | "tg" | "th" | "x" | "fb" | "ln" | "em";

function ChannelIcon({ channel }: { channel: ChannelId }) {
  switch (channel) {
    case "wa":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4.5 fill-none stroke-current">
          <path
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.5 19.5 6 15.2a8 8 0 1 1 3.3 3.2z"
          />
          <path
            strokeWidth={1.9}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.6 9.3c.2-.5.5-.5.8-.5h.5c.2 0 .4.1.5.4l.7 1.6c.1.2.1.4-.1.6l-.5.6c.6 1 1.4 1.8 2.4 2.4l.6-.5c.2-.2.4-.2.6-.1l1.6.7c.3.1.4.3.4.5v.5c0 .3 0 .6-.5.8-.6.3-1.8.2-3.4-.6a8.8 8.8 0 0 1-3.8-3.8c-.8-1.6-.9-2.8-.6-3.4Z"
          />
        </svg>
      );
    case "tg":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4.5 fill-none stroke-current">
          <path
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 4.5 3.8 11.3c-.9.4-.9 1.6.1 1.9l4.2 1.3 1.7 5c.3.8 1.3.9 1.8.3l2.4-2.8 4.2 3.1c.7.5 1.7.1 1.9-.7L22 5.7c.2-.9-.2-1.5-1-1.2Z"
          />
          <path strokeWidth={1.8} strokeLinecap="round" d="m8.2 14.5 9.8-6.4" />
        </svg>
      );
    case "th":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4.5 fill-none stroke-current">
          <path
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M18.6 9.2A7 7 0 0 0 5.4 12a7 7 0 0 0 12.1 4.8M14.7 12.1c.1-1.7-.9-2.9-2.6-2.9-1.4 0-2.5.8-2.7 1.9m5.3 1c-.1 1.9-1.3 3.1-3.1 3.1-1.3 0-2.3-.7-2.3-1.8 0-1.2 1.1-1.9 2.9-1.9 1.6 0 3 .7 3.7 2 .5-2.6-.1-5.1-2-6.2"
          />
        </svg>
      );
    case "x":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4.5 fill-none stroke-current">
          <path
            strokeWidth={2.1}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.5 4.5 10.7 13l-6.2 6.5h2.2l5-5.2 4 5.2h3.8L13 10.6l5.8-6.1h-2.2l-4.7 4.9-3.6-4.9z"
          />
        </svg>
      );
    case "fb":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4.5 fill-none stroke-current">
          <path
            strokeWidth={2.1}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.5 20.5v-7h2.4l.5-3h-2.9V8.6c0-.9.4-1.6 1.7-1.6h1.3V4.3c-.6-.1-1.4-.2-2.1-.2-2.3 0-3.9 1.4-3.9 4v2.4H9v3h2.5v7z"
          />
        </svg>
      );
    case "ln":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4.5 fill-none stroke-current">
          <path
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20 11.2c0-3.7-3.6-6.7-8-6.7s-8 3-8 6.7c0 3.3 2.9 6.1 6.8 6.6.3.1.6.3.6.7l-.1 1.7c0 .4.4.7.8.5 3.9-2.2 7.9-5.7 7.9-9.5Z"
          />
          <path strokeWidth={1.8} strokeLinecap="round" d="M8.5 11.2h7M12 9.4v3.6" />
        </svg>
      );
    case "em":
      return <Icon name="mail" className="size-4.5" />;
  }
}

/**
 * Panel bagikan: pratinjau kartu tautan (gambar + judul + teks), bilah salin cepat, kisi 4x2 platform + kode QR,
 * dan Web Share API. Esc menutup. Tanpa `boothId` yang dibagikan adalah beranda event.
 * `previewKey` = foto sampul booth (kartu pratinjau memakai ilustrasi bila kosong, sama seperti hasil di WhatsApp).
 */
export function ShareButton({
  boothId,
  boothName,
  productId,
  productName,
  previewKey,
  poster,
  label,
  size = "sm",
}: {
  boothId?: string;
  boothName?: string;
  productId?: string;
  productName?: string;
  previewKey?: string | null;
  /** Data poster QR booth (nomor, institusi, tagline); kosong = hanya nama */
  poster?: { boothNo: string | null; teamName: string | null; tagline: string | null };
  label?: string;
  size?: "sm" | "md";
}) {
  const { event } = useEventData();
  const resolve = useMediaUrl();
  const toast = useToast();
  const linkInputId = useId();
  const [open, setOpen] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const S0 = copy.event.share;
  const [copiedKey, setCopiedKey] = useState<"url" | "caption" | null>(null);
  const url = boothId
    ? buildShareUrl({ origin: window.location.origin, boothId, productId })
    : buildEventShareUrl(window.location.origin);
  const origin = window.location.origin;
  const posterContent: PosterContent = boothId
    ? {
        kind: "booth",
        eventName: event.name,
        title: productName ?? boothName ?? "",
        badge: poster?.boothNo ? copy.admin.posters.boothNo(poster.boothNo) : null,
        teamName: poster?.teamName ?? null,
        tagline: productName ? boothName : (poster?.tagline ?? null),
        url: buildQrUrl({ origin, boothId, productId }),
        displayUrl: hostOf(origin),
        qrLabel: S0.qrLabel,
        seed: boothId,
      }
    : {
        kind: "event",
        eventName: event.name,
        title: copy.admin.posters.eventTitle,
        tagline: copy.event.hero.greeting,
        url: `${origin}/`,
        displayUrl: hostOf(origin),
        qrLabel: S0.qrLabel,
        seed: event.id,
      };
  const text = boothName
    ? buildShareText({ eventName: event.name, boothName, productName })
    : buildEventShareText(event.name);
  const previewSrc = boothId
    ? (resolve(previewKey ?? null) ?? foodOgPath(foodArtFor(boothId)))
    : (resolve(event.media.ogImageKey) ?? DEFAULT_OG_PATH);

  useEffect(() => {
    if (!copiedKey) return;
    const timer = window.setTimeout(() => setCopiedKey(null), 1800);
    return () => window.clearTimeout(timer);
  }, [copiedKey]);

  function closeModal() {
    setOpen(false);
    setShowQr(false);
    setCopiedKey(null);
  }

  async function copyValue(
    key: "url" | "caption",
    value: string,
    successText: string,
    anchor?: HTMLElement | null,
  ) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      triggerSfx("pop");
      if (anchor) burstStars(anchor);
      toast.push(successText, "success");
    } catch {
      toast.push(copy.event.share.copyFailed, "danger");
    }
  }

  const S = copy.event.share;
  const targetTitle = boothName
    ? productName
      ? `${productName} · ${boothName}`
      : boothName
    : event.name;
  const channels: ReadonlyArray<{
    key: ChannelId;
    label: string;
    href: string;
    badgeTone: string;
  }> = [
    {
      key: "wa",
      label: S.whatsapp,
      href: whatsappShareLink(text, url),
      badgeTone: "bg-sticker-4 text-primary-fg",
    },
    {
      key: "tg",
      label: S.telegram,
      href: telegramShareLink(text, url),
      badgeTone: "bg-sticker-3 text-primary-fg",
    },
    {
      key: "th",
      label: S.threads,
      href: threadsShareLink(text, url),
      badgeTone: "bg-surface-raised text-text",
    },
    {
      key: "x",
      label: S.x,
      href: xShareLink(text, url),
      badgeTone: "bg-surface-raised text-text",
    },
    {
      key: "fb",
      label: S.facebook,
      href: facebookShareLink(url),
      badgeTone: "bg-sticker-3 text-primary-fg",
    },
    {
      key: "ln",
      label: S.line,
      href: lineShareLink(text, url),
      badgeTone: "bg-sticker-5 text-primary-fg",
    },
    {
      key: "em",
      label: S.email,
      href: emailShareLink(boothName ?? event.name, text, url),
      badgeTone: "bg-sticker-1 text-text",
    },
  ];

  return (
    <>
      <Button
        size={size}
        icon="share"
        aria-label={label === "" ? S.button : undefined}
        onClick={() => setOpen(true)}
      >
        {label ?? S.button}
      </Button>
      {open && (
        <Modal open={open} onClose={closeModal} title={S.title}>
          <div className="grid overflow-hidden rounded-card border-(length:--border-w) border-line bg-surface-tint">
            <SafeImage
              src={previewSrc}
              aspect="1200/630"
              className="w-full border-b-(length:--border-w) border-line"
              fallback={null}
            />
            <div className="grid gap-1 px-3.5 py-2.5">
              <p className="truncate text-sm font-extrabold text-text">{targetTitle}</p>
              <p className="line-clamp-2 text-xs leading-relaxed text-muted">{text}</p>
            </div>
          </div>

          <div className="grid gap-1.5">
            <label
              htmlFor={linkInputId}
              className="text-xs font-extrabold uppercase tracking-wide text-muted"
            >
              {S.link}
            </label>
            <div className="flex items-center gap-1.5 rounded-card border-(length:--border-w) border-line bg-surface-raised p-1.5 pl-3">
              <input
                id={linkInputId}
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 bg-transparent text-xs font-medium text-text outline-none"
              />
              <Button
                size="sm"
                variant="primary"
                icon={copiedKey === "url" ? "check" : "copy"}
                aria-label={S.copy}
                onClick={(e) => copyValue("url", url, S.copied, e.currentTarget)}
              >
                {S.copy}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              icon={copiedKey === "caption" ? "check" : "copy"}
              onClick={(e) =>
                copyValue("caption", `${text}\n${url}`, S.copiedCaption, e.currentTarget)
              }
            >
              {S.copyCaption}
            </Button>
            {canNativeShare() && (
              <Button
                size="sm"
                icon="share"
                onClick={() => {
                  void navigator.share({ title: event.name, text, url }).catch(() => {});
                }}
              >
                {S.native}
              </Button>
            )}
          </div>

          <div className="grid gap-2">
            <p className="text-xs font-extrabold uppercase tracking-wide text-muted">
              {S.channelsLabel}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {channels.map((ch) => (
                <a
                  key={ch.key}
                  href={ch.href}
                  target={ch.key === "em" ? undefined : "_blank"}
                  rel={ch.key === "em" ? undefined : "noopener noreferrer"}
                  className="group flex flex-col items-center justify-center gap-1.5 rounded-card border-(length:--border-w) border-line bg-surface px-2 py-2.5 text-center text-xs font-bold text-text transition-colors hover:bg-surface-tint"
                >
                  <span
                    className={cn(
                      "grid size-9 place-items-center rounded-chip border-(length:--border-w) border-line transition-transform group-hover:-translate-y-0.5",
                      ch.badgeTone,
                    )}
                  >
                    <ChannelIcon channel={ch.key} />
                  </span>
                  <span className="truncate">{ch.label}</span>
                </a>
              ))}
              <button
                type="button"
                aria-pressed={showQr}
                onClick={() => setShowQr((v) => !v)}
                className={cn(
                  "group flex flex-col items-center justify-center gap-1.5 rounded-card border-(length:--border-w) border-line px-2 py-2.5 text-center text-xs font-bold transition-colors",
                  showQr
                    ? "bg-surface-tint text-text"
                    : "bg-surface text-text hover:bg-surface-tint",
                )}
              >
                <span
                  className={cn(
                    "grid size-9 place-items-center rounded-chip border-(length:--border-w) border-line transition-transform group-hover:-translate-y-0.5",
                    showQr ? "bg-primary text-primary-fg" : "bg-surface-tint text-text",
                  )}
                >
                  <Icon name="qr" className="size-4.5" />
                </span>
                <span className="truncate">{S.qrToggle}</span>
              </button>
            </div>
          </div>

          {showQr && (
            <Suspense
              fallback={
                <div className="grid h-40 place-items-center">
                  <Spinner />
                </div>
              }
            >
              <LazySharePoster content={posterContent} />
            </Suspense>
          )}

          <div className="flex justify-end border-t border-line pt-2">
            <Button size="sm" onClick={closeModal}>
              {S.close}
            </Button>
          </div>
        </Modal>
      )}
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
      data-sfx-custom=""
      aria-pressed={saved}
      onClick={(e) => {
        if (saved) {
          wl.remove(boothId, productId);
          triggerSfx("toggle", false);
        } else if (!wl.add(boothId, productId)) {
          triggerSfx("no");
          toast.push(copy.event.wishlist.full, "danger");
        } else {
          triggerSfx("toggle", true);
          burstStars(e.currentTarget);
        }
      }}
      className={cn(
        "group inline-flex w-fit items-center gap-1.5 rounded-chip border-(length:--border-w) border-line px-3 py-1 text-xs font-bold transition-transform hover:-translate-y-0.5 active:scale-95",
        saved ? "bg-primary text-primary-fg" : "bg-surface-raised",
      )}
    >
      <Icon name={saved ? "bookmark-check" : "bookmark"} className="size-3.5" />
      {saved ? copy.event.wishlist.saved : copy.event.wishlist.save}
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
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  if (state.frozen || wl.count === 0) return null;
  const isBoothPage = pathname.startsWith("/b/");
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group fixed right-4 z-40 inline-flex items-center gap-2 rounded-chip border-(length:--border-w) border-line bg-accent px-4 py-2 text-sm font-bold text-accent-fg shadow-card transition-transform hover:-translate-y-0.5 active:translate-y-px active:shadow-press",
          isBoothPage ? "bottom-34 md:bottom-18" : "bottom-18",
        )}
      >
        <Icon name="bookmark-check" className="size-4" />
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

const hostOf = (origin: string) => new URL(origin).host.replace(/^www\./, "");
