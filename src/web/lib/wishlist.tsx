// Daftar incaran tanpa akun (explore.md A14, B24): disimpan HANYA di browser, tidak dikirim ke server dan
// tidak berkaitan dengan akun atau review. Aksi lokal: tidak memakai ActionButton/Idempotency-Key (B21).
import { CONFIG } from "@shared/config";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { storage as defaultStorage, type SafeStorage } from "./safe-storage";

export interface WishlistEntry {
  boothId: string;
  productId: string;
}

export const wishlistKey = (eventId: string) => `wishlist:${eventId}`;
const entryKey = (e: WishlistEntry) => `${e.boothId}:${e.productId}`;

export function readWishlist(store: SafeStorage, eventId: string): WishlistEntry[] {
  try {
    const raw = JSON.parse(store.get(wishlistKey(eventId)) ?? "[]");
    if (!Array.isArray(raw)) return [];
    const seen = new Set<string>();
    const out: WishlistEntry[] = [];
    for (const x of raw) {
      if (typeof x?.boothId !== "string" || typeof x?.productId !== "string") continue;
      const k = entryKey(x);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ boothId: x.boothId, productId: x.productId });
    }
    return out.slice(0, CONFIG.booth.wishlistMax);
  } catch {
    return []; // data rusak: mulai dari kosong, bukan galat
  }
}

interface WishlistApi {
  entries: WishlistEntry[];
  count: number;
  has: (boothId: string, productId: string) => boolean;
  /** false bila batas `wishlistMax` tercapai */
  add: (boothId: string, productId: string) => boolean;
  remove: (boothId: string, productId: string) => void;
  /** Buang entri yang produknya sudah hilang/disembunyikan (dicocokkan saat panel dibuka). */
  prune: (valid: ReadonlySet<string>) => void;
  clear: () => void;
}

const WishlistContext = createContext<WishlistApi | null>(null);

export function WishlistProvider({
  eventId,
  children,
  store = defaultStorage,
}: {
  eventId: string;
  children: ReactNode;
  store?: SafeStorage;
}) {
  const [entries, setEntries] = useState<WishlistEntry[]>(() => readWishlist(store, eventId));

  const commit = useCallback(
    (next: WishlistEntry[]) => {
      setEntries(next);
      store.set(wishlistKey(eventId), JSON.stringify(next));
    },
    [store, eventId],
  );

  const api = useMemo<WishlistApi>(
    () => ({
      entries,
      count: entries.length,
      has: (b, p) => entries.some((e) => e.boothId === b && e.productId === p),
      add: (b, p) => {
        if (entries.some((e) => e.boothId === b && e.productId === p)) return true;
        if (entries.length >= CONFIG.booth.wishlistMax) return false;
        commit([...entries, { boothId: b, productId: p }]);
        return true;
      },
      remove: (b, p) => commit(entries.filter((e) => !(e.boothId === b && e.productId === p))),
      prune: (valid) => {
        const next = entries.filter((e) => valid.has(entryKey(e)));
        if (next.length !== entries.length) commit(next);
      },
      clear: () => commit([]),
    }),
    [entries, commit],
  );

  return <WishlistContext.Provider value={api}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistApi {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist harus dipakai di dalam WishlistProvider");
  return ctx;
}

/** Urutan natural nomor booth: A2 < A10 < B1; tanpa nomor di akhir (rute keliling, A14). */
export function compareBoothNo(a: string | null, b: string | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b, "id", { numeric: true, sensitivity: "base" });
}
