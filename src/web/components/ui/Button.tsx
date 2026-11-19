import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "../../lib/cn";
import { Icon, type IconName, inferButtonIcon } from "./Icon";

export const buttonStyles = cva(
  "group inline-flex items-center justify-center gap-2 rounded-chip border-(length:--border-w) border-line px-4 py-2 text-sm font-bold transition-[transform,box-shadow,background-color] duration-(--motion-fast) hover:-translate-y-0.5 active:translate-y-px active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:active:scale-100",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg shadow-card active:shadow-press",
        secondary: "bg-surface-raised text-text hover:bg-surface-tint",
        danger: "bg-danger text-surface-raised hover:opacity-90",
        ghost: "border-transparent bg-transparent text-primary-strong hover:bg-primary-soft",
      },
      size: { sm: "px-3 py-1 text-xs", md: "min-h-11 sm:min-h-0" },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonStyles> & {
    /** Ikon awal; isi `false` untuk mematikan pengisian ikon otomatis pada tombol khusus */
    icon?: IconName | false;
    iconEnd?: IconName;
  };

export function Button({
  variant,
  size,
  icon,
  iconEnd,
  className,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  const autoIcon = icon === undefined && !iconEnd ? inferButtonIcon(children) : null;
  const startIcon = icon || autoIcon;
  return (
    <button type={type} className={cn(buttonStyles({ variant, size }), className)} {...rest}>
      {startIcon && <Icon name={startIcon} />}
      {children}
      {iconEnd && <Icon name={iconEnd} />}
    </button>
  );
}
