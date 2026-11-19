import { REPORT_REASONS } from "@shared/schemas";
import { useState } from "react";
import { ActionButton } from "../../../components/ui/ActionButton";
import { Button } from "../../../components/ui/Button";
import { Field, Input } from "../../../components/ui/Form";
import { Modal } from "../../../components/ui/Modal";
import { useToast } from "../../../components/ui/Toast";
import { cn } from "../../../lib/cn";
import { copy } from "../../../lib/copy";
import { useTurnstile } from "../../../lib/turnstile";
import { useVisitorQuery, visitorApi } from "../visitor-data";

type Reason = (typeof REPORT_REASONS)[number];

/**
 * Laporkan ulasan (A15). Hanya menulis laporan; TIDAK menyembunyikan apa pun (admin yang memutuskan).
 * Dirender hanya saat dibuka, jadi widget Turnstile dibuat sesuai kebutuhan.
 */
export function ReportDialog({ reviewId, onClose }: { reviewId: string; onClose: () => void }) {
  const me = useVisitorQuery().data;
  const toast = useToast();
  const turnstile = useTurnstile(me?.turnstileSiteKey ?? null);
  const [reason, setReason] = useState<Reason>("profanity");
  const [note, setNote] = useState("");
  const humanReady = !turnstile.required || !!turnstile.token;

  return (
    <Modal open onClose={onClose} title={copy.event.report.title}>
      <div ref={turnstile.ref} />
      {!me?.visitor ? (
        <p className="text-sm">{copy.event.report.loginFirst}</p>
      ) : (
        <>
          <fieldset className="grid gap-2">
            <legend className="sr-only">{copy.event.report.title}</legend>
            {REPORT_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={reason === r}
                onClick={() => setReason(r)}
                className={cn(
                  "rounded-card border-(length:--border-w) border-line px-3 py-2 text-left text-sm font-bold",
                  reason === r ? "bg-primary text-primary-fg" : "bg-surface-raised",
                )}
              >
                {copy.event.report.reasons[r]}
              </button>
            ))}
          </fieldset>
          <Field
            label={copy.event.report.note}
            info={copy.event.report.noteInfo}
            hint={copy.event.report.explain}
          >
            {(id) => (
              <Input
                id={id}
                maxLength={200}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            )}
          </Field>
          <ActionButton
            variant="primary"
            disabled={!humanReady}
            resetOn={`${reason}|${note}`}
            onSuccess={() => {
              toast.push(copy.event.reviews.reported, "success");
              onClose();
            }}
            action={async (ctx) => {
              await visitorApi.report(
                reviewId,
                { reason, note: note.trim() === "" ? null : note.trim() },
                turnstile.token,
                ctx,
              );
              turnstile.reset();
            }}
          >
            {copy.event.report.submit}
          </ActionButton>
        </>
      )}
      <div className="flex justify-end">
        <Button onClick={onClose}>{copy.event.share.close}</Button>
      </div>
    </Modal>
  );
}
