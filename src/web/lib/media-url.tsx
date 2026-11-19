// URL gambar selalu dibangun dari MEDIA_BASE_URL + kunci (explore.md B15), sehingga domain kustom R2
// (media.eventunimed.id) dan rute cadangan Worker (/media) bisa ditukar tanpa mengubah kode.
// Komponen tampilan murni tidak memanggil ini langsung: mereka memakai `useMediaUrl()`, sehingga galeri
// dan tes bisa memasok pemetaan sendiri (mis. gambar contoh tanpa server).
import { createContext, type ReactNode, useContext } from "react";

const BASE = (import.meta.env.VITE_MEDIA_BASE_URL ?? "/media").replace(/\/+$/, "");

export type MediaUrlResolver = (key: string | null | undefined) => string | null;

export const mediaUrl: MediaUrlResolver = (key) => (key ? `${BASE}/${key}` : null);

/** Kunci thumb dari kunci full (logo hanya menyimpan kunci full). */
export const thumbKeyOf = (fullKey: string) => fullKey.replace(/-full\.webp$/, "-thumb.webp");

const MediaUrlContext = createContext<MediaUrlResolver>(mediaUrl);

export function MediaUrlProvider({
  resolve,
  children,
}: {
  resolve: MediaUrlResolver;
  children: ReactNode;
}) {
  return <MediaUrlContext.Provider value={resolve}>{children}</MediaUrlContext.Provider>;
}

export const useMediaUrl = (): MediaUrlResolver => useContext(MediaUrlContext);
