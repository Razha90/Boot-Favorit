import type { MyReview } from "@shared/api-types";
import { CONFIG } from "@shared/config";
import { useState } from "react";
import { RatingStars } from "../../../components/shared/RatingStars";
import { ActionButton } from "../../../components/ui/ActionButton";
import { Field, Textarea } from "../../../components/ui/Form";
import type { ActionContext } from "../../../lib/action";
import { cn } from "../../../lib/cn";
import { copy } from "../../../lib/copy";

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
    setIds((cur) =>
      cur.includes(id)
        ? cur.filter((x) => x !== id)
        : cur.length < CONFIG.review.maxCategoriesPerReview
          ? [...cur, id]
          : cur,
    );

  return (
    <form className="grid gap-4" onSubmit={(e) => e.preventDefault()}>
      {initial && <p className="text-sm text-muted">{copy.event.form.editing}</p>}

      <div className="grid gap-1">
        <span className="text-sm font-bold">{copy.event.form.stars}</span>
        <RatingStars mode="input" value={stars} onChange={setStars} size="lg" />
        {stars === 0 && <span className="text-xs text-muted">{copy.event.form.starsRequired}</span>}
      </div>

      {categories.length > 0 && (
        <fieldset className="grid gap-2">
          <legend className="text-sm font-bold">{copy.event.form.categories}</legend>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const on = ids.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(c.id)}
                  className={cn(
                    "rounded-chip border-(length:--border-w) border-line px-3 py-1 text-sm font-bold",
                    on ? "bg-primary text-primary-fg" : "bg-surface-raised",
                  )}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <Field label={copy.event.form.comment} hint={copy.event.form.commentHint}>
        {(id) => (
          <>
            <Textarea
              id={id}
              maxLength={max}
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
        action={(ctx) =>
          submit(
            { stars, comment: comment.trim() === "" ? null : comment.trim(), categoryIds: ids },
            ctx,
          )
        }
      >
        {initial ? copy.event.form.update : copy.event.form.submit}
      </ActionButton>
    </form>
  );
}
