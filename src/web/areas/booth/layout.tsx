import { Outlet } from "react-router";
import { useAreaTheme } from "../../lib/use-area-theme";

// Area portal pemilik booth: pendaftaran, login, portal. Gaya "pro" (A12).
export function Component() {
  useAreaTheme("pro", "kertas");
  return (
    <div className="min-h-dvh">
      <Outlet />
    </div>
  );
}
