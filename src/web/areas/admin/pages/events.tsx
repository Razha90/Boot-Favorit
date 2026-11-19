import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { ActionButton } from "../../../components/ui/ActionButton";
import { Card } from "../../../components/ui/Card";
import { Field, Input, Select } from "../../../components/ui/Form";
import { Icon } from "../../../components/ui/Icon";
import { QueryState } from "../../../components/ui/states";
import { cn } from "../../../lib/cn";
import { copy } from "../../../lib/copy";
import { formatDateTime } from "../../../lib/format";
import { adminApi, adminKeys } from "../api";
import { EventBadges } from "../components/bits";
import { parseSchedule, ScheduleFields, type ScheduleValues } from "../components/ScheduleFields";

const ZONES = ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"] as const;
const emptySchedule: ScheduleValues = { open: "", close: "", start: "", end: "" };

export function Component() {
  const qc = useQueryClient();
  const events = useQuery({ queryKey: adminKeys.events, queryFn: adminApi.events });

  const [name, setName] = useState("");
  const [highlight, setHighlight] = useState("");
  const [zone, setZone] = useState<string>(ZONES[0]);
  const [schedule, setSchedule] = useState<ScheduleValues>(emptySchedule);
  const parsed = parseSchedule(schedule, zone);
  const canCreate = name.trim() !== "" && parsed.value !== null;
  const now = Date.now();

  const E = copy.admin.events;

  return (
    <>
      <div className="grid gap-1">
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">{E.title}</h1>
        <p className="text-sm text-muted">{E.subtitle}</p>
      </div>

      {/* Ringkasan alur kerja 3 langkah di atas agar daftar event & form buat event tampil seimbang */}
      <Card title={E.stepsTitle}>
        <ol className="grid gap-3 md:grid-cols-3">
          {E.steps.map((step, idx) => (
            <li
              key={step}
              className="flex items-start gap-2.5 rounded-card border-(length:--border-w) border-line bg-surface p-3 text-sm text-muted"
            >
              <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-chip bg-primary-soft text-xs font-extrabold text-primary-strong">
                {idx + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="grid min-w-0 gap-4">
          <QueryState loading={events.isLoading} error={events.error}>
            {events.data?.events.length === 0 && (
              <Card>
                <p className="text-sm text-muted">{E.empty}</p>
              </Card>
            )}
            <ul className="grid gap-3">
              {events.data?.events.map((e) => {
                const publicVisible =
                  e.isActive && e.visibility === "published" && !e.hiddenFromPublic;
                return (
                  <li key={e.id}>
                    <Card className={cn(e.isActive && "border-primary")}>
                      <div className="grid gap-3">
                        <div className="grid gap-1.5">
                          <Link
                            to={`/admin/e/${e.id}`}
                            className="font-display text-lg font-extrabold underline-offset-2 hover:underline"
                          >
                            {e.name}
                          </Link>
                          <EventBadges event={e} />
                          <p className="text-xs text-muted">
                            {formatDateTime(e.schedule.eventStartAt, e.timezone)} –{" "}
                            {formatDateTime(e.schedule.eventEndAt, e.timezone)}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 border-t-(length:--border-w) border-line pt-3">
                          <Link
                            to={`/admin/e/${e.id}`}
                            className="group inline-flex items-center gap-1.5 rounded-chip border-(length:--border-w) border-line bg-surface px-3.5 py-1.5 text-sm font-bold text-text hover:bg-surface-tint"
                          >
                            <Icon name="trophy" className="size-4" />
                            <span>{E.manage}</span>
                          </Link>
                          <Link
                            to={`/admin/e/${e.id}/booths`}
                            className="group inline-flex items-center gap-1.5 rounded-chip border-(length:--border-w) border-line bg-surface px-3.5 py-1.5 text-sm font-bold text-text hover:bg-surface-tint"
                          >
                            <Icon name="store" className="size-4" />
                            <span>{E.booths}</span>
                          </Link>
                          {!publicVisible && (
                            <ActionButton
                              size="sm"
                              variant="primary"
                              action={async (ctx) => {
                                await adminApi.eventAction(e.id, "activate", ctx);
                                await qc.invalidateQueries({ queryKey: adminKeys.events });
                              }}
                            >
                              {E.activate}
                            </ActionButton>
                          )}
                        </div>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          </QueryState>
        </div>

        <Card title={E.create} className="min-w-0">
          <Field label={E.name} hint={E.nameHint}>
            {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))] gap-3">
            <Field label={E.highlight} hint={E.highlightHint}>
              {(id) => (
                <Input id={id} value={highlight} onChange={(e) => setHighlight(e.target.value)} />
              )}
            </Field>
            <Field label={E.timezone}>
              {(id) => (
                <Select id={id} value={zone} onChange={(e) => setZone(e.target.value)}>
                  {ZONES.map((z) => (
                    <option key={z} value={z}>
                      {copy.admin.zoneNames[z]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <ScheduleFields values={schedule} onChange={setSchedule} timeZone={zone} now={now} />
          <div>
            <ActionButton
              variant="primary"
              disabled={!canCreate}
              resetOn={`${name}|${highlight}|${zone}|${JSON.stringify(schedule)}`}
              action={async (ctx) => {
                if (!parsed.value) return;
                await adminApi.createEvent(
                  {
                    name,
                    titleHighlight: highlight,
                    timezone: zone,
                    ...parsed.value,
                  },
                  ctx,
                );
                setName("");
                setHighlight("");
                setSchedule(emptySchedule);
                await qc.invalidateQueries({ queryKey: adminKeys.events });
              }}
            >
              {E.createButton}
            </ActionButton>
          </div>
        </Card>
      </div>
    </>
  );
}
