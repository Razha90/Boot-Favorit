import { type ReactNode, useState } from "react";
import { ActionButton } from "../../../components/ui/ActionButton";
import { Field, Input } from "../../../components/ui/Form";
import type { ActionContext } from "../../../lib/action";
import { copy } from "../../../lib/copy";

export const MIN_REASON = 5;

export interface ReasonedAction {
  /** Pengenal tetap aksi (kunci daftar) */
  id: string;
  label: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  run: (reason: string, ctx: ActionContext) => Promise<unknown>;
}

/**
 * Setiap keputusan moderasi wajib beralasan (A15): satu isian alasan + deretan aksi yang mati sampai alasan cukup.
 * Dipakai bersama oleh antrean, komentar ditahan, dan daftar semua ulasan.
 */
export function ReasonedActions({ actions }: { actions: readonly ReasonedAction[] }) {
  const [reason, setReason] = useState("");
  const ok = reason.trim().length >= MIN_REASON;
  return (
    <div className="grid gap-2">
      <Field label={copy.admin.moderation.reason} info={copy.admin.moderation.reasonInfo}>
        {(id) => (
          <Input
            id={id}
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
          />
        )}
      </Field>
      <div className="flex flex-wrap items-start gap-2">
        {actions.map((a) => (
          <ActionButton
            key={a.id}
            size="sm"
            variant={a.variant ?? "secondary"}
            disabled={!ok}
            resetOn={reason}
            action={(ctx) => a.run(reason.trim(), ctx)}
          >
            {a.label}
          </ActionButton>
        ))}
      </div>
    </div>
  );
}
