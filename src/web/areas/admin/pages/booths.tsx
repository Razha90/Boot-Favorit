import type { AdminBoothView } from "@shared/api-types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { ActionButton } from "../../../components/ui/ActionButton";
import { Badge, Card } from "../../../components/ui/Card";
import { Field, Input, Select } from "../../../components/ui/Form";
import { QueryState } from "../../../components/ui/states";
import { copy } from "../../../lib/copy";
import { adminApi, adminKeys } from "../api";

const OWNER_TONE = { none: "muted", invited: "accent", active: "primary" } as const;
const COMPLETE_TONE = { name_only: "muted", partial: "accent", full: "primary" } as const;

export function Component() {
  const { id: eventId = "" } = useParams();
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ q: "", owner: "", completeness: "", status: "" });
  const booths = useQuery({
    queryKey: [...adminKeys.booths(eventId), filters],
    queryFn: () => adminApi.booths(eventId, filters),
  });

  const [name, setName] = useState("");
  const [boothNo, setBoothNo] = useState("");
  const [email, setEmail] = useState("");

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <Link to={`/admin/e/${eventId}`} className="text-sm text-muted underline">
            ← {copy.admin.booths.backToEvent}
          </Link>
          <h1 className="font-display text-3xl font-extrabold">{copy.admin.booths.title}</h1>
        </div>
        <Link
          to={`/admin/e/${eventId}/booths/import`}
          className="rounded-chip border-(length:--border-w) border-line px-4 py-2 text-sm font-bold"
        >
          {copy.admin.booths.importCsv}
        </Link>
      </div>

      <Card title={copy.admin.booths.add}>
        <p className="text-sm text-muted">{copy.admin.booths.addHint}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={copy.admin.booths.name}>
            {(fid) => <Input id={fid} value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <Field label={copy.admin.booths.boothNo}>
            {(fid) => (
              <Input id={fid} value={boothNo} onChange={(e) => setBoothNo(e.target.value)} />
            )}
          </Field>
          <Field label={copy.admin.booths.email} hint={copy.admin.booths.emailHint}>
            {(fid) => (
              <Input
                id={fid}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </Field>
        </div>
        <div>
          <ActionButton
            variant="primary"
            disabled={name.trim() === ""}
            resetOn={`${name}|${boothNo}|${email}`}
            action={async (ctx) => {
              await adminApi.createBooth(eventId, { name, boothNo, email }, ctx);
              setName("");
              setBoothNo("");
              setEmail("");
              await qc.invalidateQueries({ queryKey: adminKeys.booths(eventId) });
            }}
          >
            {copy.admin.booths.addButton}
          </ActionButton>
        </div>
      </Card>

      <Card>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label={copy.admin.booths.search}>
            {(fid) => (
              <Input
                id={fid}
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              />
            )}
          </Field>
          <Field label={copy.admin.booths.owner}>
            {(fid) => (
              <Select
                id={fid}
                value={filters.owner}
                onChange={(e) => setFilters({ ...filters, owner: e.target.value })}
              >
                <option value="">{copy.admin.common.all}</option>
                {(["none", "invited", "active"] as const).map((o) => (
                  <option key={o} value={o}>
                    {copy.admin.booths.ownerState[o]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={copy.admin.booths.completeness}>
            {(fid) => (
              <Select
                id={fid}
                value={filters.completeness}
                onChange={(e) => setFilters({ ...filters, completeness: e.target.value })}
              >
                <option value="">{copy.admin.common.all}</option>
                {(["name_only", "partial", "full"] as const).map((o) => (
                  <option key={o} value={o}>
                    {copy.admin.booths.completenessLabel[o]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={copy.admin.booths.status}>
            {(fid) => (
              <Select
                id={fid}
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="">{copy.admin.common.all}</option>
                {(["pending", "approved", "rejected", "revision", "suspended"] as const).map(
                  (o) => (
                    <option key={o} value={o}>
                      {copy.admin.booths.statusLabel[o]}
                    </option>
                  ),
                )}
              </Select>
            )}
          </Field>
        </div>

        <QueryState loading={booths.isLoading} error={booths.error}>
          {booths.data?.booths.length === 0 ? (
            <p className="text-sm text-muted">{copy.admin.booths.empty}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr>
                    <th className="py-2 pr-3">{copy.admin.booths.name}</th>
                    <th className="pr-3">{copy.admin.booths.boothNo}</th>
                    <th className="pr-3">{copy.admin.booths.owner}</th>
                    <th className="pr-3">{copy.admin.booths.completeness}</th>
                    <th className="pr-3">{copy.admin.booths.status}</th>
                    <th className="pr-3">{copy.admin.booths.photos}</th>
                    <th>{copy.admin.booths.products}</th>
                  </tr>
                </thead>
                <tbody>
                  {booths.data?.booths.map((b) => (
                    <BoothRow key={b.id} booth={b} eventId={eventId} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </QueryState>
      </Card>
    </>
  );
}

function BoothRow({ booth: b, eventId }: { booth: AdminBoothView; eventId: string }) {
  return (
    <tr className="border-t-(length:--border-w) border-line align-top">
      <td className="py-2 pr-3 font-bold">
        <Link
          to={`/admin/e/${eventId}/booths/${b.id}`}
          className="underline-offset-2 hover:underline"
        >
          {b.name}
        </Link>
      </td>
      <td className="pr-3">{b.boothNo ?? copy.admin.common.none}</td>
      <td className="pr-3">
        <Badge tone={OWNER_TONE[b.ownerState]}>{copy.admin.booths.ownerState[b.ownerState]}</Badge>
      </td>
      <td className="pr-3">
        <Badge tone={COMPLETE_TONE[b.completeness]}>
          {copy.admin.booths.completenessLabel[b.completeness]}
        </Badge>
      </td>
      <td className="pr-3">{copy.admin.booths.statusLabel[b.status]}</td>
      <td className="pr-3">{b.photoCount}</td>
      <td>{b.productCount}</td>
    </tr>
  );
}
