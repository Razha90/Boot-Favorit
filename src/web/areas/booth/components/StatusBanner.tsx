import type { BoothSelfView } from "@shared/api-types";
import { ActionButton } from "../../../components/ui/ActionButton";
import { Badge } from "../../../components/ui/Card";
import { copy } from "../../../lib/copy";
import { boothApi } from "../booth-api";
import { Editable } from "./Editable";

const TONE = {
  pending: "accent",
  approved: "primary",
  revision: "accent",
  rejected: "danger",
  suspended: "danger",
} as const;

/** Status verifikasi booth + catatan panitia. Dari status `revision`, pemilik bisa mengirim ulang setelah memperbaiki. */
export function StatusBanner({
  booth,
  onChanged,
}: {
  booth: BoothSelfView;
  onChanged: () => void;
}) {
  const s = copy.booth.status[booth.status];
  const showReason =
    booth.rejectReason && booth.status !== "approved" && booth.status !== "pending";
  return (
    <section
      aria-label={s.title}
      className="grid gap-2 rounded-card border-(length:--border-w) border-line bg-surface-raised p-4"
    >
      <p className="flex flex-wrap items-center gap-2">
        <Badge tone={TONE[booth.status]}>{s.title}</Badge>
        {booth.isLate && <Badge>{copy.booth.status.late}</Badge>}
      </p>
      <p className="text-sm">{s.body}</p>
      {showReason && (
        <p className="text-sm">
          <span className="font-bold">{copy.booth.status.reason}:</span> {booth.rejectReason}
        </p>
      )}
      {booth.status === "revision" && (
        <Editable locked={false}>
          <div>
            <ActionButton
              variant="primary"
              action={async (ctx) => {
                await boothApi.resubmit(ctx);
                onChanged();
              }}
            >
              {copy.booth.status.resubmit}
            </ActionButton>
          </div>
        </Editable>
      )}
    </section>
  );
}
