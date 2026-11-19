import type { MyReview } from "@shared/api-types";
import { CONFIG } from "@shared/config";
import { useState } from "react";
import { RatingStars } from "../../../components/shared/RatingStars";
import { ActionButton } from "../../../components/ui/ActionButton";
import { Field, Textarea } from "../../../components/ui/Form";
import { Icon } from "../../../components/ui/Icon";
import { InfoTip } from "../../../components/ui/InfoTip";
import type { ActionContext } from "../../../lib/action";
import { cn } from "../../../lib/cn";
import { copy } from "../../../lib/copy";
import { triggerSfx } from "../../../lib/sfx-bridge";

export interface ReviewValues {
  stars: number;
  comment: string | null;
  categoryIds: string[];
}

/**
 * Form penilaian (A5): bintang wajib, kategori maks. 3, komentar opsional. Murni tampilan + state isian;
 * pengiriman lewat `submit` (dipasang pada ActionButton: anti klik ganda, kunci idempotensi).
 */
export function ReviewForm({
  categories,
  initial,
  disabled = false,
  submit,
}: {
  categories: readonly { id: string; label: string }[];
  initial?: MyReview | null;
  /** true bila pemeriksaan keamanan (Turnstile) belum siap */
  disabled?: boolean;
  submit: (values: ReviewValues, ctx: ActionContext) => Promise<void>;
}) {
  const [stars, setStars] = useState(initial?.stars ?? 0);
  const [ids, setIds] = useState<string[]>(initial?.categoryIds ?? []);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const max = CONFIG.review.maxCommentLength;

  const toggle = (id: string) =>
    setIds((cur) => {
      const has = cur.includes(id);
      if (has) {
        triggerSfx("toggle", false);
        return cur.filter((x) => x !== id);
      }
      if (cur.length < CONFIG.review.maxCategoriesPerReview) {
        triggerSfx("toggle", true);
        return [...cur, id];
      }
      triggerSfx("no");
      return cur;
    });

  return (
    <form className="grid gap-4" onSubmit={(e) => e.preventDefault()}>
      {initial && <p className="text-sm text-muted">{copy.event.form.editing}</p>}

      <div className="grid gap-1.5">
        <span className="text-sm font-bold">{copy.event.form.stars}</span>
        <RatingStars mode="input" value={stars} onChange={setStars} size="lg" />
        {stars === 0 && <span className="text-xs text-muted">{copy.event.form.starsRequired}</span>}
      </div>

      {categories.length > 0 && (
        <fieldset className="grid gap-2">
          <legend className="flex items-center gap-1.5 text-sm font-bold">
            <span>{copy.event.form.categories}</span>
            <InfoTip text={copy.event.form.categoriesInfo} title={copy.event.form.categories} />
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => {
              const on = ids.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  data-sfx-custom=""
                  aria-pressed={on}
                  onClick={() => toggle(c.id)}
                  className={cn(
                    "group inline-flex items-center gap-1.5 rounded-chip border-2 border-line px-3 py-1 text-xs font-bold transition-transform hover:-translate-y-0.5 active:scale-95",
                    on
                      ? "bg-primary text-primary-fg shadow-press"
                      : "bg-surface text-text hover:bg-surface-tint",
                  )}
                >
                  <Icon name={on ? "check" : "plus"} className="size-3.5" />
                  {c.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <Field label={copy.event.form.comment} info={copy.event.form.commentInfo}>
        {(id) => (
          <>
            <Textarea
              id={id}
              rows={3}
              maxLength={max}
              placeholder={copy.event.form.commentPlaceholder}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <span className="text-right text-xs text-muted">
              {copy.event.form.counter(comment.length, max)}
            </span>
          </>
        )}
      </Field>

      <ActionButton
        type="submit"
        variant="primary"
        disabled={stars === 0 || disabled}
        resetOn={`${stars}|${ids.join(",")}|${comment}`}
        action={async (ctx) => {
          triggerSfx("tick");
          try {
            await submit(
              { stars, comment: comment.trim() === "" ? null : comment.trim(), categoryIds: ids },
              ctx,
            );
            triggerSfx("ok");
          } catch (e) {
            triggerSfx("err");
            throw e;
          }
        }}
      >
        {initial ? copy.event.form.update : copy.event.form.submit}
      </ActionButton>
    </form>
  );
}
