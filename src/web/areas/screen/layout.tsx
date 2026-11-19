import { Outlet } from "react-router";
import { EventBoundary } from "../../features/EventBoundary";
import { SoundProvider } from "../../features/fx/SoundProvider";
import { copy } from "../../lib/copy";
import { useAreaTheme } from "../../lib/use-area-theme";

function Waiting() {
  return (
    <main className="grid min-h-dvh place-items-center p-8 text-center">
      <p className="text-4xl text-muted">{copy.screen.waiting}</p>
    </main>
  );
}

// Layar besar untuk proyektor: tanpa navigasi, tema gelap "panggung" (A8).
export function Component() {
  useAreaTheme("pro", "panggung");
  return (
    <SoundProvider>
      <EventBoundary comingSoon={<Waiting />}>
        <div className="min-h-dvh">
          <Outlet />
        </div>
      </EventBoundary>
    </SoundProvider>
  );
}
