// Halaman Data Grid admin (explore.md A3 langkah 8, B18): tab Booth · Produk · Review · Pengunjung · Peringkat.
import { GRID_ENTITIES, type GridEntity } from "@shared/data-grid";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router";
import { Button } from "../../../components/ui/Button";
import { QueryState } from "../../../components/ui/states";
import { copy } from "../../../lib/copy";
import { adminApi, adminKeys } from "../api";
import { DataGrid } from "../components/data/DataGrid";
import { dataApi, dataKeys } from "../data-api";

const D = copy.admin.data;

const isEntity = (v: string | null): v is GridEntity =>
  v !== null && (GRID_ENTITIES as readonly string[]).includes(v);

export function Component() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const rawTab = params.get("tab");
  const tab: GridEntity = isEntity(rawTab) ? rawTab : "booths";

  const event = useQuery({ queryKey: adminKeys.event(id), queryFn: () => adminApi.event(id) });
  // Diperlukan untuk pratinjau dampak peringkat (`rankImpact`) saat admin menyunting tab Review.
  const ranking = useQuery({
    queryKey: dataKeys.ranking(id),
    queryFn: () => dataApi.query(id, "ranking", {}),
  });

  const timeZone = event.data?.event.timezone ?? "Asia/Jakarta";

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">{D.title}</h1>
        <Link
          to={`/admin/e/${id}/logs`}
          className="text-sm font-bold text-primary-strong underline"
        >
          {copy.admin.logs.title}
        </Link>
      </div>

      <div role="tablist" aria-label={D.title} className="flex flex-wrap gap-2">
        {GRID_ENTITIES.map((e) => (
          <Button
            key={e}
            role="tab"
            aria-selected={tab === e}
            variant={tab === e ? "primary" : "secondary"}
            onClick={() => setParams(e === "booths" ? {} : { tab: e }, { replace: true })}
          >
            {D.tabs[e]}
          </Button>
        ))}
      </div>

      <QueryState loading={event.isLoading} error={event.error}>
        {event.data && (
          <DataGrid
            eventId={id}
            entity={tab}
            timeZone={timeZone}
            rankingRows={ranking.data?.rows ?? []}
          />
        )}
      </QueryState>
    </>
  );
}
