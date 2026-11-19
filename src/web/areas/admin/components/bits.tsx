import type { AdminEventView } from "@shared/api-types";
import type { ReactNode } from "react";
import { Badge } from "../../../components/ui/Card";
import { copy } from "../../../lib/copy";

/** Status event dalam satu baris lencana. */
export function EventBadges({ event }: { event: AdminEventView }) {
  const phase = copy.admin.events.phase[event.state.phase];
  return (
    <span className="flex flex-wrap gap-1.5">
      {event.isActive && <Badge tone="primary">{copy.admin.events.active}</Badge>}
      {event.visibility === "draft" && <Badge>{copy.admin.events.draft}</Badge>}
      {event.hiddenFromPublic && <Badge tone="accent">{copy.admin.events.hidden}</Badge>}
      <Badge>{phase}</Badge>
    </span>
  );
}

export function QueryState({
  loading,
  error,
  children,
}: {
  loading: boolean;
  error: unknown;
  children: ReactNode;
}) {
  if (loading) return <p className="text-sm text-muted">{copy.admin.common.loading}</p>;
  if (error) {
    return (
      <p role="alert" className="text-sm text-danger">
        {copy.admin.common.loadFailed}
      </p>
    );
  }
  return <>{children}</>;
}
