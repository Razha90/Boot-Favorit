import type { PublicEvent } from "@shared/api-types";
import { BRAND_LOGO_PATH } from "@shared/brand";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { FoodSticker } from "../../../components/shared/FoodSticker";
import { SafeImage } from "../../../components/shared/SafeImage";
import { Icon } from "../../../components/ui/Icon";
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

/** Tombol kembali mengambang di kiri atas (`fixed`), sejajar simetris dengan tombol Sematan di kanan atas. */
export function BackButton({ children }: { children: ReactNode }) {
  return (
    <Link
      to="/"
      style={{ top: "max(1rem, env(safe-area-inset-top))" }}
      className="group fixed left-4 z-40 inline-flex h-11 w-fit items-center gap-2 rounded-chip border-(length:--border-w) border-line bg-surface-raised px-3.5 text-sm font-bold shadow-card transition-transform hover:-translate-y-0.5 active:translate-y-px active:shadow-press"
    >
      <span
        aria-hidden="true"
        className="grid size-6 place-items-center rounded-full border-(length:--border-w) border-line bg-accent text-accent-fg transition-transform group-hover:-translate-x-0.5"
      >
        <Icon name="arrow-left" className="size-3.5" />
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

/**
 * Kaki halaman: pita bendera, lalu blok gelap tiga kolom (ucapan + nama acara, kartu penyelenggara
 * dengan logo resmi, tiga stiker hiasan) dan baris hak cipta. Logo memakai unggahan admin bila ada, selain itu
 * logo resmi LPPM UNIMED bawaan.
 */
export function SiteFooter({ event }: { event: PublicEvent }) {
  const resolve = useMediaUrl();
  const F = copy.event.footer;
  const O = copy.event.organizer;
  const logo = event.media.logoKey ? resolve(thumbKeyOf(event.media.logoKey)) : BRAND_LOGO_PATH;
  const year = new Date(event.schedule.eventStartAt).getFullYear();
  return (
    <footer className="mt-16">
      <div aria-hidden="true" className="flex h-3">
        {FLAG_STRIP.map((f) => (
          <span key={f.id} className={cn("flex-1", f.color)} />
        ))}
      </div>
      <div className="bg-text text-surface">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 pt-12 pb-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] lg:items-center">
          <div className="grid content-start gap-4">
            <p className="font-hand text-4xl text-accent">{F.thanks}</p>
            <p className="font-display text-3xl font-extrabold leading-tight [overflow-wrap:anywhere] sm:text-4xl">
              {event.name}
            </p>
          </div>

          <div className="grid gap-3 rounded-card border-(length:--border-w) border-line bg-surface-raised p-5 text-text shadow-card">
            <p className="text-xs font-bold uppercase tracking-widest text-muted">
              {F.organizerHeading}
            </p>
            <SafeImage
              src={logo}
              alt={O.logoAlt}
              className="h-14! w-auto max-w-full object-contain! object-left!"
              fallback={<span className="font-display text-2xl font-extrabold">{O.short}</span>}
            />
            <p className="text-sm text-muted">{O.full}</p>
            <a
              href={F.siteHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit items-center gap-1.5 text-sm font-bold text-primary-strong underline underline-offset-4"
            >
              {F.siteLink}
              <Icon name="arrow-right" className="size-4" />
            </a>
          </div>

          <div aria-hidden="true" className="hidden items-end gap-3 lg:flex">
            {FOOTER_TILES.map((t) => (
              <div
                key={t.offset}
                className={cn(
                  "w-20 rounded-card border-(length:--border-w) border-line p-2 shadow-card",
                  t.bg,
                  t.tilt,
                  t.lift,
                )}
              >
                <FoodSticker seed={event.id} offset={t.offset} className="w-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-surface/15">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 pt-4 pb-24 text-xs">
            <span className="opacity-70">
              {F.copyright(year, O.short)} · {event.name}
            </span>
            <nav aria-label={F.forManagers} className="flex flex-wrap items-center gap-2">
              <span className="font-bold tracking-widest uppercase opacity-60">
                {F.forManagers}
              </span>
              {/* Admin: navigasi PENUH (bukan rute SPA) agar Cloudflare Access dan penjaga Worker memeriksa permintaannya. */}
              <a href="/admin" className={MANAGER_LINK}>
                <Icon name="shield" className="size-4" />
                {F.adminLogin}
              </a>
              <Link to="/booth" className={MANAGER_LINK}>
                <Icon name="store" className="size-4" />
                {F.boothLogin}
              </Link>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}

const MANAGER_LINK =
  "group inline-flex items-center gap-1.5 rounded-chip border-(length:--border-w) border-surface/40 px-3 py-1.5 font-bold text-surface transition-colors hover:bg-surface/10 focus-visible:bg-surface/10";

const FOOTER_TILES = [
  { offset: 2, bg: "bg-sticker-3", tilt: "-rotate-6", lift: "" },
  { offset: 7, bg: "bg-sticker-4", tilt: "rotate-3", lift: "-translate-y-3" },
  { offset: 10, bg: "bg-sticker-2", tilt: "-rotate-2", lift: "" },
] as const;

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
