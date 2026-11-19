import type { AdminEventView } from "@shared/api-types";
import { ImageUploader } from "../../../components/shared/ImageUploader";
import { SafeImage } from "../../../components/shared/SafeImage";
import { ActionButton } from "../../../components/ui/ActionButton";
import { Card } from "../../../components/ui/Card";
import { copy } from "../../../lib/copy";
import { mediaUrl, thumbKeyOf } from "../../../lib/media-url";
import { adminApi } from "../api";

type Kind = "logo" | "og" | "hero";

function Current({
  fullKey,
  onRemove,
}: {
  fullKey: string | null;
  onRemove: (ctx: { key: string }) => Promise<void>;
}) {
  if (!fullKey) return null;
  return (
    <div className="flex items-center gap-3">
      <SafeImage
        src={mediaUrl(thumbKeyOf(fullKey))}
        aspect="4/3"
        className="h-16 rounded-card"
        fallback={null}
      />
      <ActionButton size="sm" variant="danger" action={onRemove}>
        {copy.admin.common.delete}
      </ActionButton>
    </div>
  );
}

/** Gambar milik event (logo, OG, kolase hero). Semuanya OPSIONAL: tanpa gambar, halaman menyesuaikan (A16). */
export function EventMediaCard({
  event,
  refresh,
}: {
  event: AdminEventView;
  refresh: () => Promise<unknown>;
}) {
  const m = event.media;
  const remove = (kind: Kind, slot: number) => async (ctx: { key: string }) => {
    await adminApi.removeEventMedia(event.id, kind, slot, ctx);
    await refresh();
  };
  const upload =
    (kind: Kind, slot = 0) =>
    (image: Parameters<typeof adminApi.uploadEventMedia>[3], ctx: { key: string }) =>
      adminApi.uploadEventMedia(event.id, kind, slot, image, ctx);

  return (
    <Card title={copy.admin.event.media.title}>
      <p className="text-sm text-muted">{copy.admin.event.media.hint}</p>

      <h3 className="text-sm font-bold">{copy.admin.event.media.hero}</h3>
      <p className="text-xs text-muted">{copy.admin.event.media.heroHint}</p>
      <ul className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((slot) => (
          <li key={`hero-${slot}`} className="grid content-start gap-2">
            <Current fullKey={m.heroKeys[slot] ?? null} onRemove={remove("hero", slot)} />
            <ImageUploader
              kind="photo"
              label={
                m.heroKeys[slot]
                  ? copy.admin.event.media.replace(slot + 1)
                  : copy.admin.event.media.add(slot + 1)
              }
              onUpload={upload("hero", slot)}
              onUploaded={refresh}
            />
          </li>
        ))}
      </ul>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid content-start gap-2">
          <h3 className="text-sm font-bold">{copy.admin.event.media.og}</h3>
          <p className="text-xs text-muted">{copy.admin.event.media.ogHint}</p>
          <Current fullKey={m.ogImageKey} onRemove={remove("og", 0)} />
          <ImageUploader
            kind="photo"
            label={copy.admin.event.media.ogUpload}
            onUpload={upload("og")}
            onUploaded={refresh}
          />
        </div>
        <div className="grid content-start gap-2">
          <h3 className="text-sm font-bold">{copy.admin.event.media.logo}</h3>
          <p className="text-xs text-muted">{copy.admin.event.media.logoHint}</p>
          <Current fullKey={m.logoKey} onRemove={remove("logo", 0)} />
          <ImageUploader
            kind="logo"
            label={copy.admin.event.media.logoUpload}
            onUpload={upload("logo")}
            onUploaded={refresh}
          />
        </div>
      </div>
    </Card>
  );
}
