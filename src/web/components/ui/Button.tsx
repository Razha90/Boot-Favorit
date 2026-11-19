import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "../../lib/cn";

export const buttonStyles = cva(
  "inline-flex items-center justify-center gap-2 rounded-chip border-(length:--border-w) border-line px-4 py-2 text-sm font-bold transition-[transform,box-shadow] duration-(--motion-fast) disabled:cursor-not-allowed disabled:opacity-60",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg shadow-card active:translate-y-px active:shadow-press",
        secondary: "bg-surface-raised text-text hover:bg-surface-tint",
        danger: "bg-danger text-surface-raised hover:opacity-90",
        ghost: "border-transparent bg-transparent text-primary-strong hover:bg-primary-soft",
      },
      size: { sm: "px-3 py-1 text-xs", md: "" },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export type ButtonProps = ComponentProps<"button"> & VariantProps<typeof buttonStyles>;

export function Button({ variant, size, className, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={cn(buttonStyles({ variant, size }), className)} {...rest} />
  );
}
