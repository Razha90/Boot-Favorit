import { Outlet } from "react-router";
import { EventBoundary } from "../../features/EventBoundary";
import { SoundProvider } from "../../features/fx/SoundProvider";
import { copy } from "../../lib/copy";
import { useAreaTheme } from "../../lib/use-area-theme";

function Waiting() {
  return (
    <main className="screen-stage grid min-h-dvh place-items-center p-8 text-center">
      <div className="screen-panel-in grid gap-3 border-l-4 border-primary pl-6 text-left">
        <p className="font-display text-4xl font-extrabold text-text">{copy.screen.waiting}</p>
      </div>
    </main>
  );
}

// Layar besar untuk proyektor/monitor besar: tanpa navigasi, tema cerah "kertas" gaya seru UNIMED.
export function Component() {
  useAreaTheme("seru", "kertas");
  return (
    <SoundProvider>
      <EventBoundary comingSoon={<Waiting />}>
        <div className="screen-stage min-h-dvh">
          <Outlet />
        </div>
      </EventBoundary>
    </SoundProvider>
  );
}
