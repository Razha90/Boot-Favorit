import { CONFIG } from "@shared/config";
import { Field, Input, Textarea } from "../../../components/ui/Form";
import { copy } from "../../../lib/copy";

export interface ProfileValues {
  name: string;
  boothNo: string;
  tagline: string;
  description: string;
  about: string;
  teamName: string;
}

export const emptyProfile: ProfileValues = {
  name: "",
  boothNo: "",
  tagline: "",
  description: "",
  about: "",
  teamName: "",
};

/** Isian profil booth, dipakai pendaftaran dan portal. Hanya nama yang wajib (A16); `withAbout` menambah "Cerita booth". */
export function ProfileFields({
  value,
  onChange,
  withAbout = false,
}: {
  value: ProfileValues;
  onChange: (next: ProfileValues) => void;
  withAbout?: boolean;
}) {
  const f = copy.booth.fields;
  const set = (k: keyof ProfileValues) => (e: { target: { value: string } }) =>
    onChange({ ...value, [k]: e.target.value });
  const p = CONFIG.profile;
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={f.name} hint={f.nameHint}>
          {(id) => (
            <Input id={id} value={value.name} maxLength={p.nameMaxLength} onChange={set("name")} />
          )}
        </Field>
        <Field label={f.boothNo} hint={f.boothNoHint}>
          {(id) => (
            <Input
              id={id}
              value={value.boothNo}
              maxLength={p.boothNoMaxLength}
              onChange={set("boothNo")}
            />
          )}
        </Field>
        <Field label={f.tagline} hint={f.taglineHint}>
          {(id) => (
            <Input
              id={id}
              value={value.tagline}
              maxLength={p.taglineMaxLength}
              onChange={set("tagline")}
            />
          )}
        </Field>
        <Field label={f.teamName} hint={f.teamNameHint}>
          {(id) => (
            <Input
              id={id}
              value={value.teamName}
              maxLength={p.teamNameMaxLength}
              onChange={set("teamName")}
            />
          )}
        </Field>
      </div>
      <Field label={f.description} hint={f.descriptionHint}>
        {(id) => (
          <Textarea
            id={id}
            rows={3}
            value={value.description}
            maxLength={p.descriptionMaxLength}
            onChange={set("description")}
          />
        )}
      </Field>
      {withAbout && (
        <Field label={f.about} hint={f.aboutHint}>
          {(id) => (
            <Textarea
              id={id}
              rows={5}
              value={value.about}
              maxLength={CONFIG.booth.aboutMaxLength}
              onChange={set("about")}
            />
          )}
        </Field>
      )}
    </div>
  );
}
