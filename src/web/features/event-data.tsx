// Lapisan data area event: event aktif, snapshot, detail booth, produk. TanStack Query hanya dimuat di area ini
// (bukan bundle awal). Polling berjitter ±20% supaya klien tidak serentak (explore.md B8); berhenti saat tab
// tersembunyi (bawaan Query) dan lebih jarang setelah event selesai.
import type {
  PublicBoothDetail,
  PublicEvent,
  PublicEventResponse,
  PublicProducts,
  PublicResults,
  PublicSnapshot,
} from "@shared/api-types";
import { CONFIG } from "@shared/config";
import { getEventState } from "@shared/event-state";
import { useQuery } from "@tanstack/react-query";
import { createContext, type ReactNode, useCallback, useContext, useMemo } from "react";
import { api } from "../lib/api";
import { useEventState } from "../lib/event-state";
import { useLiveStatus } from "./live/live-context";

/** Interval polling dengan jitter; `ended` = data beku, polling jarang. */
export function pollInterval(ended: boolean, random: () => number = Math.random): number {
  const base = ended ? CONFIG.live.snapshotTtlSecAfterEnd * 1000 : CONFIG.live.pollIntervalMs;
  const jitter = (random() * 2 - 1) * CONFIG.live.pollJitterRatio;
  return Math.round(base * (1 + jitter));
}

export const eventKeys = {
  event: ["public", "event"] as const,
  snapshot: (eventId: string, active: number) => ["public", "snapshot", eventId, active] as const,
  booth: (id: string) => ["public", "booth", id] as const,
  products: (id: string) => ["public", "products", id] as const,
};

const isEnded = (data: PublicEventResponse | undefined) =>
  !!data?.event && getEventState(data.event.schedule, data.serverNow).frozen;

export function useEventQuery() {
  return useQuery({
    queryKey: eventKeys.event,
    queryFn: () => api<PublicEventResponse>("GET", "/api/event"),
    refetchInterval: (q) => pollInterval(isEnded(q.state.data)),
  });
}

/**
 * `live` = WebSocket tersambung: polling berhenti (siaran + `refresh` yang menggantikannya).
 * `frozen` = event selesai: data beku, polling jarang (B8).
 */
export function useSnapshotQuery(event: PublicEvent | null, o: { poll?: boolean } = {}) {
  const live = useLiveStatus().connected;
  const frozen = useEventState().frozen;
  return useQuery({
    queryKey: eventKeys.snapshot(event?.id ?? "-", event?.versions.active ?? 0),
    queryFn: () => api<PublicSnapshot>("GET", "/api/snapshot"),
    enabled: !!event,
    // `poll: false` = hanya membaca data (mis. tombol incaran); yang memutuskan polling adalah halaman yang tampil.
    refetchInterval: o.poll === false || live ? false : pollInterval(frozen),
  });
}

/** Hasil akhir yang dibekukan; kunci memuat versi hasil sehingga "Perbarui hasil" langsung terlihat. */
export function useResultsQuery(event: PublicEvent | null, enabled: boolean, version: number) {
  return useQuery({
    queryKey: ["public", "results", event?.id ?? "-", version] as const,
    queryFn: () => api<PublicResults>("GET", "/api/results"),
    enabled: !!event && enabled,
    staleTime: 60_000,
  });
}

export const useBoothQuery = (id: string) =>
  useQuery({
    queryKey: eventKeys.booth(id),
    queryFn: () => api<{ booth: PublicBoothDetail }>("GET", `/api/booths/${id}`),
    staleTime: 30_000,
  });

export const useProductsQuery = (id: string) =>
  useQuery({
    queryKey: eventKeys.products(id),
    queryFn: () => api<PublicProducts>("GET", `/api/booths/${id}/products`),
    staleTime: 30_000,
  });

// ---------- Konteks event + jam server ----------

interface EventData {
  event: PublicEvent;
  /** Waktu server sekarang (ms): Date.now() + offset, sehingga jam HP yang salah tidak berpengaruh (B17) */
  serverNow: () => number;
  serverNowAtFetch: number;
}
const EventDataContext = createContext<EventData | null>(null);

export function EventDataProvider({
  data,
  fetchedAt,
  children,
}: {
  data: { event: PublicEvent; serverNow: number };
  /** Waktu lokal saat data diterima (`dataUpdatedAt`) */
  fetchedAt: number;
  children: ReactNode;
}) {
  // serverNow adalah waktu server tepat saat balasan dibuat ≈ saat diterima: offset = server − lokal.
  const offset = useMemo(() => data.serverNow - fetchedAt, [data.serverNow, fetchedAt]);
  const serverNow = useCallback(() => Date.now() + offset, [offset]);
  const value = useMemo(
    () => ({ event: data.event, serverNow, serverNowAtFetch: data.serverNow }),
    [data.event, data.serverNow, serverNow],
  );
  return <EventDataContext.Provider value={value}>{children}</EventDataContext.Provider>;
}

export function useEventData(): EventData {
  const ctx = useContext(EventDataContext);
  if (!ctx) throw new Error("useEventData harus dipakai di dalam EventDataProvider");
  return ctx;
}
