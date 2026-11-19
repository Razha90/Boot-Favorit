import type { PublicEvent } from "@shared/api-types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { HomeInitialSkeleton, SkeletonCrossfade } from "../components/shared/PageSkeletons";
import { ErrorState } from "../components/ui/states";
import { ToastProvider } from "../components/ui/Toast";
import { EventStateProvider } from "../lib/event-state";
import { EventDataProvider, useEventQuery } from "./event-data";
import { RevealSessionProvider } from "./reveal/use-reveal";

const GateSkeletonContext = createContext(false);

/** True bila gerbang awal sempat menampilkan skeleton (jaringan > 110 ms), agar halaman beranda lanjut tanpa jeda. */
export const useGateSkeletonShown = () => useContext(GateSkeletonContext);

function Gate({
  children,
  comingSoon,
  wrap,
}: {
  children: ReactNode;
  comingSoon: ReactNode;
  wrap?: (event: PublicEvent, node: ReactNode) => ReactNode;
}) {
  const q = useEventQuery();
  const [gateShown, setGateShown] = useState(false);
  useEffect(() => {
    if (!q.isLoading) return;
    const id = window.setTimeout(() => {
      setGateShown(true);
    }, 110);
    return () => window.clearTimeout(id);
  }, [q.isLoading]);

  let content: ReactNode = null;
  if (!q.isLoading) {
    if (q.error || !q.data) {
      content = <ErrorState onRetry={() => void q.refetch()} />;
    } else if (!q.data.event) {
      content = <>{comingSoon}</>; // A0: belum ada event aktif / disembunyikan
    } else {
      const event = q.data.event;
      const inner = (
        <ToastProvider>
          <RevealSessionProvider>{wrap ? wrap(event, children) : children}</RevealSessionProvider>
        </ToastProvider>
      );
      content = (
        <GateSkeletonContext.Provider value={gateShown}>
          <EventDataProvider
            data={{ event, serverNow: q.data.serverNow }}
            fetchedAt={q.dataUpdatedAt}
          >
            <EventStateProvider schedule={event.schedule} serverNow={q.data.serverNow}>
              {inner}
            </EventStateProvider>
          </EventDataProvider>
        </GateSkeletonContext.Provider>
      );
    }
  }

  return (
    <SkeletonCrossfade loading={q.isLoading} skeleton={<HomeInitialSkeleton />}>
      {content}
    </SkeletonCrossfade>
  );
}

/**
 * Pagar data event bersama area `event` dan `screen` (antar-area dilarang saling impor, B16): QueryClient, event aktif,
 * jam server, status event, toast. `wrap` menambah penyedia khusus area (mis. daftar incaran).
 */
export function EventBoundary(props: {
  children: ReactNode;
  comingSoon: ReactNode;
  wrap?: (event: PublicEvent, node: ReactNode) => ReactNode;
}) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 5_000 } },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <Gate {...props} />
    </QueryClientProvider>
  );
}
