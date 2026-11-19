import { type ComponentProps, type ReactNode, useId } from "react";
import { cn } from "../../lib/cn";

const control =
  "w-full rounded-card border-(length:--border-w) border-line bg-surface-raised px-3 py-2 text-sm text-text placeholder:text-muted disabled:opacity-60";

/** Label + isian + petunjuk/galat. `children` menerima id untuk dipasang pada kontrol. */
export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: (id: string) => ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("grid gap-1", className)}>
      <label htmlFor={id} className="text-sm font-bold">
        {label}
      </label>
      {children(id)}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export const Input = ({ className, ...p }: ComponentProps<"input">) => (
  <input className={cn(control, className)} {...p} />
);
export const Textarea = ({ className, ...p }: ComponentProps<"textarea">) => (
  <textarea className={cn(control, "min-h-24", className)} {...p} />
);
export const Select = ({ className, ...p }: ComponentProps<"select">) => (
  <select className={cn(control, className)} {...p} />
);
