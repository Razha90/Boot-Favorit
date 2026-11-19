import type { BoothMe } from "@shared/api-types";
import { ApiError } from "@shared/errors";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useLocation } from "react-router";
import { ReadOnlyBanner } from "../../../components/shared/WriteAction";
import { ActionButton } from "../../../components/ui/ActionButton";
import { ErrorState, Skeleton } from "../../../components/ui/states";
import { MediaCard } from "../../../features/booth-editor/MediaCard";
import { ProductsCard } from "../../../features/booth-editor/ProductsCard";
import { ownerScope } from "../../../features/booth-editor/scope";
import { useEventData } from "../../../features/event-data";
import { copy } from "../../../lib/copy";
import { boothApi, boothKeys } from "../booth-api";
import { Editable } from "../components/Editable";
import { LoginPanel } from "../components/LoginPanel";
import { ProfileCard } from "../components/ProfileCard";
import { ReviewsCard } from "../components/ReviewsCard";
import { ShareCard } from "../components/ShareCard";
import { StatsCard } from "../components/StatsCard";
import { StatusBanner } from "../components/StatusBanner";
import { WhatsappCard } from "../components/WhatsappCard";
import { useBoothSession } from "../session";

/** Portal booth (A4): masuk bila belum bersesi; selain itu ringkasan, ulasan, profil, foto, produk, WhatsApp, bagikan. */
export function Component() {
  const q = useBoothSession();
  if (q.isLoading) {
    return (
      <div aria-busy="true" className="grid gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  // Pemilik diubah admin saat sesi berjalan: server menjawab owner_changed dan menghapus cookie.
  const ownerChanged = q.error instanceof ApiError && q.error.code === "owner_changed";
  if (q.error && !ownerChanged) return <ErrorState onRetry={() => void q.refetch()} />;
  if (ownerChanged || !q.data?.me) {
    return (
      <LoginPanel turnstileSiteKey={q.data?.turnstileSiteKey ?? null} ownerChanged={ownerChanged} />
    );
  }
  return <PortalHome me={q.data.me} />;
}

function PortalHome({ me }: { me: BoothMe }) {
  const { booth, stats } = me;
  const { event } = useEventData();
  const qc = useQueryClient();
  const location = useLocation();
  const scope = useMemo(() => ownerScope(booth.id), [booth.id]);
  const refresh = () => qc.invalidateQueries({ queryKey: boothKeys.session });
  // Ditolak/ditangguhkan: hanya-baca. (Event selesai ditangani WriteAction.)
  const locked = booth.status === "rejected" || booth.status === "suspended";
  const justRegistered = (location.state as { registered?: boolean } | null)?.registered === true;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h1 className="font-display text-3xl font-extrabold [overflow-wrap:anywhere]">
          {booth.name}
        </h1>
        <ActionButton
          action={async () => {
            await boothApi.logout();
            await refresh();
          }}
        >
          {copy.booth.logout}
        </ActionButton>
      </div>
      <ReadOnlyBanner />
      {justRegistered && (
        <p
          role="status"
          className="rounded-card border-(length:--border-w) border-line bg-primary-soft px-4 py-2 text-sm"
        >
          {copy.booth.register.doneBody}
        </p>
      )}
      <StatusBanner booth={booth} onChanged={() => void refresh()} />
      <StatsCard stats={stats} />
      <ReviewsCard timezone={event.timezone} />
      <ProfileCard booth={booth} locked={locked} onSaved={refresh} />
      <Editable locked={locked}>
        <MediaCard scope={scope} booth={booth} refresh={refresh} />
        <ProductsCard scope={scope} refresh={refresh} />
      </Editable>
      <WhatsappCard booth={booth} locked={locked} onChanged={refresh} />
      <ShareCard booth={booth} eventName={event.name} scope={scope} />
    </>
  );
}
