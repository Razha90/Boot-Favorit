import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Outlet } from "react-router";
import { ErrorState, Skeleton } from "../../components/ui/states";
import { ToastProvider } from "../../components/ui/Toast";
import { EventStateProvider } from "../../lib/event-state";
import { useAreaTheme } from "../../lib/use-area-theme";
import { WishlistProvider } from "../../lib/wishlist";
import { ComingSoonScreen, SiteFooter } from "./components/chrome";
import { WishlistFab } from "./components/share-wishlist";
import { EventDataProvider, useEventData, useEventQuery, useSnapshotQuery } from "./data";

// Area event: halaman utama, halaman booth, hasil. Gaya "seru" (A12). TanStack Query hanya dimuat di area ini.
export function Component() {
  useAreaTheme("seru", "kertas");
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 5_000 } },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <EventShell />
    </QueryClientProvider>
  );
}

function EventShell() {
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
  if (!q.data.event) return <ComingSoonScreen />; // A0: belum ada event aktif / disembunyikan
  return (
    <EventDataProvider
      data={{ event: q.data.event, serverNow: q.data.serverNow }}
      fetchedAt={q.dataUpdatedAt}
    >
      <EventStateProvider schedule={q.data.event.schedule} serverNow={q.data.serverNow}>
        <ToastProvider>
          <WishlistProvider eventId={q.data.event.id}>
            <Page />
          </WishlistProvider>
        </ToastProvider>
      </EventStateProvider>
    </EventDataProvider>
  );
}

function Page() {
  const { event } = useEventData();
  const snapshot = useSnapshotQuery(event);
  // Judul tab = nama resmi acara (cadangan di sisi klien; Worker menyisipkan meta untuk pratinjau tautan).
  useEffect(() => {
    document.title = event.name;
  }, [event.name]);
  return (
    <div className="event-canvas min-h-dvh">
      <Outlet />
      <SiteFooter event={event} />
      <WishlistFab booths={snapshot.data?.booths ?? []} />
    </div>
  );
}
