import { getEventState, scheduleWarnings } from "@shared/event-state";
import { scheduleSchema } from "@shared/schemas";
import { zonedLocalToEpoch } from "@shared/timezone";
import { Field, Input } from "../../../components/ui/Form";
import { copy } from "../../../lib/copy";
import { formatRelative } from "../../../lib/format";

export interface ScheduleValues {
  open: string;
  close: string;
  start: string;
  end: string;
}

export interface ParsedSchedule {
  registrationOpenAt: number | null;
  registrationCloseAt: number;
  eventStartAt: number;
  eventEndAt: number;
}

/** Nilai form (waktu lokal di zona waktu event) → epoch, beserta galat bahasa Indonesia. */
export function parseSchedule(
  v: ScheduleValues,
  timeZone: string,
): { value: ParsedSchedule | null; errors: string[] } {
  const open = v.open ? zonedLocalToEpoch(v.open, timeZone) : null;
  const close = zonedLocalToEpoch(v.close, timeZone);
  const start = zonedLocalToEpoch(v.start, timeZone);
  const end = zonedLocalToEpoch(v.end, timeZone);
  if (close === null || start === null || end === null || (v.open && open === null)) {
    return { value: null, errors: [copy.admin.schedule.incomplete] };
  }
  const value = {
    registrationOpenAt: open,
    registrationCloseAt: close,
    eventStartAt: start,
    eventEndAt: end,
  };
  const parsed = scheduleSchema.safeParse(value);
  if (parsed.success) return { value, errors: [] };
  const known = copy.admin.schedule.errors as Record<string, string>;
  return {
    value: null,
    errors: parsed.error.issues.map((i) => known[i.message] ?? copy.errors.validation_error),
  };
}

export function ScheduleFields({
  values,
  onChange,
  timeZone,
  allowLate = true,
  now,
}: {
  values: ScheduleValues;
  onChange: (next: ScheduleValues) => void;
  timeZone: string;
  allowLate?: boolean;
  now: number;
}) {
  const { value, errors } = parseSchedule(values, timeZone);
  const set = (k: keyof ScheduleValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...values, [k]: e.target.value });

  const state =
    value &&
    getEventState({ ...value, resultsPublishedAt: null, allowLateRegistration: allowLate }, now);
  const warnings = value ? scheduleWarnings(value, now) : [];
  const anyFilled = Boolean(values.open || values.close || values.start || values.end);

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-3">
        <Field label={copy.admin.schedule.open} info={copy.admin.schedule.openInfo}>
          {(id) => (
            <Input id={id} type="datetime-local" value={values.open} onChange={set("open")} />
          )}
        </Field>
        <Field label={copy.admin.schedule.close}>
          {(id) => (
            <Input id={id} type="datetime-local" value={values.close} onChange={set("close")} />
          )}
        </Field>
        <Field label={copy.admin.schedule.start} info={copy.admin.schedule.startInfo}>
          {(id) => (
            <Input id={id} type="datetime-local" value={values.start} onChange={set("start")} />
          )}
        </Field>
        <Field label={copy.admin.schedule.end} info={copy.admin.schedule.endInfo}>
          {(id) => <Input id={id} type="datetime-local" value={values.end} onChange={set("end")} />}
        </Field>
      </div>
      <p className="text-xs text-muted">{copy.admin.schedule.zone(timeZone)}</p>

      {anyFilled &&
        errors.map((e) => (
          <p key={e} role="alert" className="text-sm text-danger">
            {e}
          </p>
        ))}

      {value && state && (
        <p
          className="rounded-card bg-surface-tint px-3 py-2 text-sm"
          data-testid="schedule-preview"
        >
          {copy.admin.schedule.preview({
            registrationOpen: state.registrationAccepting,
            closeRelative: formatRelative(value.registrationCloseAt, now),
            startRelative: formatRelative(value.eventStartAt, now),
            endRelative: formatRelative(value.eventEndAt, now),
          })}
        </p>
      )}
      {warnings.map((w) => (
        <p key={w} className="text-sm text-accent-strong">
          {copy.admin.schedule.warnings[w]}
        </p>
      ))}
    </div>
  );
}
