import type { AdminEventView, CategoryView } from "@shared/api-types";
import { epochToZonedLocal } from "@shared/timezone";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { ActionButton } from "../../../components/ui/ActionButton";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Field, Input } from "../../../components/ui/Form";
import { Icon, type IconName } from "../../../components/ui/Icon";
import { QueryState } from "../../../components/ui/states";
import { cn } from "../../../lib/cn";
import { copy } from "../../../lib/copy";
import { formatDateTime } from "../../../lib/format";
import { adminApi, adminKeys } from "../api";
import { EventBadges } from "../components/bits";
import { EventMediaCard } from "../components/EventMediaCard";
import { ResultsCard } from "../components/ResultsCard";
import { parseSchedule, ScheduleFields, type ScheduleValues } from "../components/ScheduleFields";
import { dataApi, dataKeys } from "../data-api";

const DAY = 86_400_000;
const TABS = ["overview", "identity", "schedule", "categories"] as const;
type EventTab = (typeof TABS)[number];

const TAB_ICON: Record<EventTab, IconName> = {
  overview: "trophy",
  identity: "image",
  schedule: "calendar",
  categories: "sliders",
};

const isEventTab = (v: string | null): v is EventTab =>
  v !== null && (TABS as readonly string[]).includes(v);

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
  const [params, setParams] = useSearchParams();
  const rawTab = params.get("tab");
  const tab: EventTab = isEventTab(rawTab) ? rawTab : "overview";
  const selectTab = (next: EventTab) =>
    setParams(next === "overview" ? {} : { tab: next }, { replace: true });

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: adminKeys.event(event.id) });
    await qc.invalidateQueries({ queryKey: adminKeys.events });
  };

  const healthQuery = useQuery({
    queryKey: dataKeys.health(event.id),
    queryFn: () => dataApi.health(event.id),
    refetchInterval: 20_000,
  });
  const boothsQuery = useQuery({
    queryKey: adminKeys.booths(event.id),
    queryFn: () => adminApi.booths(event.id),
  });

  const [name, setName] = useState(event.name);
  const [highlight, setHighlight] = useState(event.titleHighlight ?? "");
  const [maxProducts, setMaxProducts] = useState(String(event.settings.maxProducts ?? ""));
  const [allowLate, setAllowLate] = useState(event.settings.allowLateRegistration ?? true);
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
  const health = healthQuery.data;
  const boothList = boothsQuery.data?.booths ?? [];
  const approvedBooths = boothList.filter((b) => b.status === "approved").length;
  const pendingBooths =
    health?.pendingBooths ?? boothList.filter((b) => b.status === "pending").length;
  const modPending = (health?.openReports ?? 0) + (health?.heldReviews ?? 0);

  const E = copy.admin.event;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1.5">
          <h1 className="font-display text-2xl font-extrabold sm:text-3xl">{event.name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <EventBadges event={event} />
            <span className="text-xs text-muted">
              {formatDateTime(event.schedule.eventStartAt, event.timezone)} –{" "}
              {formatDateTime(event.schedule.eventEndAt, event.timezone)}
            </span>
          </div>
        </div>
      </div>

      {/* Ringkasan angka kunci hari-H agar panitia langsung paham kondisi event */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Link
          to={`/admin/e/${event.id}/booths`}
          className="grid gap-1 rounded-card border-(length:--border-w) border-line bg-surface-raised p-4 transition-colors hover:border-primary"
        >
          <span className="flex items-center justify-between text-xs font-bold text-muted">
            <span>{E.kpi.booths}</span>
            <Icon name="store" className="size-4 text-primary-strong" />
          </span>
          <span className="font-display text-2xl font-extrabold">{boothList.length}</span>
          <span
            className={cn(
              "text-xs font-semibold",
              pendingBooths > 0 ? "text-accent-strong" : "text-muted",
            )}
          >
            {pendingBooths > 0
              ? E.kpi.boothsPending(pendingBooths)
              : E.kpi.boothsReady(approvedBooths)}
          </span>
        </Link>

        <Link
          to={`/admin/e/${event.id}/moderation`}
          className="grid gap-1 rounded-card border-(length:--border-w) border-line bg-surface-raised p-4 transition-colors hover:border-primary"
        >
          <span className="flex items-center justify-between text-xs font-bold text-muted">
            <span>{E.kpi.reviews}</span>
            <Icon name="shield" className="size-4 text-primary-strong" />
          </span>
          <span className="font-display text-2xl font-extrabold">
            {health?.totalReviews ?? "—"}
          </span>
          <span
            className={cn("text-xs font-semibold", modPending > 0 ? "text-danger" : "text-muted")}
          >
            {modPending > 0 ? E.kpi.reviewsPending(modPending) : E.kpi.reviewsClean}
          </span>
        </Link>

        <Link
          to={`/admin/e/${event.id}/logs`}
          className="grid gap-1 rounded-card border-(length:--border-w) border-line bg-surface-raised p-4 transition-colors hover:border-primary"
        >
          <span className="flex items-center justify-between text-xs font-bold text-muted">
            <span>{E.kpi.live}</span>
            <Icon name="activity" className="size-4 text-primary-strong" />
          </span>
          <span className="font-display text-2xl font-extrabold">
            {health ? health.liveViewers + health.liveScreens : "—"}
          </span>
          <span className="text-xs text-muted">
            {health
              ? E.kpi.liveDetail(health.liveViewers, health.liveScreens)
              : copy.admin.common.loading}
          </span>
        </Link>

        <div className="grid gap-1 rounded-card border-(length:--border-w) border-line bg-surface-raised p-4">
          <span className="flex items-center justify-between text-xs font-bold text-muted">
            <span>{E.kpi.results}</span>
            <Icon name="trophy" className="size-4 text-primary-strong" />
          </span>
          <span className="font-display text-lg font-extrabold">
            {event.resultsPublishedAt ? E.kpi.resultsPublished : E.kpi.resultsDraft}
          </span>
          <span className="text-xs text-muted">{copy.admin.results.modes[event.rankingMode]}</span>
        </div>
      </div>

      {/* Tab tugas di dalam halaman pengaturan event agar tidak menumpuk ke bawah */}
      <div
        role="tablist"
        aria-label={event.name}
        className="flex flex-wrap gap-2 border-b-(length:--border-w) border-line pb-3"
      >
        {TABS.map((t) => (
          <Button
            key={t}
            role="tab"
            icon={TAB_ICON[t]}
            aria-selected={tab === t}
            variant={tab === t ? "primary" : "secondary"}
            onClick={() => selectTab(t)}
          >
            {E.tabs[t]}
          </Button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_310px]">
          <ResultsCard event={event} />

          <Card title={E.checklist.title}>
            <ul className="grid gap-2.5 text-sm">
              <li className="flex items-start gap-2">
                <Icon
                  name={publicVisible ? "check" : "warning"}
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    publicVisible ? "text-primary-strong" : "text-accent-strong",
                  )}
                />
                <span>{publicVisible ? E.checklist.publicOn : E.checklist.publicOff}</span>
              </li>
              <li className="flex items-start gap-2">
                <Icon
                  name={approvedBooths > 0 ? "check" : "warning"}
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    approvedBooths > 0 ? "text-primary-strong" : "text-accent-strong",
                  )}
                />
                <Link to={`/admin/e/${event.id}/booths`} className="hover:underline">
                  {E.checklist.boothsCount(approvedBooths, boothList.length)}
                </Link>
              </li>
              <li className="flex items-start gap-2">
                <Icon
                  name={modPending === 0 ? "check" : "warning"}
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    modPending === 0 ? "text-primary-strong" : "text-danger",
                  )}
                />
                <Link to={`/admin/e/${event.id}/moderation`} className="hover:underline">
                  {E.checklist.moderationCount(modPending)}
                </Link>
              </li>
              <li className="flex items-start gap-2">
                <Icon name="qr" className="mt-0.5 size-4 shrink-0 text-primary-strong" />
                <Link to={`/admin/e/${event.id}/posters`} className="hover:underline">
                  {E.checklist.postersHint}
                </Link>
              </li>
            </ul>

            <div className="grid gap-2 border-t-(length:--border-w) border-line pt-3">
              <Button variant="secondary" icon="image" onClick={() => selectTab("identity")}>
                {E.tabs.identity}
              </Button>
              <Button variant="secondary" icon="calendar" onClick={() => selectTab("schedule")}>
                {E.tabs.schedule}
              </Button>
              <Button variant="secondary" icon="sliders" onClick={() => selectTab("categories")}>
                {E.tabs.categories}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {tab === "identity" && (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <Card title={E.identity}>
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

          <EventMediaCard event={event} refresh={refresh} />
        </div>
      )}

      {tab === "schedule" && (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <Card title={E.schedule}>
            <ScheduleFields
              values={schedule}
              onChange={setSchedule}
              timeZone={event.timezone}
              allowLate={allowLate}
              now={now}
            />
            {event.warnings.length > 0 && <p className="text-xs text-muted">{E.savedWarnings}</p>}
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
                {E.saveSchedule}
              </ActionButton>
              <ActionButton
                action={async (ctx) => {
                  await adminApi.eventAction(event.id, "close-registration", ctx);
                  await refresh();
                }}
              >
                {E.closeNow}
              </ActionButton>
              {[
                [E.extendDay, DAY],
                [E.extendWeek, 7 * DAY],
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

          <Card title={E.settings}>
            <div className="grid gap-3">
              <Field
                label={E.maxProducts}
                info={E.maxProductsInfo}
                error={
                  maxProducts !== "" &&
                  !(Number.isInteger(+maxProducts) && +maxProducts >= 1 && +maxProducts <= 100)
                    ? E.maxProductsError
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
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={allowLate}
                  onChange={(e) => setAllowLate(e.target.checked)}
                />
                {E.allowLate}
              </label>
            </div>
            <div>
              <ActionButton
                variant="primary"
                resetOn={`${maxProducts}|${allowLate}`}
                action={async () => {
                  const settings: Record<string, unknown> = {
                    allowLateRegistration: allowLate,
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
        </div>
      )}

      {tab === "categories" && <CategoriesCard eventId={event.id} />}
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
            icon={false}
            aria-label={copy.admin.common.moveUp}
            onClick={() => move(i, -1)}
            disabled={i === 0}
          >
            <Icon name="arrow-up" />
          </Button>
          <Button
            size="sm"
            icon={false}
            aria-label={copy.admin.common.moveDown}
            onClick={() => move(i, 1)}
            disabled={i === items.length - 1}
          >
            <Icon name="arrow-down" />
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
