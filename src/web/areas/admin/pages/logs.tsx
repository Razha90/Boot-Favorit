// Halaman Log aktivitas admin (explore.md B13): baca dari Analytics Engine lewat API Worker, filter, polling, ekspor CSV.
import { CONFIG } from "@shared/config";
import { LOG_ACTIONS, LOG_CATEGORIES, LOG_LEVELS } from "@shared/log-events";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { Button } from "../../../components/ui/Button";
import { Badge, Card } from "../../../components/ui/Card";
import { Field, Input, Select } from "../../../components/ui/Form";
import { QueryState } from "../../../components/ui/states";
import { copy } from "../../../lib/copy";
import { formatDateTime } from "../../../lib/format";
import { adminApi, adminKeys } from "../api";
import { downloadCsv } from "../csv-export";
import { dataApi, dataKeys, type LogParams } from "../data-api";

const L = copy.admin.logs;
const RANGES = ["1h", "1d", "7d", "30d"] as const;
const LEVEL_TONE = { info: "muted", warn: "accent", error: "danger" } as const;

export function Component() {
  const { id = "" } = useParams();
  const [searchParams] = useSearchParams();

  const [range, setRange] = useState<LogParams["range"]>(CONFIG.logs.defaultRange);
  const [category, setCategory] = useState("");
  const [level, setLevel] = useState("");
  const [action, setAction] = useState("");
  const [actor, setActor] = useState(() => searchParams.get("actor") ?? "");
  const [target, setTarget] = useState(() => searchParams.get("target") ?? "");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const event = useQuery({ queryKey: adminKeys.event(id), queryFn: () => adminApi.event(id) });
  const timeZone = event.data?.event.timezone ?? "Asia/Jakarta";

  const params: LogParams = {
    range,
    ...(category ? { category } : {}),
    ...(level ? { level } : {}),
    ...(action ? { action } : {}),
    ...(actor.trim() ? { actor: actor.trim() } : {}),
    ...(target.trim() ? { target: target.trim() } : {}),
  };

  const logs = useQuery({
    queryKey: dataKeys.logs(id, params),
    queryFn: () => dataApi.logs(id, params),
    refetchInterval: autoRefresh ? 15_000 : false,
  });
  const health = useQuery({
    queryKey: dataKeys.health(id),
    queryFn: () => dataApi.health(id),
    refetchInterval: autoRefresh ? 15_000 : false,
  });

  const entries = logs.data?.entries ?? [];

  const resetFilters = () => {
    setRange(CONFIG.logs.defaultRange);
    setCategory("");
    setLevel("");
    setAction("");
    setActor("");
    setTarget("");
  };

  const exportCsv = () => {
    downloadCsv(
      `logs-${id.slice(0, 8)}.csv`,
      [
        "timestamp",
        "level",
        "category",
        "action",
        "actorType",
        "actorId",
        "targetType",
        "targetId",
        "msg",
        "meta",
        "requestId",
      ],
      entries.map((e) => [
        e.at ? new Date(e.at).toISOString() : "",
        e.level,
        e.category,
        e.action,
        e.actorType,
        e.actorId,
        e.targetType,
        e.targetId,
        e.msg,
        e.meta ? JSON.stringify(e.meta) : "",
        e.requestId,
      ]),
    );
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">{L.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            {L.autoRefresh}
          </label>
          <Button
            size="sm"
            onClick={() => {
              void logs.refetch();
              void health.refetch();
            }}
            disabled={logs.isFetching}
          >
            {L.refreshNow}
          </Button>
          <Button size="sm" onClick={exportCsv} disabled={entries.length === 0}>
            {L.exportCsv}
          </Button>
        </div>
      </div>

      {health.data && (
        <Card title={L.health.title}>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:grid-cols-7">
            {[
              [L.health.viewers, `${health.data.liveViewers}/${health.data.maxLiveViewers}`],
              [L.health.screens, String(health.data.liveScreens)],
              [L.health.reviewsPerMin, String(health.data.reviewsLastMinute)],
              [L.health.reviewsPerHour, String(health.data.reviewsLastHour)],
              [L.health.heldReviews, String(health.data.heldReviews)],
              [L.health.openReports, String(health.data.openReports)],
              [L.health.pendingBooths, String(health.data.pendingBooths)],
            ].map(([label, val]) => (
              <div key={label} className="rounded-card border-(length:--border-w) border-line p-2">
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="font-display text-xl font-extrabold tabular-nums">{val}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      <Card>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Field label={L.range}>
            {(fid) => (
              <Select
                id={fid}
                value={range}
                onChange={(e) => setRange(e.target.value as LogParams["range"])}
              >
                {RANGES.map((r) => (
                  <option key={r} value={r}>
                    {L.ranges[r]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={L.category}>
            {(fid) => (
              <Select id={fid} value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">{copy.admin.common.all}</option>
                {LOG_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={L.level}>
            {(fid) => (
              <Select id={fid} value={level} onChange={(e) => setLevel(e.target.value)}>
                <option value="">{copy.admin.common.all}</option>
                {LOG_LEVELS.map((lv) => (
                  <option key={lv} value={lv}>
                    {lv}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={L.action}>
            {(fid) => (
              <Select id={fid} value={action} onChange={(e) => setAction(e.target.value)}>
                <option value="">{copy.admin.common.all}</option>
                {LOG_ACTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={L.actor}>
            {(fid) => <Input id={fid} value={actor} onChange={(e) => setActor(e.target.value)} />}
          </Field>
          <Field label={L.target}>
            {(fid) => <Input id={fid} value={target} onChange={(e) => setTarget(e.target.value)} />}
          </Field>
        </div>
        <div>
          <Button size="sm" onClick={resetFilters}>
            {L.clear}
          </Button>
        </div>

        <QueryState loading={logs.isLoading} error={logs.error}>
          {logs.data && !logs.data.configured && (
            <p
              role="status"
              className="rounded-card border-(length:--border-w) border-line bg-surface-tint p-3 text-sm text-muted"
            >
              {L.notConfigured}
            </p>
          )}
          {logs.data?.configured && entries.length === 0 ? (
            <p className="py-4 text-sm text-muted">{L.empty}</p>
          ) : (
            entries.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="bg-surface-tint">
                    <tr>
                      <th className="px-2 py-2">{L.columns.time}</th>
                      <th className="px-2 py-2">{L.columns.level}</th>
                      <th className="px-2 py-2">{L.columns.category}</th>
                      <th className="px-2 py-2">{L.columns.action}</th>
                      <th className="px-2 py-2">{L.columns.actor}</th>
                      <th className="px-2 py-2">{L.columns.target}</th>
                      <th className="px-2 py-2">{L.columns.msg}</th>
                      <th className="px-2 py-2">{L.columns.meta}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr
                        key={`${e.requestId}-${e.action}-${e.targetId}-${e.at}`}
                        className="border-t-(length:--border-w) border-line"
                      >
                        <td className="whitespace-nowrap px-2 py-2">
                          {e.at ? formatDateTime(e.at, timeZone) : copy.admin.common.none}
                        </td>
                        <td className="px-2 py-2">
                          <Badge tone={LEVEL_TONE[e.level as keyof typeof LEVEL_TONE] ?? "muted"}>
                            {e.level}
                          </Badge>
                        </td>
                        <td className="px-2 py-2">{e.category}</td>
                        <td className="whitespace-nowrap px-2 py-2 font-mono">{e.action}</td>
                        <td className="whitespace-nowrap px-2 py-2">
                          {e.actorType ? `${e.actorType}:${e.actorId}` : copy.admin.common.none}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2">
                          {e.targetType ? `${e.targetType}:${e.targetId}` : copy.admin.common.none}
                        </td>
                        <td className="max-w-xs px-2 py-2 [overflow-wrap:anywhere]">
                          {e.msg || copy.admin.common.none}
                        </td>
                        <td className="max-w-xs px-2 py-2 font-mono text-muted [overflow-wrap:anywhere]">
                          {e.meta ? JSON.stringify(e.meta) : copy.admin.common.none}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </QueryState>
      </Card>
    </>
  );
}
