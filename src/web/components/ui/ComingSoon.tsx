import type { ReactNode } from "react";
import { copy } from "../../lib/copy";

// Penanda sementara untuk halaman yang belum dibuat. Dihapus bertahap sesuai BUILD-PLAN.
export function ComingSoon({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <main className="mx-auto grid max-w-3xl gap-3 px-4 py-16">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">{title}</h1>
      <p className="text-muted">{copy.scaffold.soon}</p>
      {children}
    </main>
  );
}
