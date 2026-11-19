import type { BoothSelfView } from "@shared/api-types";
import { useEffect, useState } from "react";
import { ActionButton } from "../../../components/ui/ActionButton";
import { Card } from "../../../components/ui/Card";
import { copy } from "../../../lib/copy";
import { storage } from "../../../lib/safe-storage";
import { boothApi } from "../booth-api";
import { Editable } from "./Editable";
import { ProfileFields, type ProfileValues } from "./ProfileFields";

const toValues = (b: BoothSelfView): ProfileValues => ({
  name: b.name,
  boothNo: b.boothNo ?? "",
  tagline: b.tagline ?? "",
  description: b.description ?? "",
  about: b.about ?? "",
  teamName: b.teamName ?? "",
});

const draftKey = (id: string) => `boothDraft:${id}`;

function readDraft(id: string): ProfileValues | null {
  try {
    const raw = storage.get(draftKey(id));
    return raw ? (JSON.parse(raw) as ProfileValues) : null;
  } catch {
    return null;
  }
}

/**
 * Edit profil. Isian yang belum tersimpan disimpan sebagai draf di penyimpanan peramban (B7): bila sesi berakhir
 * (mis. `owner_changed`) atau halaman tertutup, isiannya tidak hilang.
 */
export function ProfileCard({
  booth,
  locked,
  onSaved,
}: {
  booth: BoothSelfView;
  locked: boolean;
  onSaved: () => Promise<unknown>;
}) {
  const t = copy.booth.profile;
  const saved = toValues(booth);
  const [v, setV] = useState<ProfileValues>(() => readDraft(booth.id) ?? saved);
  const dirty = JSON.stringify(v) !== JSON.stringify(saved);
  const [note, setNote] = useState(false);

  useEffect(() => {
    if (dirty) storage.set(draftKey(booth.id), JSON.stringify(v));
    else storage.remove(draftKey(booth.id));
  }, [dirty, v, booth.id]);

  return (
    <Card title={t.title}>
      <p className="text-xs text-muted">{t.completeness[booth.completeness]}</p>
      <Editable locked={locked}>
        <ProfileFields
          withAbout
          value={v}
          onChange={(next) => {
            setNote(false);
            setV(next);
          }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <ActionButton
            variant="primary"
            disabled={v.name.trim() === "" || !dirty}
            resetOn={JSON.stringify(v)}
            action={async (ctx) => {
              await boothApi.updateProfile(v, ctx);
              storage.remove(draftKey(booth.id));
              await onSaved();
              setNote(true);
            }}
          >
            {t.save}
          </ActionButton>
          {note && (
            <span role="status" className="text-sm font-bold text-primary-strong">
              {t.saved}
            </span>
          )}
        </div>
      </Editable>
    </Card>
  );
}
