import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../lib/cn";
import { InfoTip } from "./InfoTip";

export function Card({
  title,
  info,
  actions,
  children,
  className,
  ...rest
}: Omit<ComponentProps<"section">, "title"> & {
  title?: string;
  info?: string;
  actions?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "grid gap-3 rounded-card border-(length:--border-w) border-line bg-surface-raised p-4",
        className,
      )}
      {...rest}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2">
          {title && (
            <div className="flex items-center gap-1.5">
              <h2 className="font-display text-lg font-extrabold">{title}</h2>
              {info && <InfoTip text={info} title={title} />}
            </div>
          )}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

const TONES = {
  muted: "bg-surface-tint text-muted",
  primary: "bg-primary-soft text-primary-strong",
  accent: "bg-accent text-accent-fg",
  danger: "bg-danger text-surface-raised",
} as const;

export function Badge({
  tone = "muted",
  children,
}: {
  tone?: keyof typeof TONES;
  children: ReactNode;
}) {
  return (
    <span
      className={cn("inline-flex rounded-chip px-2.5 py-0.5 text-xs font-semibold", TONES[tone])}
    >
      {children}
    </span>
  );
}
