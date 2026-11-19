import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { ActionButton } from "../../../components/ui/ActionButton";
import { Card } from "../../../components/ui/Card";
import { Field, Input, Select } from "../../../components/ui/Form";
import { QueryState } from "../../../components/ui/states";
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

  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">{copy.admin.events.title}</h1>

      <QueryState loading={events.isLoading} error={events.error}>
        {events.data?.events.length === 0 && (
          <p className="text-sm text-muted">{copy.admin.events.empty}</p>
        )}
        <ul className="grid gap-3">
          {events.data?.events.map((e) => (
            <li key={e.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="grid gap-1">
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
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to={`/admin/e/${e.id}/booths`}
                      className="rounded-chip border-(length:--border-w) border-line px-4 py-2 text-sm font-bold"
                    >
                      {copy.admin.events.booths}
                    </Link>
                    {!(e.isActive && e.visibility === "published" && !e.hiddenFromPublic) && (
                      <ActionButton
                        variant="primary"
                        action={async (ctx) => {
                          await adminApi.eventAction(e.id, "activate", ctx);
                          await qc.invalidateQueries({ queryKey: adminKeys.events });
                        }}
                      >
                        {copy.admin.events.activate}
                      </ActionButton>
                    )}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </QueryState>

      <Card title={copy.admin.events.create}>
        <Field label={copy.admin.events.name} hint={copy.admin.events.nameHint}>
          {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={copy.admin.events.highlight} hint={copy.admin.events.highlightHint}>
            {(id) => (
              <Input id={id} value={highlight} onChange={(e) => setHighlight(e.target.value)} />
            )}
          </Field>
          <Field label={copy.admin.events.timezone}>
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
            {copy.admin.events.createButton}
          </ActionButton>
        </div>
      </Card>
    </>
  );
}
