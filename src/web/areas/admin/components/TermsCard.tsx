import type { AdminTerm, ModerationTestResult } from "@shared/api-types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActionButton } from "../../../components/ui/ActionButton";
import { Badge, Card } from "../../../components/ui/Card";
import { Field, Input, Select, Textarea } from "../../../components/ui/Form";
import { copy } from "../../../lib/copy";
import { moderationApi, moderationKeys } from "../moderation-api";
import { QueryState } from "./bits";
import { MIN_REASON } from "./ReasonedActions";

const M = copy.admin.moderation;
const T = M.terms;

type Draft = Pick<AdminTerm, "term" | "severity" | "kind" | "match" | "enabled" | "lang">;
const NEW: Draft = {
  term: "",
  severity: "mild",
  kind: "block",
  match: "word",
  enabled: true,
  lang: "id",
};

/** "Uji kalimat ini": hasil filter lengkap (termasuk istilah yang tertangkap) hanya terlihat admin. */
function TestSentence({ eventId }: { eventId: string }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ModerationTestResult | null>(null);
  return (
    <div className="grid gap-2">
      <Field label={T.test} hint={T.testHint}>
        {(id) => (
          <Textarea
            id={id}
            value={text}
            maxLength={560}
            onChange={(e) => setText(e.target.value)}
          />
        )}
      </Field>
      <div>
        <ActionButton
          size="sm"
          disabled={text.trim() === ""}
          resetOn={text}
          action={async () => setResult(await moderationApi.test(eventId, text))}
        >
          {T.testButton}
        </ActionButton>
      </div>
      {result && (
        <div role="status" className="grid gap-1 text-sm">
          <Badge tone={result.status === "visible" ? "primary" : "accent"}>
            {T.result[result.status]}
          </Badge>
          {result.masked && <p>{result.masked}</p>}
          {result.contact && <p className="text-xs">{T.contact}</p>}
          {result.matched.length > 0 && (
            <p className="text-xs text-muted">
              {T.matched}: {result.matched.join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function TermsCard({ eventId }: { eventId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: moderationKeys.terms(eventId),
    queryFn: () => moderationApi.terms(eventId),
  });
  const [draft, setDraft] = useState<Draft>(NEW);
  const [reason, setReason] = useState("");
  const reasonOk = reason.trim().length >= MIN_REASON;
  const refresh = () => qc.invalidateQueries({ queryKey: moderationKeys.terms(eventId) });
  const terms = q.data?.terms ?? [];

  return (
    <Card title={M.tabs.terms}>
      <p className="text-sm text-muted">{T.hint}</p>
      <Field label={M.reason} hint={M.reasonHint}>
        {(id) => (
          <Input
            id={id}
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
          />
        )}
      </Field>

      <div className="grid gap-3 sm:grid-cols-5">
        <Field label={T.term} className="sm:col-span-2">
          {(id) => (
            <Input
              id={id}
              value={draft.term}
              maxLength={40}
              onChange={(e) => setDraft({ ...draft, term: e.target.value })}
            />
          )}
        </Field>
        <Field label={T.severity}>
          {(id) => (
            <Select
              id={id}
              value={draft.severity}
              onChange={(e) =>
                setDraft({ ...draft, severity: e.target.value as Draft["severity"] })
              }
            >
              <option value="mild">{T.mild}</option>
              <option value="severe">{T.severe}</option>
            </Select>
          )}
        </Field>
        <Field label={T.kind}>
          {(id) => (
            <Select
              id={id}
              value={draft.kind}
              onChange={(e) => setDraft({ ...draft, kind: e.target.value as Draft["kind"] })}
            >
              <option value="block">{T.block}</option>
              <option value="allow">{T.allow}</option>
            </Select>
          )}
        </Field>
        <Field label={T.match}>
          {(id) => (
            <Select
              id={id}
              value={draft.match}
              onChange={(e) => setDraft({ ...draft, match: e.target.value as Draft["match"] })}
            >
              <option value="word">{T.word}</option>
              <option value="contains">{T.contains}</option>
            </Select>
          )}
        </Field>
      </div>
      <div>
        <ActionButton
          variant="primary"
          disabled={draft.term.trim().length < 2 || !reasonOk}
          resetOn={`${JSON.stringify(draft)}|${reason}`}
          action={async (ctx) => {
            await moderationApi.saveTerms(
              eventId,
              [{ ...draft, term: draft.term.trim() }],
              reason.trim(),
              ctx,
            );
            setDraft(NEW);
            await refresh();
          }}
        >
          {T.add}
        </ActionButton>
      </div>

      <TestSentence eventId={eventId} />

      <QueryState loading={q.isLoading} error={q.error}>
        <ul className="grid max-h-96 gap-1 overflow-y-auto text-sm">
          {terms.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center gap-2 border-b border-line/30 py-1"
            >
              <strong className="min-w-24 [overflow-wrap:anywhere]">{t.term}</strong>
              <Badge
                tone={
                  t.kind === "allow" ? "primary" : t.severity === "severe" ? "danger" : "accent"
                }
              >
                {t.kind === "allow" ? T.allow : t.severity === "severe" ? T.severe : T.mild}
              </Badge>
              <span className="text-xs text-muted">{t.match === "word" ? T.word : T.contains}</span>
              {t.source && (
                <span className="text-xs text-muted">
                  {T.source}: {t.source}
                </span>
              )}
              <ActionButton
                size="sm"
                variant="ghost"
                className="ml-auto"
                disabled={!reasonOk}
                resetOn={reason}
                aria-label={`${T.toggle}: ${t.term}`}
                action={async (ctx) => {
                  await moderationApi.saveTerms(
                    eventId,
                    [{ ...t, enabled: !t.enabled }],
                    reason.trim(),
                    ctx,
                  );
                  await refresh();
                }}
              >
                {t.enabled ? T.enabled : T.disabled}
              </ActionButton>
            </li>
          ))}
        </ul>
      </QueryState>
    </Card>
  );
}
