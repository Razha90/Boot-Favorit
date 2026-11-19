import { Outlet } from "react-router";
import { useAreaTheme } from "../../lib/use-area-theme";

// Layar besar untuk proyektor: tanpa navigasi, tema gelap "panggung" (A8).
export function Component() {
  useAreaTheme("pro", "panggung");
  return (
    <div className="min-h-dvh">
      <Outlet />
    </div>
  );
}
