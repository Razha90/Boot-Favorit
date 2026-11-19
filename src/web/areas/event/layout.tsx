import { useEffect } from "react";
import { Outlet, useLocation } from "react-router";
import { EventBoundary } from "../../features/EventBoundary";
import { useEventData, useSnapshotQuery } from "../../features/event-data";
import { ClickFx } from "../../features/fx/ClickFx";
import { SoundProvider, SoundToggle } from "../../features/fx/SoundProvider";
import { PinsProvider } from "../../lib/pins";
import { useAreaTheme } from "../../lib/use-area-theme";
import { WishlistProvider } from "../../lib/wishlist";
import { BackToTop } from "./components/BackToTop";
import { ComingSoonScreen, SiteFooter } from "./components/chrome";
import { PinFab } from "./components/PinFab";
import { SideDecor } from "./components/SideDecor";
import { WishlistFab } from "./components/share-wishlist";

// Area event: halaman utama, halaman booth, hasil. Gaya "seru" (A12). TanStack Query hanya dimuat di area ini.
export function Component() {
  useAreaTheme("seru", "kertas");
  return (
    <EventBoundary
      comingSoon={<ComingSoonScreen />}
      wrap={(event, node) => (
        <WishlistProvider eventId={event.id}>
          <PinsProvider eventId={event.id}>{node}</PinsProvider>
        </WishlistProvider>
      )}
    >
      <Page />
    </EventBoundary>
  );
}

function Page() {
  const { event } = useEventData();
  const { pathname } = useLocation();
  const snapshot = useSnapshotQuery(event, { poll: false });
  // Judul tab = nama resmi acara saat di beranda/hasil (halaman booth mengisinya sendiri).
  useEffect(() => {
    if (!pathname.startsWith("/b/")) document.title = event.name;
  }, [event.name, pathname]);
  return (
    <SoundProvider>
      <ClickFx />
      <div className="event-canvas relative isolate min-h-dvh">
        <SideDecor seed={event.id} />
        <Outlet />
        <SiteFooter event={event} />
        <SoundToggle />
        <BackToTop />
        <PinFab
          booths={snapshot.data?.booths ?? []}
          ratingsHidden={snapshot.data?.ratingsHidden ?? false}
        />
        <WishlistFab booths={snapshot.data?.booths ?? []} />
      </div>
    </SoundProvider>
  );
}
