import type { AdminReportGroup, AdminReview } from "@shared/api-types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Card } from "../../../components/ui/Card";
import { Field, Select } from "../../../components/ui/Form";
import { QueryState } from "../../../components/ui/states";
import { copy } from "../../../lib/copy";
import { moderationApi, moderationKeys, type ReviewFilters } from "../moderation-api";
import { AdminReviewSummary } from "./AdminReviewSummary";
import { type ReasonedAction, ReasonedActions } from "./ReasonedActions";

const M = copy.admin.moderation;

const Item = ({ children }: { children: React.ReactNode }) => (
  <li className="grid gap-3 rounded-card border-(length:--border-w) border-line bg-surface-raised p-3">
    {children}
  </li>
);

function List({
  empty,
  children,
  count,
}: {
  empty: string;
  children: React.ReactNode;
  count: number;
}) {
  return count === 0 ? (
    <p className="text-sm text-muted">{empty}</p>
  ) : (
    <ul className="grid gap-3">{children}</ul>
  );
}

/** Antrean laporan: SARA/data pribadi di atas; keputusan berlaku untuk semua laporan pada komentar itu. */
export function QueueList({
  eventId,
  groups,
  done,
}: {
  eventId: string;
  groups: readonly AdminReportGroup[];
  done: () => Promise<unknown>;
}) {
  return (
    <List empty={M.emptyQueue} count={groups.length}>
      {groups.map((g) => {
        const first = g.reports[0];
        const decide =
          (
            decision: "upheld" | "dismissed",
            action: "none" | "hide_comment" | "hide_review" | "restore",
            lock = false,
          ): ReasonedAction["run"] =>
          async (reason, ctx) => {
            if (!first) return;
            await moderationApi.decide(eventId, first.id, { decision, action, lock, reason }, ctx);
            await done();
          };
        return (
          <Item key={g.review.id}>
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="accent">{M.reports(g.reports.length)}</Badge>
              {[...new Set(g.reports.map((r) => r.reason))].map((r) => (
                <Badge key={r}>{M.reasons[r]}</Badge>
              ))}
            </div>
            {g.suspiciousReporter && <p className="text-xs text-danger">{M.suspicious}</p>}
            <AdminReviewSummary review={g.review} />
            {g.reports.some((r) => r.note) && (
              <ul className="list-disc pl-5 text-xs text-muted">
                {g.reports
                  .filter((r) => r.note)
                  .map((r) => (
                    <li key={r.id}>{r.note}</li>
                  ))}
              </ul>
            )}
            <ReasonedActions
              actions={[
                {
                  id: "hide-comment",
                  label: M.actions.hideComment,
                  variant: "danger",
                  run: decide("upheld", "hide_comment"),
                },
                {
                  id: "hide-review",
                  label: M.actions.hideReview,
                  variant: "danger",
                  run: decide("upheld", "hide_review"),
                },
                { id: "keep", label: M.actions.keep, run: decide("dismissed", "none") },
                {
                  id: "keep-lock",
                  label: M.actions.keepLock,
                  run: decide("dismissed", "none", true),
                },
              ]}
            />
          </Item>
        );
      })}
    </List>
  );
}

/** Komentar/ulasan yang ditahan filter atau risiko dan menunggu keputusan (tanpa laporan). */
export function HeldList({
  eventId,
  reviews,
  done,
}: {
  eventId: string;
  reviews: readonly AdminReview[];
  done: () => Promise<unknown>;
}) {
  return (
    <List empty={M.emptyHeld} count={reviews.length}>
      {reviews.map((r) => (
        <Item key={r.id}>
          <AdminReviewSummary review={r} />
          <ReasonedActions
            actions={[
              {
                id: "restore",
                label: M.actions.restore,
                variant: "primary",
                run: async (reason, ctx) => {
                  await moderationApi.restore(eventId, r.id, reason, ctx);
                  await done();
                },
              },
              {
                id: "hide-comment",
                label: M.actions.hideComment,
                variant: "danger",
                run: async (reason, ctx) => {
                  await moderationApi.setCommentStatus(
                    eventId,
                    r.id,
                    { commentStatus: "hidden", reason },
                    ctx,
                  );
                  await done();
                },
              },
              {
                id: "hide-review",
                label: M.actions.hideReview,
                variant: "danger",
                run: async (reason, ctx) => {
                  await moderationApi.patchReview(eventId, r.id, { status: "hidden", reason }, ctx);
                  await done();
                },
              },
            ]}
          />
        </Item>
      ))}
    </List>
  );
}

/** Semua ulasan (termasuk yang ditahan/disembunyikan) dengan filter status dan bintang. */
export function AllReviewsCard({
  eventId,
  done,
}: {
  eventId: string;
  done: () => Promise<unknown>;
}) {
  const [status, setStatus] = useState("");
  const [stars, setStars] = useState("");
  const filters: ReviewFilters = { status, stars };
  const q = useQuery({
    queryKey: moderationKeys.reviews(eventId, JSON.stringify(filters)),
    queryFn: () => moderationApi.reviews(eventId, filters),
  });
  const reviews = q.data?.reviews ?? [];
  return (
    <Card title={M.tabs.all}>
      <div className="flex flex-wrap gap-3">
        <Field label={M.filters.status}>
          {(id) => (
            <Select id={id} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{copy.admin.common.all}</option>
              {(["visible", "held", "hidden"] as const).map((s) => (
                <option key={s} value={s}>
                  {M.status[s]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={M.filters.stars}>
          {(id) => (
            <Select id={id} value={stars} onChange={(e) => setStars(e.target.value)}>
              <option value="">{copy.admin.common.all}</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={String(n)}>
                  {n}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <QueryState loading={q.isLoading} error={q.error}>
        <List empty={M.emptyAll} count={reviews.length}>
          {reviews.map((r) => (
            <Item key={r.id}>
              <AdminReviewSummary review={r} />
              <ReasonedActions
                actions={[
                  {
                    id: "toggle",
                    label: r.status === "visible" ? M.actions.hideReview : M.actions.restore,
                    variant: r.status === "visible" ? "danger" : "primary",
                    run: async (reason, ctx) => {
                      if (r.status === "visible") {
                        await moderationApi.patchReview(
                          eventId,
                          r.id,
                          { status: "hidden", reason },
                          ctx,
                        );
                      } else {
                        await moderationApi.restore(eventId, r.id, reason, ctx);
                      }
                      await done();
                    },
                  },
                  {
                    id: "delete",
                    label: M.actions.delete,
                    variant: "danger",
                    run: async (reason, ctx) => {
                      await moderationApi.remove(eventId, r.id, reason, ctx);
                      await done();
                    },
                  },
                ]}
              />
            </Item>
          ))}
        </List>
      </QueryState>
    </Card>
  );
}
