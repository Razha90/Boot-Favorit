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

export const canNativeShare = (
  nav: Pick<Navigator, "share"> | undefined = typeof navigator === "undefined"
    ? undefined
    : navigator,
) => typeof nav?.share === "function";
