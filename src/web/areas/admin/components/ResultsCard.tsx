import type { AdminEventView, DisplayMode } from "@shared/api-types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActionButton } from "../../../components/ui/ActionButton";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Field, Select } from "../../../components/ui/Form";
import { ConfirmDialog } from "../../../components/ui/Modal";
import { copy } from "../../../lib/copy";
import { formatDateTime, formatScore } from "../../../lib/format";
import { adminKeys } from "../api";
import { resultsApi, resultsKeys } from "../results-api";
import { QueryState } from "./bits";

const R = copy.admin.results;
const MODES: DisplayMode[] = ["visible", "hidden", "on_results"];

function ModeSelect({
  label,
  value,
  onSave,
  disabledVisible = false,
}: {
  label: string;
  value: DisplayMode;
  onSave: (mode: DisplayMode, ctx: { key: string }) => Promise<unknown>;
  disabledVisible?: boolean;
}) {
  const [mode, setMode] = useState(value);
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label={label}>
        {(id) => (
          <Select id={id} value={mode} onChange={(e) => setMode(e.target.value as DisplayMode)}>
            {MODES.map((m) => (
              <option key={m} value={m} disabled={m === "visible" && disabledVisible}>
                {R.modes[m]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <ActionButton
        size="sm"
        variant="primary"
        disabled={mode === value}
        resetOn={mode}
        action={(ctx) => onSave(mode, ctx)}
      >
        {copy.admin.common.save}
      </ActionButton>
    </div>
  );
}

/**
 * Hasil dan tampilan (A3, B20): mode rating/peringkat (ditegakkan server, bukan hanya disembunyikan di UI), umumkan
 * hasil (membekukan), perbarui hasil, dan putar animasi pemenang.
 */
export function ResultsCard({ event }: { event: AdminEventView }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: resultsKeys.view(event.id),
    queryFn: () => resultsApi.view(event.id),
  });
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: resultsKeys.view(event.id) });
    await qc.invalidateQueries({ queryKey: adminKeys.event(event.id) });
  };
  const [confirm, setConfirm] = useState<"publish" | "refresh" | "reveal" | null>(null);
  const [target, setTarget] = useState<"screen" | "everyone">("screen");
  const ended = event.state.phase === "ended";
  const view = q.data;

  const run = async (ctx: { key: string }) => {
    if (confirm === "publish") await resultsApi.publish(event.id, ctx);
    if (confirm === "refresh") await resultsApi.refresh(event.id, ctx);
    if (confirm === "reveal") await resultsApi.reveal(event.id, target, ctx);
    await refresh();
  };

  return (
    <Card title={R.title}>
      <p className="text-sm text-muted">{R.hint}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <ModeSelect
          label={R.ratingsMode}
          value={event.ratingsMode}
          onSave={async (m, ctx) => {
            await resultsApi.setRatingsMode(event.id, m, ctx);
            await refresh();
          }}
        />
        <div className="grid gap-1">
          <ModeSelect
            label={R.rankingMode}
            value={event.rankingMode}
            disabledVisible={event.ratingsMode === "hidden"}
            onSave={async (m, ctx) => {
              await resultsApi.setRankingMode(event.id, m, ctx);
              await refresh();
            }}
          />
          {event.ratingsMode === "hidden" && (
            <p className="text-xs text-muted">{R.rankingNeedsRatings}</p>
          )}
        </div>
      </div>

      <div className="grid gap-2">
        {event.resultsPublishedAt !== null ? (
          <p className="text-sm font-bold">
            {R.published(formatDateTime(event.resultsPublishedAt, event.timezone))}
          </p>
        ) : (
          <p className="text-sm text-muted">{ended ? R.publishHint : R.notEnded}</p>
        )}
        {view?.differs && (
          <p role="status" className="text-sm text-danger">
            {R.differs}
          </p>
        )}
        <div className="flex flex-wrap items-end gap-2">
          {event.resultsPublishedAt === null ? (
            <Button variant="primary" disabled={!ended} onClick={() => setConfirm("publish")}>
              {R.publish}
            </Button>
          ) : (
            <>
              <Button onClick={() => setConfirm("refresh")}>{R.refresh}</Button>
              <Field label={R.revealTarget}>
                {(id) => (
                  <Select
                    id={id}
                    value={target}
                    onChange={(e) => setTarget(e.target.value as typeof target)}
                  >
                    <option value="screen">{R.targets.screen}</option>
                    <option value="everyone">{R.targets.everyone}</option>
                  </Select>
                )}
              </Field>
              <Button variant="primary" onClick={() => setConfirm("reveal")}>
                {R.reveal}
              </Button>
            </>
          )}
        </div>
      </div>

      <QueryState loading={q.isLoading} error={q.error}>
        <ol className="grid gap-1 text-sm">
          {(view?.live ?? []).slice(0, 10).map((r) => (
            <li key={r.boothId} className="flex flex-wrap gap-2">
              <span className="w-8 font-bold">{r.rank ?? "–"}</span>
              <span className="min-w-40 [overflow-wrap:anywhere]">{r.name}</span>
              <span className="text-muted">
                {r.average === null
                  ? copy.visitor.noRatingsYet
                  : `${r.average.toFixed(2).replace(".", ",")} · ${copy.results.reviews(r.reviewCount)}`}
                {r.score !== null && ` · ${copy.results.score(formatScore(r.score))}`}
              </span>
            </li>
          ))}
          {(view?.live.length ?? 0) === 0 && <li className="text-muted">{R.none}</li>}
        </ol>
      </QueryState>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm === "publish" ? R.publish : confirm === "refresh" ? R.refresh : R.reveal}
        message={
          confirm === "publish"
            ? R.publishConfirm
            : confirm === "refresh"
              ? R.refreshConfirm
              : R.revealConfirm
        }
        confirmLabel={
          confirm === "publish" ? R.publish : confirm === "refresh" ? R.refresh : R.reveal
        }
        action={run}
      />
    </Card>
  );
}
