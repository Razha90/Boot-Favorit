import { useEffect } from "react";
import { Outlet } from "react-router";
import { ComingSoon } from "../../components/ui/ComingSoon";
import { EventBoundary } from "../../features/EventBoundary";
import { useEventData } from "../../features/event-data";
import { copy } from "../../lib/copy";
import { useAreaTheme } from "../../lib/use-area-theme";

// Area portal pemilik booth: pendaftaran mandiri dan portal. Gaya "pro" (A12). Data event + jam server dari pagar bersama.
export function Component() {
  useAreaTheme("pro", "kertas");
  return (
    <EventBoundary comingSoon={<ComingSoon title={copy.booth.title}>{null}</ComingSoon>}>
      <Shell />
    </EventBoundary>
  );
}

function Shell() {
  const { event } = useEventData();
  useEffect(() => {
    document.title = copy.booth.pageTitle(event.name);
  }, [event.name]);
  return (
    <div className="min-h-dvh">
      <header className="border-b-(length:--border-w) border-line bg-surface-raised">
        <div className="mx-auto grid max-w-3xl gap-0.5 px-4 py-3">
          <p className="text-sm text-muted">{copy.booth.title}</p>
          <p className="font-display text-lg font-extrabold [overflow-wrap:anywhere]">
            {event.name}
          </p>
        </div>
      </header>
      <main className="mx-auto grid max-w-3xl gap-4 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
