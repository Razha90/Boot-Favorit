import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import type { ActionContext } from "../../lib/action";
import { copy } from "../../lib/copy";
import { ActionButton } from "./ActionButton";
import { Button } from "./Button";

/**
 * Dialog modal di atas <dialog> bawaan (Baseline): fokus terkunci, Esc menutup, latar tidak bisa diklik.
 * `locked` mencegah penutupan (Esc dan tombol) selama ada aksi yang sedang diproses (B21).
 */
export function Modal({
  open,
  onClose,
  title,
  locked = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  locked?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // id unik per dialog: satu halaman bisa memuat banyak dialog (mis. satu per tombol Bagikan).
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // `cancel` = Esc. Saat terkunci, dibatalkan agar dialog tetap terbuka.
      onCancel={(e) => {
        e.preventDefault();
        if (!locked) onClose();
      }}
      className="m-auto w-[min(92vw,28rem)] rounded-card border-(length:--border-w) border-line bg-surface-raised p-5 text-text shadow-card backdrop:bg-text/40"
    >
      <div className="grid gap-3">
        <h2 id={titleId} className="font-display text-lg font-extrabold">
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  );
}

/** Konfirmasi aksi berisiko (hapus, umumkan, putar animasi). Tombol konfirmasi adalah ActionButton. */
export function ConfirmDialog({
  open,
  onClose,
  title,
  message,
  confirmLabel,
  danger = false,
  action,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  action: (ctx: ActionContext) => Promise<unknown>;
}) {
  const [pending, setPending] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title={title} locked={pending}>
      <div className="text-sm text-muted">{message}</div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={onClose} disabled={pending}>
          {copy.states.cancel}
        </Button>
        <ActionButton
          variant={danger ? "danger" : "primary"}
          action={action}
          onStatusChange={(s) => setPending(s === "pending")}
          onSuccess={onClose}
        >
          {confirmLabel}
        </ActionButton>
      </div>
    </Modal>
  );
}
