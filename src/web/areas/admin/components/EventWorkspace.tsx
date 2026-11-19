import type { AdminEventView, EventHealth } from "@shared/api-types";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { ActionButton } from "../../../components/ui/ActionButton";
import { Badge } from "../../../components/ui/Card";
import { Icon, type IconName } from "../../../components/ui/Icon";
import { cn } from "../../../lib/cn";
import { copy } from "../../../lib/copy";
import { adminApi, adminKeys } from "../api";
import { EventBadges } from "./bits";

interface NavItem {
  key: string;
  label: string;
  to: string;
  icon: IconName;
  match: (pathname: string, base: string) => boolean;
  badge?: number;
  badgeTone?: "accent" | "danger" | "primary";
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Kerangka ruang kerja satu event admin: satu sidebar/navigasi persisten di semua sub-halaman
 * (`/admin/e/:id*`) agar perpindahan antara Ringkasan, Booth, Moderasi, Poster QR, Data Grid, dan Log jelas.
 */
export function EventWorkspace({
  eventId,
  event,
  health,
  children,
}: {
  eventId: string;
  event: AdminEventView | undefined;
  health: EventHealth | undefined;
  children: ReactNode;
}) {
  const { pathname } = useLocation();
  const qc = useQueryClient();
  const base = `/admin/e/${eventId}`;

  const pendingBooths = health?.pendingBooths ?? 0;
  const modAttention = (health?.openReports ?? 0) + (health?.heldReviews ?? 0);
  const liveCount = (health?.liveViewers ?? 0) + (health?.liveScreens ?? 0);

  const N = copy.admin.nav;
  const groups: NavGroup[] = [
    {
      label: N.groups.overview,
      items: [
        {
          key: "overview",
          label: N.items.overview,
          to: base,
          icon: "trophy",
          match: (p, b) => p === b || p === `${b}/`,
        },
      ],
    },
    {
      label: N.groups.operations,
      items: [
        {
          key: "booths",
          label: N.items.booths,
          to: `${base}/booths`,
          icon: "store",
          match: (p, b) => p.startsWith(`${b}/booths`),
          badge: pendingBooths > 0 ? pendingBooths : undefined,
          badgeTone: "accent",
        },
        {
          key: "moderation",
          label: N.items.moderation,
          to: `${base}/moderation`,
          icon: "shield",
          match: (p, b) => p.startsWith(`${b}/moderation`),
          badge: modAttention > 0 ? modAttention : undefined,
          badgeTone: "danger",
        },
        {
          key: "posters",
          label: N.items.posters,
          to: `${base}/posters`,
          icon: "qr",
          match: (p, b) => p.startsWith(`${b}/posters`),
        },
      ],
    },
    {
      label: N.groups.data,
      items: [
        {
          key: "data",
          label: N.items.dataGrid,
          to: `${base}/data`,
          icon: "table",
          match: (p, b) => p.startsWith(`${b}/data`),
        },
        {
          key: "logs",
          label: N.items.logs,
          to: `${base}/logs`,
          icon: "activity",
          match: (p, b) => p.startsWith(`${b}/logs`),
          badge: liveCount > 0 ? liveCount : undefined,
          badgeTone: "primary",
        },
      ],
    },
  ];

  const refreshEvent = async () => {
    await qc.invalidateQueries({ queryKey: adminKeys.event(eventId) });
    await qc.invalidateQueries({ queryKey: adminKeys.events });
  };

  const publicVisible =
    event?.isActive && event.visibility === "published" && !event.hiddenFromPublic;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[248px_minmax(0,1fr)] print:block">
      <aside className="grid gap-3 rounded-card border-(length:--border-w) border-line bg-surface-raised p-3 shadow-card lg:sticky lg:top-5 print:hidden">
        {event && (
          <div className="grid gap-2 border-b-(length:--border-w) border-line pb-3">
            <Link
              to={base}
              className="font-display text-base leading-snug font-extrabold text-text hover:underline"
            >
              {event.name}
            </Link>
            <EventBadges event={event} />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {!publicVisible && (
                <ActionButton
                  size="sm"
                  variant="primary"
                  className="w-full"
                  action={async (ctx) => {
                    await adminApi.eventAction(event.id, "activate", ctx);
                    await refreshEvent();
                  }}
                >
                  {copy.admin.events.activate}
                </ActionButton>
              )}
              {event.isActive && (
                <ActionButton
                  size="sm"
                  className="w-full"
                  action={async (ctx) => {
                    await adminApi.eventAction(
                      event.id,
                      event.hiddenFromPublic ? "unhide" : "hide",
                      ctx,
                    );
                    await refreshEvent();
                  }}
                >
                  {event.hiddenFromPublic ? copy.admin.events.unhide : copy.admin.events.hide}
                </ActionButton>
              )}
            </div>
          </div>
        )}

        <nav
          aria-label={copy.admin.nav.events}
          className="flex gap-1.5 overflow-x-auto pb-1 lg:grid lg:gap-4 lg:overflow-visible lg:pb-0"
        >
          {groups.map((group) => (
            <div key={group.label} className="flex shrink-0 gap-1.5 lg:grid lg:gap-1">
              <p className="hidden px-2.5 text-[11px] font-bold tracking-wider text-muted uppercase lg:block">
                {group.label}
              </p>
              {group.items.map((item) => {
                const active = item.match(pathname, base);
                return (
                  <Link
                    key={item.key}
                    to={item.to}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group inline-flex shrink-0 items-center justify-between gap-2 rounded-chip px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors lg:w-full",
                      active
                        ? "bg-primary text-primary-fg font-bold"
                        : "text-text hover:bg-surface-tint",
                    )}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icon name={item.icon} className="size-4" />
                      <span>{item.label}</span>
                    </span>
                    {item.badge !== undefined && (
                      <Badge tone={item.badgeTone ?? "muted"}>{item.badge}</Badge>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="hidden gap-1.5 border-t-(length:--border-w) border-line pt-3 lg:grid">
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center justify-between rounded-chip px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-surface-tint hover:text-text"
          >
            <span className="inline-flex items-center gap-1.5">
              <Icon name="eye" className="size-3.5" />
              {N.openPublic}
            </span>
            <Icon name="external" className="size-3.5" />
          </a>
          <a
            href="/screen"
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center justify-between rounded-chip px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-surface-tint hover:text-text"
          >
            <span className="inline-flex items-center gap-1.5">
              <Icon name="play" className="size-3.5" />
              {N.openScreen}
            </span>
            <Icon name="external" className="size-3.5" />
          </a>
        </div>
      </aside>

      <div className="min-w-0 grid gap-5 print:block">{children}</div>
    </div>
  );
}
