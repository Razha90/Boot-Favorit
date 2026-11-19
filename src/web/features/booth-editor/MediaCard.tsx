import { useQuery } from "@tanstack/react-query";
import { ImageUploader } from "../../components/shared/ImageUploader";
import { SafeImage } from "../../components/shared/SafeImage";
import { ActionButton } from "../../components/ui/ActionButton";
import { Card } from "../../components/ui/Card";
import { QueryState } from "../../components/ui/states";
import { copy } from "../../lib/copy";
import { mediaUrl, thumbKeyOf } from "../../lib/media-url";
import type { EditorProps } from "./types";

/** Foto galeri dan logo. Semuanya opsional: tanpa foto, tampilan publik beralih sendiri (A16). */
export function MediaCard({ scope, booth, refresh }: EditorProps) {
  const photos = useQuery({
    queryKey: ["booth-editor", "photos", scope.boothId],
    queryFn: () => scope.photos(),
  });
  const reload = async () => {
    await photos.refetch();
    await refresh();
  };
  const list = photos.data?.photos ?? [];

  const move = (i: number, d: -1 | 1) => async (ctx: { key: string }) => {
    const ids = list.map((p) => p.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j] as string, ids[i] as string];
    await scope.reorderPhotos(ids, ctx);
    await reload();
  };

  return (
    <Card title={copy.admin.booth.media}>
      <h3 className="text-sm font-bold">{copy.admin.booth.gallery}</h3>
      <p className="text-xs text-muted">{copy.admin.booth.galleryHint}</p>
      <QueryState loading={photos.isLoading} error={photos.error}>
        {list.length === 0 ? (
          <p className="text-sm text-muted">{copy.admin.booth.noPhotos}</p>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {list.map((p, i) => (
              <li key={p.id} className="grid w-28 gap-1">
                <SafeImage
                  src={mediaUrl(p.keyThumb)}
                  aspect="4/3"
                  className="w-full rounded-card"
                  fallback={
                    <span className="grid aspect-[4/3] place-items-center rounded-card bg-surface-tint text-xs text-muted">
                      ?
                    </span>
                  }
                />
                <span className="text-xs text-muted">
                  {i === 0 ? copy.admin.booth.cover : `#${i + 1}`}
                </span>
                <span className="flex gap-1">
                  <ActionButton
                    size="sm"
                    aria-label={copy.admin.common.moveUp}
                    disabled={i === 0}
                    action={move(i, -1)}
                  >
                    ←
                  </ActionButton>
                  <ActionButton
                    size="sm"
                    aria-label={copy.admin.common.moveDown}
                    disabled={i === list.length - 1}
                    action={move(i, 1)}
                  >
                    →
                  </ActionButton>
                  <ActionButton
                    size="sm"
                    variant="danger"
                    aria-label={copy.admin.common.delete}
                    action={async (ctx) => {
                      await scope.deletePhoto(p.id, ctx);
                      await reload();
                    }}
                  >
                    ✕
                  </ActionButton>
                </span>
              </li>
            ))}
          </ul>
        )}
      </QueryState>
      <ImageUploader
        kind="photo"
        label={copy.admin.booth.addPhoto}
        onUpload={(image, ctx) => scope.upload("photo", image, ctx)}
        onUploaded={reload}
      />

      <h3 className="mt-2 text-sm font-bold">{copy.admin.booth.logo}</h3>
      {booth.logoKey && (
        <div className="flex items-center gap-3">
          <SafeImage src={mediaUrl(thumbKeyOf(booth.logoKey))} className="size-16 rounded-card" />
          <ActionButton
            variant="danger"
            action={async (ctx) => {
              await scope.removeLogo(ctx);
              await refresh();
            }}
          >
            {copy.admin.booth.removeLogo}
          </ActionButton>
        </div>
      )}
      <ImageUploader
        kind="logo"
        label={booth.logoKey ? copy.admin.booth.replaceLogo : copy.admin.booth.addLogo}
        onUpload={(image, ctx) => scope.upload("logo", image, ctx)}
        onUploaded={refresh}
      />
    </Card>
  );
}
