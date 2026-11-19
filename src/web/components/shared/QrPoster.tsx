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
      className={cn(
        "relative mx-auto w-full overflow-hidden border-(length:--border-w) border-text bg-surface text-text shadow-card [print-color-adjust:exact] print:m-0 print:max-w-none print:break-after-page print:border-0 print:shadow-none print:last:break-after-auto",
        size === "a4"
          ? "aspect-[210/297] max-w-xl print:h-[297mm] print:w-[210mm]"
          : "aspect-[148/210] max-w-md print:h-[210mm] print:w-[148mm]",
      )}
    >
      <div style={{ containerType: "inline-size" }} className="h-full">
        <div className="grid h-full grid-rows-[auto_1fr_auto]">
          <header>
            <div aria-hidden="true" className="flex h-[2.4cqw]">
              {FLAG_STRIP.map((f) => (
                <span key={f.id} className={cn("flex-1", f.color)} />
              ))}
            </div>
            <div className="flex items-center justify-between gap-[3cqw] px-[5cqw] pt-[3cqw]">
              <SafeImage
                src={BRAND_LOGO_PATH}
                alt={copy.event.organizer.logoAlt}
                eager={eager}
                className="h-[7.5cqw]! w-auto object-contain!"
                fallback={null}
              />
              <p className="text-right text-[1.9cqw] font-bold tracking-widest text-muted uppercase">
                {c.eventName}
              </p>
            </div>
          </header>

          <div className="grid content-center justify-items-center gap-[1.8cqw] px-[6cqw] text-center">
            <h2 className="font-display text-[7.6cqw] leading-[1.02] font-extrabold [overflow-wrap:anywhere]">
              {c.title}
            </h2>
            <div className="flex flex-wrap items-center justify-center gap-[1.6cqw]">
              <Present when={c.badge}>
                <span className="rounded-chip bg-primary-soft px-[2.4cqw] py-[0.6cqw] text-[2.6cqw] font-extrabold text-primary-strong">
                  {c.badge}
                </span>
              </Present>
              <Present when={c.teamName}>
                <span className="text-[2.8cqw] font-bold">{c.teamName}</span>
              </Present>
            </div>
            <Present when={c.tagline}>
              <p className="max-w-[70cqw] font-hand text-[4cqw] leading-tight">{c.tagline}</p>
            </Present>

            <p className="mt-[1cqw] inline-flex items-center gap-[1.4cqw] font-hand text-[4.6cqw] text-accent-strong">
              {P.scanHere}
              <Icon name="arrow-down" className="size-[4cqw]" />
            </p>

            <div className="relative w-[58cqw]">
              <FoodSticker
                seed={c.seed}
                offset={1}
                eager={eager}
                className="absolute -top-[5cqw] -left-[11cqw] w-[13cqw] -rotate-12"
              />
              <FoodSticker
                seed={c.seed}
                offset={5}
                eager={eager}
                className="absolute -top-[3cqw] -right-[11.5cqw] w-[12cqw] rotate-12"
              />
              <FoodSticker
                seed={c.seed}
                offset={9}
                eager={eager}
                className="absolute -bottom-[3cqw] -left-[10.5cqw] w-[12cqw] rotate-6"
              />
              <FoodSticker
                seed={c.seed}
                offset={3}
                eager={eager}
                className="absolute -right-[10.5cqw] -bottom-[4cqw] w-[13cqw] -rotate-6"
              />
              <span
                aria-hidden="true"
                className="absolute -top-[1.8cqw] left-1/2 z-10 h-[3.6cqw] w-[17cqw] -translate-x-1/2 -rotate-2 bg-accent/80"
              />
              <div className="rounded-[2.4cqw] border-[0.7cqw] border-text bg-qr-bg p-[1.4cqw] shadow-[1.2cqw_1.2cqw_0_var(--text)]">
                <QrCode value={c.url} label={c.qrLabel} ecc="Q" plain className="w-full" />
              </div>
            </div>

            <p className="mt-[1.4cqw] max-w-[78cqw] text-[3.1cqw] leading-snug font-bold">
              {P.cta[c.kind]}
            </p>
            {c.kind !== "register" && (
              <ol className="flex flex-wrap justify-center gap-[1.6cqw]">
                {steps.map((s, i) => (
                  <li
                    key={s}
                    className="flex items-center gap-[1cqw] rounded-chip border-[0.35cqw] border-text bg-surface-raised px-[2cqw] py-[0.7cqw] text-[2.5cqw] font-bold"
                  >
                    <span className="grid size-[3.4cqw] place-items-center rounded-full bg-text text-[2cqw] text-surface">
                      {i + 1}
                    </span>
                    {s}
                  </li>
                ))}
              </ol>
            )}
          </div>

          <footer className="flex items-center justify-between gap-[3cqw] bg-text px-[5cqw] py-[2.6cqw] text-surface">
            <div className="grid leading-tight">
              <span className="text-[1.7cqw] tracking-widest uppercase opacity-70">
                {copy.event.footer.organizerHeading}
              </span>
              <span className="font-display text-[3cqw] font-extrabold">
                {copy.event.organizer.short}
              </span>
            </div>
            <span className="rounded-chip bg-accent px-[2.6cqw] py-[1cqw] text-[2.7cqw] font-extrabold text-accent-fg">
              {c.displayUrl}
            </span>
          </footer>
        </div>
      </div>
    </article>
  );
}
