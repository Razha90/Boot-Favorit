import type { AdminEventView, CategoryView } from "@shared/api-types";
import { epochToZonedLocal } from "@shared/timezone";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { ActionButton } from "../../../components/ui/ActionButton";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Field, Input, Select } from "../../../components/ui/Form";
import { copy } from "../../../lib/copy";
import { adminApi, adminKeys } from "../api";
import { EventBadges, QueryState } from "../components/bits";
import { EventMediaCard } from "../components/EventMediaCard";
import { ResultsCard } from "../components/ResultsCard";
import { parseSchedule, ScheduleFields, type ScheduleValues } from "../components/ScheduleFields";

const DAY = 86_400_000;

export function Component() {
  const { id = "" } = useParams();
  const event = useQuery({ queryKey: adminKeys.event(id), queryFn: () => adminApi.event(id) });
  return (
    <QueryState loading={event.isLoading} error={event.error}>
      {event.data && <EventEditor key={event.data.event.updatedAt} event={event.data.event} />}
    </QueryState>
  );
}

function EventEditor({ event }: { event: AdminEventView }) {
  const qc = useQueryClient();
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: adminKeys.event(event.id) });
    await qc.invalidateQueries({ queryKey: adminKeys.events });
  };

  const [name, setName] = useState(event.name);
  const [highlight, setHighlight] = useState(event.titleHighlight ?? "");
  const [maxProducts, setMaxProducts] = useState(String(event.settings.maxProducts ?? ""));
  const [allowLate, setAllowLate] = useState(event.settings.allowLateRegistration ?? true);
  const [authMode, setAuthMode] = useState(event.settings.reviewerAuthMode ?? "google_or_email");
  const [schedule, setSchedule] = useState<ScheduleValues>({
    open: event.schedule.registrationOpenAt
      ? epochToZonedLocal(event.schedule.registrationOpenAt, event.timezone)
      : "",
    close: epochToZonedLocal(event.schedule.registrationCloseAt, event.timezone),
    start: epochToZonedLocal(event.schedule.eventStartAt, event.timezone),
    end: epochToZonedLocal(event.schedule.eventEndAt, event.timezone),
  });
  const parsed = parseSchedule(schedule, event.timezone);
  const now = Date.now();

  const publicVisible =
    event.isActive && event.visibility === "published" && !event.hiddenFromPublic;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-2">
          <Link to="/admin" className="text-sm text-muted underline">
            ← {copy.admin.nav.events}
          </Link>
          <h1 className="font-display text-3xl font-extrabold">{event.name}</h1>
          <EventBadges event={event} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/admin/e/${event.id}/booths`}
            className="rounded-chip border-(length:--border-w) border-line px-4 py-2 text-sm font-bold"
          >
            {copy.admin.events.booths}
          </Link>
          <Link
            to={`/admin/e/${event.id}/moderation`}
            className="rounded-chip border-(length:--border-w) border-line px-4 py-2 text-sm font-bold"
          >
            {copy.admin.moderation.open}
          </Link>
          {!publicVisible && (
            <ActionButton
              variant="primary"
              action={async (ctx) => {
                await adminApi.eventAction(event.id, "activate", ctx);
                await refresh();
              }}
            >
              {copy.admin.events.activate}
            </ActionButton>
          )}
          {event.isActive && (
            <ActionButton
              action={async (ctx) => {
                await adminApi.eventAction(
                  event.id,
                  event.hiddenFromPublic ? "unhide" : "hide",
                  ctx,
                );
                await refresh();
              }}
            >
              {event.hiddenFromPublic ? copy.admin.events.unhide : copy.admin.events.hide}
            </ActionButton>
          )}
        </div>
      </div>

      <Card title={copy.admin.event.identity}>
        <Field label={copy.admin.events.name}>
          {(fid) => <Input id={fid} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label={copy.admin.events.highlight} hint={copy.admin.events.highlightHint}>
          {(fid) => (
            <Input id={fid} value={highlight} onChange={(e) => setHighlight(e.target.value)} />
          )}
        </Field>
        <div>
          <ActionButton
            variant="primary"
            disabled={name.trim() === ""}
            resetOn={`${name}|${highlight}`}
            action={async () => {
              await adminApi.updateEvent(event.id, { name, titleHighlight: highlight });
              await refresh();
            }}
          >
            {copy.admin.common.save}
          </ActionButton>
        </div>
      </Card>

      <Card title={copy.admin.event.schedule}>
        <ScheduleFields
          values={schedule}
          onChange={setSchedule}
          timeZone={event.timezone}
          allowLate={allowLate}
          now={now}
        />
        {event.warnings.length > 0 && (
          <p className="text-xs text-muted">{copy.admin.event.savedWarnings}</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <ActionButton
            variant="primary"
            disabled={!parsed.value}
            resetOn={JSON.stringify(schedule)}
            action={async () => {
              if (!parsed.value) return;
              await adminApi.updateEvent(event.id, parsed.value);
              await refresh();
            }}
          >
            {copy.admin.event.saveSchedule}
          </ActionButton>
          <ActionButton
            action={async (ctx) => {
              await adminApi.eventAction(event.id, "close-registration", ctx);
              await refresh();
            }}
          >
            {copy.admin.event.closeNow}
          </ActionButton>
          {[
            [copy.admin.event.extendDay, DAY],
            [copy.admin.event.extendWeek, 7 * DAY],
          ].map(([label, ms]) => (
            <ActionButton
              key={String(label)}
              action={async (ctx) => {
                await adminApi.extendRegistration(event.id, Number(ms), ctx);
                await refresh();
              }}
            >
              {label}
            </ActionButton>
          ))}
        </div>
      </Card>

      <Card title={copy.admin.event.settings}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label={copy.admin.event.maxProducts}
            hint={copy.admin.event.maxProductsHint}
            error={
              maxProducts !== "" &&
              !(Number.isInteger(+maxProducts) && +maxProducts >= 1 && +maxProducts <= 100)
                ? copy.admin.event.maxProductsError
                : null
            }
          >
            {(fid) => (
              <Input
                id={fid}
                inputMode="numeric"
                value={maxProducts}
                placeholder="24"
                onChange={(e) => setMaxProducts(e.target.value)}
              />
            )}
          </Field>
          <label className="flex items-center gap-2 self-end text-sm">
            <input
              type="checkbox"
              checked={allowLate}
              onChange={(e) => setAllowLate(e.target.checked)}
            />
            {copy.admin.event.allowLate}
          </label>
          <Field
            label={copy.admin.event.authMode}
            hint={copy.admin.event.authModeHint}
            className="sm:col-span-2"
          >
            {(fid) => (
              <Select
                id={fid}
                value={authMode}
                onChange={(e) => setAuthMode(e.target.value as typeof authMode)}
              >
                {(["google_or_email", "ticket_code", "open_turnstile"] as const).map((m) => (
                  <option key={m} value={m}>
                    {copy.admin.event.authModes[m]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <div>
          <ActionButton
            variant="primary"
            resetOn={`${maxProducts}|${allowLate}|${authMode}`}
            action={async () => {
              const settings: Record<string, unknown> = {
                allowLateRegistration: allowLate,
                reviewerAuthMode: authMode,
              };
              if (maxProducts !== "") settings.maxProducts = Number(maxProducts);
              await adminApi.updateEvent(event.id, { settings });
              await refresh();
            }}
          >
            {copy.admin.common.save}
          </ActionButton>
        </div>
      </Card>

      <ResultsCard event={event} />

      <EventMediaCard event={event} refresh={refresh} />

      <CategoriesCard eventId={event.id} />
    </>
  );
}

// ---------- Kategori ulasan (A5) ----------

interface DraftCategory {
  id?: string;
  label: string;
  active: boolean;
}

function CategoriesCard({ eventId }: { eventId: string }) {
  const q = useQuery({
    queryKey: adminKeys.categories(eventId),
    queryFn: () => adminApi.categories(eventId),
  });
  return (
    <Card title={copy.admin.event.categories}>
      <p className="text-sm text-muted">{copy.admin.event.categoriesHint}</p>
      <QueryState loading={q.isLoading} error={q.error}>
        {q.data && <CategoriesEditor eventId={eventId} initial={q.data.categories} />}
      </QueryState>
    </Card>
  );
}

function CategoriesEditor({ eventId, initial }: { eventId: string; initial: CategoryView[] }) {
  const qc = useQueryClient();
  const [items, setItems] = useState<DraftCategory[]>(() =>
    initial
      .filter((c) => c.active === 1)
      .concat(initial.filter((c) => c.active !== 1))
      .map((c) => ({ id: c.id, label: c.label, active: c.active === 1 })),
  );
  const update = (i: number, patch: Partial<DraftCategory>) =>
    setItems((l) => l.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const move = (i: number, d: -1 | 1) =>
    setItems((l) => {
      const j = i + d;
      if (j < 0 || j >= l.length) return l;
      const next = [...l];
      [next[i], next[j]] = [next[j] as DraftCategory, next[i] as DraftCategory];
      return next;
    });
  const invalid = items.some((c) => c.label.trim() === "");

  return (
    <div className="grid gap-2">
      {items.map((c, i) => (
        // Urutan adalah data; id kategori lama stabil, yang baru memakai indeks.
        <div key={c.id ?? `baru-${i}`} className="flex items-center gap-2">
          <Input
            aria-label={copy.admin.event.categoryLabel}
            value={c.label}
            maxLength={30}
            onChange={(e) => update(i, { label: e.target.value })}
          />
          <label className="flex shrink-0 items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={c.active}
              onChange={(e) => update(i, { active: e.target.checked })}
            />
            {copy.admin.event.categoryActive}
          </label>
          <Button
            size="sm"
            aria-label={copy.admin.common.moveUp}
            onClick={() => move(i, -1)}
            disabled={i === 0}
          >
            ↑
          </Button>
          <Button
            size="sm"
            aria-label={copy.admin.common.moveDown}
            onClick={() => move(i, 1)}
            disabled={i === items.length - 1}
          >
            ↓
          </Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Button
          onClick={() => setItems((l) => [...l, { label: "", active: true }])}
          disabled={items.length >= 20}
        >
          {copy.admin.event.addCategory}
        </Button>
        <ActionButton
          variant="primary"
          disabled={invalid}
          resetOn={JSON.stringify(items)}
          action={async (ctx) => {
            await adminApi.saveCategories(
              eventId,
              items.map((c) => ({ ...c, label: c.label.trim() })),
              ctx,
            );
            await qc.invalidateQueries({ queryKey: adminKeys.categories(eventId) });
          }}
        >
          {copy.admin.common.save}
        </ActionButton>
      </div>
    </div>
  );
}
