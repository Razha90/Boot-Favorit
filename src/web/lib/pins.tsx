// Booth sematan pengunjung (explore.md B28): disimpan HANYA di browser per event, tidak dikirim ke server, tidak
// mengubah urutan booth, peringkat, ataupun review (keadilan A8). Aksi lokal: tanpa ActionButton/Idempotency-Key.
import { CONFIG } from "@shared/config";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { storage as defaultStorage, type SafeStorage } from "./safe-storage";

export const pinsKey = (eventId: string) => `pins:${eventId}`;

export function readPins(store: SafeStorage, eventId: string): string[] {
  try {
    const raw = JSON.parse(store.get(pinsKey(eventId)) ?? "[]");
    if (!Array.isArray(raw)) return [];
    const out = [...new Set(raw.filter((x): x is string => typeof x === "string" && x !== ""))];
    return out.slice(0, CONFIG.booth.pinsMax);
  } catch {
    return []; // data rusak: mulai dari kosong, bukan galat
  }
}

export interface PinsApi {
  ids: readonly string[];
  count: number;
  has: (boothId: string) => boolean;
  /** false bila batas `pinsMax` tercapai */
  pin: (boothId: string) => boolean;
  unpin: (boothId: string) => void;
  /** Buang sematan yang booth-nya tidak tayang lagi (dicocokkan dengan snapshot terbaru). */
  prune: (validIds: ReadonlySet<string>) => void;
  clear: () => void;
}

const PinsContext = createContext<PinsApi | null>(null);

export function PinsProvider({
  eventId,
  children,
  store = defaultStorage,
}: {
  eventId: string;
  children: ReactNode;
  store?: SafeStorage;
}) {
  const [ids, setIds] = useState<string[]>(() => readPins(store, eventId));
  const commit = useCallback(
    (next: string[]) => {
      setIds(next);
      store.set(pinsKey(eventId), JSON.stringify(next));
    },
    [store, eventId],
  );
  const api = useMemo<PinsApi>(
    () => ({
      ids,
      count: ids.length,
      has: (id) => ids.includes(id),
      pin: (id) => {
        if (ids.includes(id)) return true;
        if (ids.length >= CONFIG.booth.pinsMax) return false;
        commit([...ids, id]);
        return true;
      },
      unpin: (id) => commit(ids.filter((x) => x !== id)),
      prune: (valid) => {
        const next = ids.filter((x) => valid.has(x));
        if (next.length !== ids.length) commit(next);
      },
      clear: () => commit([]),
    }),
    [ids, commit],
  );
  return <PinsContext.Provider value={api}>{children}</PinsContext.Provider>;
}

/** null di luar PinsProvider (mis. galeri/tes komponen): tombol sematkan tidak dirender. */
export const usePinsOptional = (): PinsApi | null => useContext(PinsContext);

export function usePins(): PinsApi {
  const ctx = useContext(PinsContext);
  if (!ctx) throw new Error("usePins harus dipakai di dalam PinsProvider");
  return ctx;
}
