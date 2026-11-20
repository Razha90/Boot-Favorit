import { BRAND_LOGO_PATH } from "@shared/brand";
import { cn } from "../../lib/cn";
import { copy } from "../../lib/copy";
import { Icon } from "../ui/Icon";
import { FoodSticker } from "./FoodSticker";
import { Present } from "./Present";
import { QrCode } from "./QrCode";
import { SafeImage } from "./SafeImage";

export type PosterKind = "booth" | "event" | "register";
export type PosterSize = "a4" | "a5";

export interface PosterContent {
  kind: PosterKind;
  eventName: string;
  title: string;
  /** Mis. "Booth A12" */
  badge?: string | null;
  /** Institusi/fakultas */
  teamName?: string | null;
  tagline?: string | null;
  /** Isi QR (alamat lengkap) */
  url: string;
  /** Teks alamat yang tampil di kaki poster (singkat, mis. domain) */
  displayUrl: string;
  qrLabel: string;
  /** Penentu pilihan stiker hiasan */
  seed: string;
}

const FLAG = ["bg-primary", "bg-accent", "bg-surface-tint", "bg-sticker-4"] as const;
const FLAG_STRIP = Array.from({ length: 28 }, (_, i) => ({
  id: `f${i}`,
  color: FLAG[i % FLAG.length],
}));

/**
 * Poster QR cetak (A4/A5) untuk booth, halaman utama event, dan pendaftaran booth (explore.md B29). Seluruh ukuran
 * memakai satuan kontainer (`cqw`) sehingga tampilannya identik di layar, A4, dan A5. Agar mudah dipindai: QR besar
 * (±58% lebar), zona tenang 4 modul di atas latar putih, hitam pekat di atas putih, koreksi galat Q, dan tanpa
 * logo di tengah kode.
 */
export function QrPoster({
  size,
  eager = false,
  ...c
}: PosterContent & { size: PosterSize; eager?: boolean }) {
  const P = copy.poster;
  const steps = copy.event.hero.steps;
  return (
    <article
      data-poster={c.kind}
      data-size={size}
      className={cn(
        "poster-container relative mx-auto w-full overflow-hidden border-(length:--border-w) border-text bg-surface text-text shadow-card [print-color-adjust:exact] print:m-0 print:max-w-none print:break-after-page print:border-0 print:shadow-none print:last:break-after-auto",
        size === "a4"
          ? "aspect-[210/297] max-w-xl print:h-[297mm] print:w-[210mm]"
          : "aspect-[148/210] max-w-md print:h-[210mm] print:w-[148mm]",
      )}
    >
      <div className="grid h-full grid-rows-[auto_1fr_auto]">
        <header className="min-w-0">
          <div aria-hidden="true" className="flex h-[calc(2.4*var(--u))]">
            {FLAG_STRIP.map((f) => (
              <span key={f.id} className={cn("flex-1", f.color)} />
            ))}
          </div>
          <div className="flex items-center justify-between gap-[calc(3*var(--u))] px-[calc(5*var(--u))] pt-[calc(3*var(--u))]">
            <SafeImage
              src={BRAND_LOGO_PATH}
              alt={copy.event.organizer.logoAlt}
              eager={eager}
              className="h-[calc(7.5*var(--u))]! w-auto shrink-0 object-contain!"
              fallback={null}
            />
            <p className="min-w-0 text-right text-[length:calc(1.9*var(--u))] font-bold tracking-widest text-muted uppercase">
              {c.eventName}
            </p>
          </div>
        </header>

        <div className="grid min-w-0 content-center justify-items-center gap-[calc(1.8*var(--u))] px-[calc(6*var(--u))] text-center">
          <h2 className="max-w-full font-display text-[length:calc(7.6*var(--u))] leading-[1.04] font-extrabold [overflow-wrap:anywhere]">
            {c.title}
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-[calc(1.6*var(--u))]">
            <Present when={c.badge}>
              <span className="rounded-chip bg-primary-soft px-[calc(2.4*var(--u))] py-[calc(0.6*var(--u))] text-[length:calc(2.6*var(--u))] font-extrabold text-primary-strong">
                {c.badge}
              </span>
            </Present>
            <Present when={c.teamName}>
              <span className="text-[length:calc(2.8*var(--u))] font-bold">{c.teamName}</span>
            </Present>
          </div>
          <Present when={c.tagline}>
            <p className="max-w-[calc(70*var(--u))] font-hand text-[length:calc(4*var(--u))] leading-tight">
              {c.tagline}
            </p>
          </Present>

          <p className="mt-[calc(1*var(--u))] inline-flex items-center gap-[calc(1.4*var(--u))] font-hand text-[length:calc(4.6*var(--u))] text-accent-strong">
            <span>{P.scanHere}</span>
            <Icon name="arrow-down" className="size-[calc(4*var(--u))]" />
          </p>

          <div className="relative w-[calc(58*var(--u))]">
            <FoodSticker
              seed={c.seed}
              offset={1}
              eager={eager}
              className="absolute -top-[calc(5*var(--u))] -left-[calc(11*var(--u))] w-[calc(13*var(--u))] -rotate-12"
            />
            <FoodSticker
              seed={c.seed}
              offset={5}
              eager={eager}
              className="absolute -top-[calc(3*var(--u))] -right-[calc(11.5*var(--u))] w-[calc(12*var(--u))] rotate-12"
            />
            <FoodSticker
              seed={c.seed}
              offset={9}
              eager={eager}
              className="absolute -bottom-[calc(3*var(--u))] -left-[calc(10.5*var(--u))] w-[calc(12*var(--u))] rotate-6"
            />
            <FoodSticker
              seed={c.seed}
              offset={3}
              eager={eager}
              className="absolute -right-[calc(10.5*var(--u))] -bottom-[calc(4*var(--u))] w-[calc(13*var(--u))] -rotate-6"
            />
            <span
              aria-hidden="true"
              className="absolute -top-[calc(1.8*var(--u))] left-1/2 z-10 h-[calc(3.6*var(--u))] w-[calc(17*var(--u))] -translate-x-1/2 -rotate-2 bg-accent/80"
            />
            <div className="rounded-[calc(2.4*var(--u))] border-[length:calc(0.7*var(--u))] border-text bg-qr-bg p-[calc(1.4*var(--u))] shadow-[calc(1.2*var(--u))_calc(1.2*var(--u))_0_var(--text)]">
              <QrCode value={c.url} label={c.qrLabel} ecc="Q" plain className="w-full" />
            </div>
          </div>

          <p className="mt-[calc(1.4*var(--u))] max-w-[calc(78*var(--u))] text-[length:calc(3.1*var(--u))] leading-snug font-bold">
            {P.cta[c.kind]}
          </p>
          {c.kind !== "register" && (
            <ol className="flex flex-wrap justify-center gap-[calc(1.6*var(--u))]">
              {steps.map((s, i) => (
                <li
                  key={s}
                  className="flex items-center gap-[calc(1*var(--u))] rounded-chip border-[length:calc(0.35*var(--u))] border-text bg-surface-raised px-[calc(2*var(--u))] py-[calc(0.7*var(--u))] text-[length:calc(2.5*var(--u))] font-bold"
                >
                  <span className="grid size-[calc(3.4*var(--u))] place-items-center rounded-full bg-text text-[length:calc(2*var(--u))] text-surface">
                    {i + 1}
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <footer className="flex min-w-0 items-center justify-between gap-[calc(3*var(--u))] bg-text px-[calc(5*var(--u))] py-[calc(2.6*var(--u))] text-surface">
          <div className="grid min-w-0 leading-tight">
            <span className="text-[length:calc(1.7*var(--u))] tracking-widest uppercase opacity-70">
              {copy.event.footer.organizerHeading}
            </span>
            <span className="font-display text-[length:calc(3*var(--u))] font-extrabold">
              {copy.event.organizer.short}
            </span>
          </div>
          <span className="shrink-0 rounded-chip bg-accent px-[calc(2.6*var(--u))] py-[calc(1*var(--u))] text-[length:calc(2.7*var(--u))] font-extrabold text-accent-fg">
            {c.displayUrl}
          </span>
        </footer>
      </div>
    </article>
  );
}
