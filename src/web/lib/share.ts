// Tautan bagikan booth/produk (explore.md A14, B24). Teks bawaan TIDAK PERNAH meminta bintang atau ulasan.

export interface ShareTarget {
  origin: string;
  boothId: string;
  productId?: string | null;
}

/** /b/:id[?p=:produk]&src=share — `src=share` dihitung sebagai sinyal risiko bila ulasan melonjak (A6, B9). */
export function buildShareUrl({ origin, boothId, productId }: ShareTarget): string {
  const u = new URL(`/b/${encodeURIComponent(boothId)}`, origin);
  if (productId) u.searchParams.set("p", productId);
  u.searchParams.set("src", "share");
  return u.toString();
}

export function buildShareText(args: {
  eventName: string;
  boothName: string;
  productName?: string | null;
}): string {
  return args.productName
    ? `Lihat ${args.productName} di booth ${args.boothName}, ${args.eventName}`
    : `Mampir ke booth ${args.boothName} di ${args.eventName}`;
}

/** Tautan WhatsApp untuk MEMBAGIKAN (memilih kontak sendiri): bukan nomor pemilik booth. */
export const whatsappShareLink = (text: string, url: string) =>
  `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`;

export const telegramShareLink = (text: string, url: string) =>
  `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;

export const threadsShareLink = (text: string, url: string) =>
  `https://www.threads.net/intent/post?text=${encodeURIComponent(`${text}\n${url}`)}`;

export const xShareLink = (text: string, url: string) =>
  `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;

export const facebookShareLink = (url: string) =>
  `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;

export const lineShareLink = (text: string, url: string) =>
  `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;

export const emailShareLink = (subject: string, text: string, url: string) =>
  `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${text}\n\n${url}`)}`;

export const canNativeShare = (
  nav: Pick<Navigator, "share"> | undefined = typeof navigator === "undefined"
    ? undefined
    : navigator,
) => typeof nav?.share === "function";
