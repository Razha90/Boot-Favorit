import type { AdminEventView } from "@shared/api-types";
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
