import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { Badge } from "../../../components/ui/Card";
import { copy } from "../../../lib/copy";
import { adminApi, adminKeys } from "../api";
import { QueryState } from "../components/bits";
import { OwnerCard, ProfileCard, WhatsappCard } from "../components/booth-sections";
import { MediaCard } from "../components/MediaCard";
import { ProductsCard } from "../components/ProductsCard";

export function Component() {
  const { id: eventId = "", bid: boothId = "" } = useParams();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: adminKeys.booth(eventId, boothId),
    queryFn: () => adminApi.booth(eventId, boothId),
  });
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: adminKeys.booth(eventId, boothId) });
    await qc.invalidateQueries({ queryKey: adminKeys.booths(eventId) });
  };

  return (
    <QueryState loading={q.isLoading} error={q.error}>
      {q.data && (
        <>
          <div className="grid gap-1">
            <Link to={`/admin/e/${eventId}/booths`} className="text-sm text-muted underline">
              ← {copy.admin.booths.title}
            </Link>
            <h1 className="font-display text-3xl font-extrabold">{q.data.booth.name}</h1>
            <p className="flex flex-wrap gap-2">
              <Badge>{copy.admin.booths.statusLabel[q.data.booth.status]}</Badge>
              <Badge tone="primary">
                {copy.admin.booths.completenessLabel[q.data.booth.completeness]}
              </Badge>
            </p>
          </div>
          {/* key = versi: formulir dimuat ulang dari data terbaru setelah tiap penyimpanan */}
          <ProfileCard
            key={q.data.booth.version}
            eventId={eventId}
            booth={q.data.booth}
            refresh={refresh}
          />
          <OwnerCard
            key={`o-${q.data.booth.version}`}
            eventId={eventId}
            booth={q.data.booth}
            refresh={refresh}
          />
          <MediaCard eventId={eventId} booth={q.data.booth} refresh={refresh} />
          <ProductsCard eventId={eventId} booth={q.data.booth} refresh={refresh} />
          <WhatsappCard eventId={eventId} booth={q.data.booth} refresh={refresh} />
        </>
      )}
    </QueryState>
  );
}
