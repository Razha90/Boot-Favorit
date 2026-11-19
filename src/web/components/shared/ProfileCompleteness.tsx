import type { Completeness } from "@shared/visual";
import { copy } from "../../lib/copy";
import { Badge } from "../ui/Card";

const TONE = { name_only: "muted", partial: "accent", full: "primary" } as const;

/**
 * Kelengkapan profil (explore.md A16). Hanya untuk admin dan portal booth: **tidak pernah** tampil ke
 * pengunjung dan tidak pernah memblokir apa pun. `hint` = saran lembut; kosong bila sudah lengkap.
 */
export function ProfileCompleteness({
  level,
  variant = "chip",
}: {
  level: Completeness;
  variant?: "chip" | "hint";
}) {
  if (variant === "hint") {
    const text = copy.completeness.hint[level];
    return text ? <p className="text-sm text-muted">{text}</p> : null;
  }
  return <Badge tone={TONE[level]}>{copy.completeness.label[level]}</Badge>;
}
