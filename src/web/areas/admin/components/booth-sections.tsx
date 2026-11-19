import type { AdminBoothView } from "@shared/api-types";
import { useState } from "react";
import { ActionButton } from "../../../components/ui/ActionButton";
import { Badge, Card } from "../../../components/ui/Card";
import { Field, Input, Select, Textarea } from "../../../components/ui/Form";
import { copy } from "../../../lib/copy";
import { adminApi } from "../api";

const STATUSES = ["pending", "approved", "rejected", "revision", "suspended"] as const;

export interface SectionProps {
  eventId: string;
  booth: AdminBoothView;
  /** Muat ulang data booth (dan daftar terkait) setelah perubahan */
  refresh: () => Promise<unknown>;
}

// ---------- Profil ----------

export function ProfileCard({ eventId, booth, refresh }: SectionProps) {
  const [f, setF] = useState({
    name: booth.name,
    boothNo: booth.boothNo ?? "",
    tagline: booth.tagline ?? "",
    description: booth.description ?? "",
    about: booth.about ?? "",
    teamName: booth.teamName ?? "",
    status: booth.status,
    rejectReason: booth.rejectReason ?? "",
    reason: "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const owned = booth.ownerState === "active";
  const needsRejectReason = f.status === "rejected" || f.status === "revision";

  return (
    <Card title={copy.admin.booth.profile}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={copy.admin.booths.name}>
          {(id) => <Input id={id} value={f.name} onChange={(e) => set("name", e.target.value)} />}
        </Field>
        <Field label={copy.admin.booths.boothNo}>
          {(id) => (
            <Input id={id} value={f.boothNo} onChange={(e) => set("boothNo", e.target.value)} />
          )}
        </Field>
        <Field label={copy.admin.booth.tagline}>
          {(id) => (
            <Input id={id} value={f.tagline} onChange={(e) => set("tagline", e.target.value)} />
          )}
        </Field>
        <Field label={copy.admin.booth.teamName}>
          {(id) => (
            <Input id={id} value={f.teamName} onChange={(e) => set("teamName", e.target.value)} />
          )}
        </Field>
      </div>
      <Field label={copy.admin.booth.description}>
        {(id) => (
          <Textarea
            id={id}
            rows={2}
            value={f.description}
            onChange={(e) => set("description", e.target.value)}
          />
        )}
      </Field>
      <Field label={copy.admin.booth.about} hint={copy.admin.booth.aboutHint}>
        {(id) => (
          <Textarea
            id={id}
            rows={5}
            value={f.about}
            onChange={(e) => set("about", e.target.value)}
          />
        )}
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={copy.admin.booths.status}>
          {(id) => (
            <Select
              id={id}
              value={f.status}
              onChange={(e) => set("status", e.target.value as typeof f.status)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {copy.admin.booths.statusLabel[s]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {needsRejectReason && (
          <Field label={copy.admin.booth.rejectReason} hint={copy.admin.booth.rejectReasonHint}>
            {(id) => (
              <Input
                id={id}
                value={f.rejectReason}
                onChange={(e) => set("rejectReason", e.target.value)}
              />
            )}
          </Field>
        )}
      </div>
      {owned && (
        <Field label={copy.admin.booth.reason} hint={copy.admin.booth.reasonHint}>
          {(id) => (
            <Input id={id} value={f.reason} onChange={(e) => set("reason", e.target.value)} />
          )}
        </Field>
      )}
      <div>
        <ActionButton
          variant="primary"
          disabled={f.name.trim() === ""}
          resetOn={JSON.stringify(f)}
          action={async () => {
            await adminApi.updateBooth(eventId, booth.id, {
              name: f.name,
              boothNo: f.boothNo,
              tagline: f.tagline,
              description: f.description,
              about: f.about,
              teamName: f.teamName,
              status: f.status,
              ...(needsRejectReason && { rejectReason: f.rejectReason }),
              ...(owned && { reason: f.reason }),
              version: booth.version,
            });
            await refresh();
          }}
        >
          {copy.admin.common.save}
        </ActionButton>
      </div>
    </Card>
  );
}

// ---------- Pemilik ----------

export function OwnerCard({ eventId, booth, refresh }: SectionProps) {
  const [email, setEmail] = useState(booth.email ?? "");
  const [reason, setReason] = useState("");
  const owned = booth.ownerState === "active";
  const tone = { none: "muted", invited: "accent", active: "primary" } as const;

  const save = (next: string) => async (ctx: { key: string }) => {
    await adminApi.setOwner(eventId, booth.id, { email: next, ...(owned && { reason }) }, ctx);
    await refresh();
  };

  return (
    <Card title={copy.admin.booth.owner}>
      <p className="flex items-center gap-2 text-sm">
        <Badge tone={tone[booth.ownerState]}>
          {copy.admin.booths.ownerState[booth.ownerState]}
        </Badge>
        <span className="text-muted">{copy.admin.booth.ownerExplain[booth.ownerState]}</span>
      </p>
      <Field label={copy.admin.booths.email} hint={copy.admin.booth.ownerHint}>
        {(id) => (
          <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        )}
      </Field>
      {owned && (
        <Field label={copy.admin.booth.reason} hint={copy.admin.booth.reasonHint}>
          {(id) => <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}
        </Field>
      )}
      <div className="flex flex-wrap gap-2">
        <ActionButton variant="primary" resetOn={`${email}|${reason}`} action={save(email)}>
          {copy.admin.booth.ownerSave}
        </ActionButton>
        {booth.email && (
          <ActionButton variant="danger" resetOn={reason} action={save("")}>
            {copy.admin.booth.ownerRemove}
          </ActionButton>
        )}
      </div>
    </Card>
  );
}

// ---------- WhatsApp ----------

export function WhatsappCard({ eventId, booth, refresh }: SectionProps) {
  const [number, setNumber] = useState("");
  const [consent, setConsent] = useState(false);
  return (
    <Card title={copy.admin.booth.whatsapp}>
      <p className="text-sm text-muted">
        {booth.hasWhatsapp ? copy.admin.booth.whatsappSet : copy.admin.booth.whatsappNone}
      </p>
      <Field label={copy.admin.booth.whatsappNumber} hint={copy.admin.booth.whatsappHint}>
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
        {copy.admin.booth.whatsappConsent}
      </label>
      <div className="flex flex-wrap gap-2">
        <ActionButton
          variant="primary"
          disabled={number.trim() === "" || !consent}
          resetOn={`${number}|${consent}`}
          action={async (ctx) => {
            await adminApi.setWhatsapp(
              eventId,
              booth.id,
              { number, consentConfirmedByAdmin: consent },
              ctx,
            );
            setNumber("");
            setConsent(false);
            await refresh();
          }}
        >
          {copy.admin.common.save}
        </ActionButton>
        {booth.hasWhatsapp && (
          <ActionButton
            variant="danger"
            action={async (ctx) => {
              await adminApi.setWhatsapp(eventId, booth.id, { number: "" }, ctx);
              await refresh();
            }}
          >
            {copy.admin.booth.whatsappRemove}
          </ActionButton>
        )}
      </div>
    </Card>
  );
}
