import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, Outlet, useParams } from "react-router";
import { Icon } from "../../components/ui/Icon";
import { ToastProvider } from "../../components/ui/Toast";
import { copy } from "../../lib/copy";
import { useAreaTheme } from "../../lib/use-area-theme";
import { adminApi, adminKeys } from "./api";
import { EventWorkspace } from "./components/EventWorkspace";
import { dataApi, dataKeys } from "./data-api";

function AdminShell() {
  const { id: eventId } = useParams<{ id?: string }>();

  const eventQuery = useQuery({
    queryKey: adminKeys.event(eventId ?? ""),
    queryFn: () => adminApi.event(eventId ?? ""),
    enabled: Boolean(eventId),
  });
  const healthQuery = useQuery({
    queryKey: dataKeys.health(eventId ?? ""),
    queryFn: () => dataApi.health(eventId ?? ""),
    enabled: Boolean(eventId),
    refetchInterval: 20_000,
  });

  const event = eventQuery.data?.event;

  return (
    <div className="min-h-dvh">
      <header className="border-b-(length:--border-w) border-line bg-surface-raised print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <nav
            aria-label="Breadcrumb admin"
            className="flex min-w-0 flex-wrap items-center gap-2 text-sm"
          >
            <Link
              to="/admin"
              className="group inline-flex items-center gap-2 font-display text-lg font-extrabold text-text"
            >
              <span className="inline-flex size-7 items-center justify-center rounded-chip bg-primary-soft text-primary-strong">
                <Icon name="shield" className="size-4" />
              </span>
              <span>{copy.admin.title}</span>
            </Link>
            <span aria-hidden="true" className="text-muted">
              /
            </span>
            <Link to="/admin" className="font-semibold text-muted hover:text-text">
              {copy.admin.nav.events}
            </Link>
            {eventId && (
              <>
                <span aria-hidden="true" className="text-muted">
                  /
                </span>
                <Link
                  to={`/admin/e/${eventId}`}
                  className="max-w-[220px] truncate font-bold text-text hover:underline sm:max-w-xs"
                >
                  {event?.name ?? copy.admin.common.loading}
                </Link>
              </>
            )}
          </nav>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-1.5 rounded-chip border-(length:--border-w) border-line bg-surface px-3 py-1.5 text-xs font-bold text-text transition-colors hover:bg-surface-tint"
            >
              <Icon name="eye" className="size-3.5" />
              <span>{copy.admin.nav.openPublic}</span>
              <Icon name="external" className="size-3 text-muted" />
            </a>
            <a
              href="/screen"
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-1.5 rounded-chip border-(length:--border-w) border-line bg-surface px-3 py-1.5 text-xs font-bold text-text transition-colors hover:bg-surface-tint"
            >
              <Icon name="play" className="size-3.5" />
              <span>{copy.admin.nav.openScreen}</span>
              <Icon name="external" className="size-3 text-muted" />
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 print:max-w-none print:p-0">
        {eventId ? (
          <EventWorkspace eventId={eventId} event={event} health={healthQuery.data}>
            <Outlet />
          </EventWorkspace>
        ) : (
          <div className="grid gap-6">
            <Outlet />
          </div>
        )}
      </main>
    </div>
  );
}

/** Rangka panel admin: selalu bertema kertas + gaya profesional (explore.md A12). */
export function Component() {
  useAreaTheme("pro", "kertas");
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 10_000, retry: 1 } },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <AdminShell />
      </ToastProvider>
    </QueryClientProvider>
  );
}
