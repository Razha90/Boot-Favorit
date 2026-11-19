import { useEffect } from "react";
import { Outlet } from "react-router";
import { EventBoundary } from "../../features/EventBoundary";
import { useEventData, useSnapshotQuery } from "../../features/event-data";
import { useAreaTheme } from "../../lib/use-area-theme";
import { WishlistProvider } from "../../lib/wishlist";
import { ComingSoonScreen, SiteFooter } from "./components/chrome";
import { WishlistFab } from "./components/share-wishlist";

// Area event: halaman utama, halaman booth, hasil. Gaya "seru" (A12). TanStack Query hanya dimuat di area ini.
export function Component() {
  useAreaTheme("seru", "kertas");
  return (
    <EventBoundary
      comingSoon={<ComingSoonScreen />}
      wrap={(event, node) => <WishlistProvider eventId={event.id}>{node}</WishlistProvider>}
    >
      <Page />
    </EventBoundary>
  );
}

function Page() {
  const { event } = useEventData();
  const snapshot = useSnapshotQuery(event, { poll: false });
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
