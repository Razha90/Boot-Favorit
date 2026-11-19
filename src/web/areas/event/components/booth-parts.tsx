import { CONFIG } from "@shared/config";
import { hasText } from "@shared/visual";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Present } from "../../../components/shared/Present";
import { Card } from "../../../components/ui/Card";
import { useEventData } from "../../../features/event-data";
import { cn } from "../../../lib/cn";
import { copy } from "../../../lib/copy";
import { useEventState } from "../../../lib/event-state";
import { countdownText } from "../../../lib/hero-copy";

/**
 * Teks "Kenalan" yang panjang: dipotong 4 baris (`CONFIG.booth.aboutCollapsedLines`) dan tombol
 * "Baca selengkapnya" muncul HANYA bila teks benar-benar terpotong (diukur dengan ResizeObserver, jadi tetap
 * benar saat layar diputar atau font selesai dimuat). Teks kosong → tidak dirender (A16). Selalu di-escape:
 * tanpa HTML/Markdown; baris kosong menjadi paragraf.
 */
export function AboutText({ text }: { text: string | null }) {
  const id = useId();
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const shown = hasText(text);

  // biome-ignore lint/correctness/useExhaustiveDependencies: ukur ulang saat teks atau keadaan berubah
  useEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    const measure = () => setClamped(el.scrollHeight > el.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, expanded]);

  if (!shown) return null;
  return (
    <div className="grid gap-2">
      <p
        id={id}
        ref={ref}
        data-expanded={expanded}
        style={expanded ? undefined : { WebkitLineClamp: CONFIG.booth.aboutCollapsedLines }}
        className={cn(
          "whitespace-pre-line text-sm [overflow-wrap:anywhere]",
          !expanded && "line-clamp-4",
        )}
      >
        {text}
      </p>
      {(clamped || expanded) && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((e) => !e)}
          className="w-fit text-sm font-bold underline underline-offset-4"
        >
          {expanded ? copy.event.booth.readLess : copy.event.booth.readMore}
        </button>
      )}
    </div>
  );
}

/** Sebaran bintang. Data null (rating disembunyikan) atau tanpa ulasan → tidak dirender. */
export function RatingBreakdown({
  distribution,
}: {
  distribution: readonly [number, number, number, number, number] | null;
}) {
  const total = distribution ? distribution.reduce((a, b) => a + b, 0) : 0;
  if (!distribution || total === 0) return null;
  return (
    <figure className="grid gap-1" aria-label={copy.event.booth.distribution}>
      {[5, 4, 3, 2, 1].map((star) => {
        const n = distribution[star - 1] ?? 0;
        return (
          <div key={star} className="flex items-center gap-2 text-xs">
            <span className="w-3 text-right font-bold">{star}</span>
            <span aria-hidden="true">★</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-star-off">
              <span className="block h-full bg-star" style={{ width: `${(n / total) * 100}%` }} />
            </span>
            <span className="w-6 text-muted">{n}</span>
          </div>
        );
      })}
    </figure>
  );
}

/**
 * Kartu penilaian menurut status event (explore.md A5, B17): belum mulai → hitung mundur; selesai → ditutup.
 * Form penilaian itu sendiri dikerjakan di Tahap 6; cabang "live" memuat pengganti jujur sampai saat itu.
 */
export function RatePanel({ id, children }: { id?: string; children?: ReactNode }) {
  const state = useEventState();
  const { event, serverNow } = useEventData();
  let body: ReactNode;
  if (state.phase === "upcoming") {
    body = (
      <p>{copy.event.rate.upcoming(countdownText(event.schedule.eventStartAt, serverNow()))}</p>
    );
  } else if (state.phase === "ended") {
    body = <p>{copy.event.rate.ended}</p>;
  } else {
    body = children ?? <p>{copy.event.rate.liveSoon}</p>;
  }
  return (
    <Card id={id} title={copy.event.rate.title}>
      {body}
    </Card>
  );
}

/** Tombol "Pesan dulu lewat WA": tautan ke /go/wa (server menyusun pesan; nomor tak pernah ada di halaman). */
export function WhatsAppOrderButton({
  boothId,
  productId,
  productName,
  variant = "full",
}: {
  boothId: string;
  productId?: string;
  productName?: string;
  variant?: "full" | "icon";
}) {
  const state = useEventState();
  if (state.frozen) return null; // setelah event selesai tombol hilang (A14)
  const href = `/go/wa/${encodeURIComponent(boothId)}${productId ? `?p=${encodeURIComponent(productId)}` : ""}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={productName ? copy.event.wa.orderAria(productName) : copy.event.wa.order}
      className="inline-flex w-fit items-center gap-1 rounded-chip border-(length:--border-w) border-line bg-sticker-4 px-3 py-1 text-xs font-bold text-primary-fg"
    >
      {variant === "icon" ? "WA" : copy.event.wa.order}
    </a>
  );
}

/** Judul kartu opsional: seluruh kartu (termasuk judulnya) hilang bila isinya kosong. */
export function OptionalCard({
  title,
  when,
  children,
}: {
  title: string;
  when: unknown;
  children: ReactNode;
}) {
  return (
    <Present when={when}>
      <Card title={title}>{children}</Card>
    </Present>
  );
}
