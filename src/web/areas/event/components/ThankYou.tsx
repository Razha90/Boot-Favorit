import type { ReviewSubmitResult } from "@shared/api-types";
import { Link } from "react-router";
import { Button } from "../../../components/ui/Button";
import { copy } from "../../../lib/copy";

/** Layar setelah kirim (A5): terima kasih, kemajuan "N dari M", dan sampai 3 booth lain yang belum dinilai. */
export function ThankYou({ result, onEdit }: { result: ReviewSubmitResult; onEdit: () => void }) {
  const { progress, suggestions } = result;
  return (
    <div className="grid gap-3" role="status">
      <h3 className="font-display text-2xl font-extrabold">{copy.event.thanks.title}</h3>
      <p className="text-sm">
        {result.commentHeld ? copy.event.thanks.held : copy.event.thanks.saved}
      </p>
      {progress.total > 0 && (
        <p className="text-sm font-bold">
          {progress.reviewed >= progress.total
            ? copy.event.thanks.allDone
            : copy.event.thanks.progress(progress.reviewed, progress.total)}
        </p>
      )}
      {suggestions.length > 0 && (
        <div className="grid gap-2">
          <span className="text-sm text-muted">{copy.event.thanks.next}</span>
          <ul className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <li key={s.id}>
                <Link
                  to={`/b/${s.id}`}
                  className="inline-block rounded-chip border-(length:--border-w) border-line bg-surface-tint px-3 py-1 text-sm font-bold"
                >
                  {s.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Button size="sm" onClick={onEdit} className="w-fit">
        {copy.event.thanks.edit}
      </Button>
    </div>
  );
}
