import type { PublicEvent } from "@shared/api-types";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { SafeImage } from "../../../components/shared/SafeImage";
import { cn } from "../../../lib/cn";
import { copy } from "../../../lib/copy";
import { thumbKeyOf, useMediaUrl } from "../../../lib/media-url";

/** Judul bagian: lingkaran bernomor + satu kata bergaris-bawah spidol (A12 butir 4). */
export function SectionHeading({
  n,
  before,
  word,
  id,
}: {
  n: number;
  before: string;
  word: string;
  id?: string;
}) {
  return (
    <h2
      id={id}
      className="flex items-center gap-3 font-display text-3xl font-extrabold sm:text-4xl"
    >
      <span
        aria-hidden="true"
        className="grid size-10 shrink-0 place-items-center rounded-full border-(length:--border-w) border-line bg-text text-base text-surface"
      >
        {String(n).padStart(2, "0")}
      </span>
      <span>
        {before}
        <mark className="rounded-card bg-accent px-2 text-accent-fg">{word}</mark>
      </span>
    </h2>
  );
}

/** Tombol kembali berbentuk pil tebal. Selalu menuju `/` (QR membuka halaman booth langsung, tanpa riwayat). */
export function BackButton({ children }: { children: ReactNode }) {
  return (
    <Link
      to="/"
      className="group inline-flex items-center gap-2 rounded-chip border-(length:--border-w) border-line bg-surface-raised px-4 py-2 text-sm font-bold shadow-card transition-transform active:translate-y-px active:shadow-press"
    >
      <span
        aria-hidden="true"
        className="grid size-6 place-items-center rounded-full border-(length:--border-w) border-line bg-accent text-accent-fg transition-transform group-hover:-translate-x-0.5"
      >
        ←
      </span>
      {children}
    </Link>
  );
}

// Pita bendera kecil: hijau, oranye, krem, hijau muda (palet UNIMED, A12 butir 5).
const FLAG_COLORS = ["bg-primary", "bg-accent", "bg-surface-tint", "bg-sticker-4"] as const;
const FLAG_STRIP = Array.from({ length: 24 }, (_, i) => ({
  id: `bendera-${i}`,
  color: FLAG_COLORS[i % FLAG_COLORS.length],
}));

/** Kaki halaman: pita bendera + pita gelap. Logo, kontak, dan sosial opsional (hilang bila kosong). */
export function SiteFooter({ event }: { event: PublicEvent }) {
  const resolve = useMediaUrl();
  return (
    <footer className="mt-16">
      <div aria-hidden="true" className="flex h-3">
        {FLAG_STRIP.map((f) => (
          <span key={f.id} className={cn("flex-1", f.color)} />
        ))}
      </div>
      <div className="bg-text text-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-6 px-4 pb-24 pt-8">
          <div className="grid gap-1">
            <p className="font-hand text-3xl text-accent">{copy.event.footer.thanks}</p>
            <p className="font-display text-2xl font-extrabold [overflow-wrap:anywhere]">
              {event.name}
            </p>
            <p className="flex items-center gap-2 text-sm opacity-80">
              <SafeImage
                src={resolve(event.media.logoKey ? thumbKeyOf(event.media.logoKey) : null)}
                className="size-6 rounded"
                fallback={null}
              />
              {copy.event.footer.organizer}
            </p>
          </div>
          <a
            href="#top"
            className="rounded-chip border-(length:--border-w) border-line bg-accent px-4 py-2 text-sm font-bold text-accent-fg"
          >
            {copy.event.footer.top} ↑
          </a>
        </div>
      </div>
    </footer>
  );
}

/** Layar "Segera hadir" bila belum ada event aktif/terbit atau disembunyikan (A0): nama penyelenggara saja, tanpa data. */
export function ComingSoonScreen() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 text-center">
      <div className="grid gap-3">
        <p className="font-hand text-3xl text-accent-strong">{copy.event.comingSoon.organizer}</p>
        <h1 className="font-display text-5xl font-extrabold sm:text-7xl">
          {copy.event.comingSoon.title}
        </h1>
        <p className="mx-auto max-w-prose text-muted">{copy.event.comingSoon.body}</p>
      </div>
    </main>
  );
}
