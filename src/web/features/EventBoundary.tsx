import type { PublicEvent } from "@shared/api-types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { ErrorState, Skeleton } from "../components/ui/states";
import { ToastProvider } from "../components/ui/Toast";
import { EventStateProvider } from "../lib/event-state";
import { EventDataProvider, useEventQuery } from "./event-data";
import { RevealSessionProvider } from "./reveal/use-reveal";

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
  if (q.isLoading) {
    return (
      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-10" aria-busy="true">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-2/3" />
      </div>
    );
  }
  if (q.error || !q.data) return <ErrorState onRetry={() => void q.refetch()} />;
  const event = q.data.event;
  if (!event) return <>{comingSoon}</>; // A0: belum ada event aktif / disembunyikan
  const inner = (
    <ToastProvider>
      <RevealSessionProvider>{wrap ? wrap(event, children) : children}</RevealSessionProvider>
    </ToastProvider>
  );
  return (
    <EventDataProvider data={{ event, serverNow: q.data.serverNow }} fetchedAt={q.dataUpdatedAt}>
      <EventStateProvider schedule={event.schedule} serverNow={q.data.serverNow}>
        {inner}
      </EventStateProvider>
    </EventDataProvider>
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
