import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Link, Outlet } from "react-router";
import { copy } from "../../lib/copy";
import { useAreaTheme } from "../../lib/use-area-theme";

// Area admin: dilindungi Cloudflare Access di sisi server (B7); chunk ini tidak pernah diunduh pengunjung.
// QueryClient dibuat di sini (bukan di bundle awal) karena hanya area admin yang memakainya.
export function Component() {
  useAreaTheme("pro", "kertas");
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, refetchOnWindowFocus: false, staleTime: 5_000 },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <div className="min-h-dvh">
        <header className="border-b-(length:--border-w) border-line bg-surface-raised">
          <nav className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
            <Link to="/admin" className="font-display text-lg font-extrabold">
              {copy.admin.title}
            </Link>
            <Link to="/admin" className="text-sm text-muted hover:text-text">
              {copy.admin.nav.events}
            </Link>
          </nav>
        </header>
        <main className="mx-auto grid max-w-5xl gap-4 px-4 py-6">
          <Outlet />
        </main>
      </div>
    </QueryClientProvider>
  );
}
