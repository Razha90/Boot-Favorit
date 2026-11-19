import type { BoothSelfView } from "@shared/api-types";
import { useState } from "react";
import { ActionButton } from "../../../components/ui/ActionButton";
import { Card } from "../../../components/ui/Card";
import { Field, Input } from "../../../components/ui/Form";
import { copy } from "../../../lib/copy";
import { boothApi } from "../booth-api";
import { Editable } from "./Editable";

/** Nomor WhatsApp opsional untuk tombol "Pesan dulu" (A14). Persetujuan pemilik dicatat di server. */
export function WhatsappCard({
  booth,
  locked,
  onChanged,
}: {
  booth: BoothSelfView;
  locked: boolean;
  onChanged: () => Promise<unknown>;
}) {
  const t = copy.booth.whatsapp;
  const [number, setNumber] = useState("");
  const [consent, setConsent] = useState(false);
  return (
    <Card title={t.title} info={t.titleInfo}>
      <p className="text-sm">{booth.whatsapp ? t.current(booth.whatsapp) : t.none}</p>
      <Editable locked={locked}>
        <Field label={t.number} hint={t.numberHint}>
          {(id) => (
            <Input
              id={id}
              inputMode="tel"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
            />
          )}
        </Field>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          {t.consent}
        </label>
        <div className="flex flex-wrap gap-2">
          <ActionButton
            variant="primary"
            disabled={number.trim() === "" || !consent}
            resetOn={`${number}|${consent}`}
            action={async (ctx) => {
              await boothApi.setWhatsapp({ number, consent }, ctx);
              setNumber("");
              setConsent(false);
              await onChanged();
            }}
          >
            {t.save}
          </ActionButton>
          {booth.whatsapp && (
            <ActionButton
              variant="danger"
              action={async (ctx) => {
                await boothApi.setWhatsapp({ number: null, consent: false }, ctx);
                await onChanged();
              }}
            >
              {t.remove}
            </ActionButton>
          )}
        </div>
      </Editable>
    </Card>
  );
}
