import type { ResultEntry } from "@shared/results";
import { type RevealStep, revealSteps } from "@shared/reveal";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../../lib/cn";
import { copy } from "../../lib/copy";
import { formatAverage, formatScore } from "../../lib/format";
import { useMediaUrl } from "../../lib/media-url";
import { triggerSfx } from "../../lib/sfx-bridge";
import { Button } from "../ui/Button";
import { RatingStars } from "./RatingStars";
import { ResultsList } from "./ResultsList";
import { SafeImage } from "./SafeImage";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

const CONFETTI_CLASSES = [
  "confetti-c1",
  "confetti-c2",
  "confetti-c3",
  "confetti-c4",
  "confetti-c5",
] as const;

// Posisi partikel pita & confetti deterministik di panggung pemenang (memakai token warna --c1..--c5).
const CONFETTI_PIECES = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  left: `${3 + ((i * 37) % 94)}%`,
  cx: `${((i % 2 === 0 ? 1 : -1) * (18 + ((i * 19) % 44))).toFixed(0)}px`,
  cr: `${(i % 2 === 0 ? 1 : -1) * (320 + ((i * 67) % 360))}deg`,
  dur: `${2400 + ((i * 290) % 1800)}ms`,
  del: `${(i * 130) % 1600}ms`,
  kind: (i % 3 === 0 ? "ribbon" : i % 3 === 1 ? "star" : "tile") as "ribbon" | "star" | "tile",
  cls: CONFETTI_CLASSES[i % CONFETTI_CLASSES.length],
}));

function ConfettiLayer({ intense }: { intense: boolean }) {
  const list = intense ? CONFETTI_PIECES : CONFETTI_PIECES.slice(0, 14);
  return (
    <div
      data-reveal-confetti=""
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 overflow-hidden"
    >
      {list.map((p) =>
        p.kind === "star" ? (
          <svg
            key={p.id}
            aria-hidden="true"
            viewBox="0 0 24 24"
            className={cn(
              "reveal-confetti fixed -top-6 size-4 bg-transparent! fill-current",
              p.cls,
            )}
            style={
              {
                left: p.left,
                "--cx": p.cx,
                "--cr": p.cr,
                "--cdur": p.dur,
                "--cdel": p.del,
              } as React.CSSProperties
            }
          >
            <path d="M12 2c.7 4.2 3 6.5 7.2 7.2-4.2.7-6.5 3-7.2 7.2-.7-4.2-3-6.5-7.2-7.2 4.2-.7 6.5-3 7.2-7.2Z" />
          </svg>
        ) : (
          <span
            key={p.id}
            className={cn(
              "reveal-confetti fixed -top-6",
              p.kind === "ribbon" ? "h-5 w-2 rounded-full" : "size-2.5 rotate-45 rounded-xs",
              p.cls,
            )}
            style={
              {
                left: p.left,
                "--cx": p.cx,
                "--cr": p.cr,
                "--cdur": p.dur,
                "--cdel": p.del,
              } as React.CSSProperties
            }
          />
        ),
      )}
    </div>
  );
}

const BUNTING_FILLS = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)"] as const;

/** Evaluasi titik Y tepat di tali lengkung `M 0 8 Q 300 46 600 12 Q 900 46 1200 8`. */
function buntingY(x: number): number {
  const quad = (p0: number, p1: number, p2: number, t: number) =>
    (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
  return x <= 600 ? quad(8, 46, 12, x / 600) : quad(12, 46, 8, (x - 600) / 600);
}

const BUNTING_FLAGS = Array.from({ length: 14 }, (_, i) => {
  const x1 = 28 + i * 84;
  const x2 = x1 + 52;
  const xm = (x1 + x2) / 2;
  const y1 = buntingY(x1);
  const y2 = buntingY(x2);
  const ym = buntingY(xm);
  return {
    id: i,
    points: `${x1.toFixed(1)},${y1.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)} ${xm.toFixed(1)},${(ym + 34).toFixed(1)}`,
    fill: BUNTING_FILLS[i % BUNTING_FILLS.length],
  };
});

/** Hiasan pita bendera (bunting) & pita samping di panggung atas, memakai palet token UNIMED. */
function StageDecorations() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="reveal-rays absolute -inset-24 opacity-80" />

      {/* Pita bendera festival: tiap bendera menempel presisi pada kurva tali */}
      <svg
        aria-hidden="true"
        viewBox="0 0 1200 72"
        preserveAspectRatio="none"
        className="reveal-bunting absolute inset-x-0 top-0 h-14 w-full opacity-95 sm:h-16"
      >
        {BUNTING_FLAGS.map((f) => (
          <polygon key={f.id} points={f.points} fill={f.fill} />
        ))}
        <path
          d="M 0 8 Q 300 46 600 12 Q 900 46 1200 8"
          fill="none"
          stroke="var(--c3)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="600" cy="12" r="3.5" fill="var(--c2)" />
      </svg>

      {/* Pita serpentin halus (kontinu C1 dengan perintah S, tanpa patahan di tengah) */}
      <svg
        aria-hidden="true"
        viewBox="0 0 140 380"
        className="reveal-float absolute left-3 top-20 hidden h-64 w-24 opacity-80 sm:block"
      >
        <path
          d="M 36 16 C 72 64, 18 118, 48 168 S 22 268, 56 320 S 36 356, 48 366"
          fill="none"
          stroke="var(--c2)"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d="M 82 28 C 110 80, 62 132, 90 186 S 68 282, 98 336"
          fill="none"
          stroke="var(--c1)"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>
      <svg
        aria-hidden="true"
        viewBox="0 0 140 380"
        className="reveal-float absolute right-3 top-20 hidden h-64 w-24 opacity-80 sm:block"
      >
        <path
          d="M 104 16 C 68 64, 122 118, 92 168 S 118 268, 84 320 S 104 356, 92 366"
          fill="none"
          stroke="var(--c1)"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d="M 58 28 C 30 80, 78 132, 50 186 S 72 282, 42 336"
          fill="none"
          stroke="var(--c3)"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>

      {/* Kilau bintang geometris sudut */}
      <svg
        aria-hidden="true"
        viewBox="0 0 48 48"
        className="reveal-twinkle absolute left-[12%] top-[22%] size-8 text-accent"
      >
        <path
          d="M24 3 C25 16 32 23 45 24 C32 25 25 32 24 45 C23 32 16 25 3 24 C16 23 23 16 24 3Z"
          fill="currentColor"
        />
      </svg>
      <svg
        aria-hidden="true"
        viewBox="0 0 48 48"
        className="reveal-twinkle absolute right-[12%] bottom-[20%] size-10 text-primary-strong"
      >
        <path
          d="M24 3 C25 16 32 23 45 24 C32 25 25 32 24 45 C23 32 16 25 3 24 C16 23 23 16 24 3Z"
          fill="currentColor"
        />
      </svg>
    </div>
  );
}

/** Pita juara terlipat ala motion graphic. */
function FoldedRibbon({ label, rank }: { label: string; rank: 1 | 2 | 3 }) {
  const ribbonCls =
    rank === 1
      ? "bg-accent text-accent-fg border-line"
      : rank === 2
        ? "bg-sticker-3 text-primary-fg border-line"
        : "bg-sticker-4 text-primary-fg border-line";
  const tailFill = rank === 1 ? "var(--c5)" : rank === 2 ? "var(--c2)" : "var(--c1)";
  return (
    <div className="reveal-ribbon relative inline-flex items-center justify-center">
      <svg
        aria-hidden="true"
        viewBox="0 0 36 44"
        className="-mr-3 h-10 w-8 shrink-0 translate-y-1.5"
      >
        <polygon points="36,10 2,10 14,26 2,42 36,42" fill={tailFill} />
        <polygon points="36,10 26,16 36,22" fill="var(--line)" opacity="0.35" />
      </svg>
      <span
        className={cn(
          "relative z-10 inline-flex items-center gap-2 rounded-card border-2 px-6 py-1.5 font-display text-lg font-extrabold tracking-wider shadow-card sm:text-xl",
          ribbonCls,
        )}
      >
        {rank === 1 && (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="reveal-trophy size-6 fill-none stroke-current"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 4h12v5a6 6 0 0 1-12 0V4Z" />
            <path d="M6 6H3.5a1.5 1.5 0 0 0-1.5 1.5V9a3.5 3.5 0 0 0 4 3.4" />
            <path d="M18 6h2.5A1.5 1.5 0 0 1 22 7.5V9a3.5 3.5 0 0 1-4 3.4" />
            <path d="M12 15v4M8 21h8" />
          </svg>
        )}
        {label}
      </span>
      <svg
        aria-hidden="true"
        viewBox="0 0 36 44"
        className="-ml-3 h-10 w-8 shrink-0 translate-y-1.5"
      >
        <polygon points="0,10 34,10 22,26 34,42 0,42" fill={tailFill} />
        <polygon points="0,10 10,16 0,22" fill="var(--line)" opacity="0.35" />
      </svg>
    </div>
  );
}

const RANK_BORDER: Record<1 | 2 | 3, string> = {
  1: "border-accent border-[4px]",
  2: "border-sticker-3 border-[3px]",
  3: "border-sticker-4 border-[3px]",
};

function Place({ step }: { step: Extract<RevealStep, { kind: "place" }> }) {
  const resolve = useMediaUrl();
  const r = step.entry;
  const src = resolve(r.coverThumbKey);
  const [failed, setFailed] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: foto baru = coba lagi
  useEffect(() => setFailed(false), [src]);
  const hasPhoto = !!src && !failed;

  return (
    <div className="reveal-card-in relative grid max-w-2xl justify-items-center gap-5 text-center">
      {/* Sorotan halo belakang */}
      <div
        aria-hidden="true"
        className="reveal-halo pointer-events-none absolute -inset-12 -z-10 rounded-full blur-2xl"
      />

      <FoldedRibbon label={copy.reveal.place(step.rank)} rank={step.rank} />

      <div
        className={cn(
          "relative grid w-full items-center gap-5 rounded-card bg-surface-raised p-5 shadow-card",
          hasPhoto
            ? "max-w-xl sm:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] sm:p-6 sm:text-left"
            : "max-w-lg justify-items-center text-center sm:p-8",
          RANK_BORDER[step.rank],
        )}
      >
        {hasPhoto && (
          <div className="relative mx-auto w-56 max-w-full sm:w-full">
            <span
              aria-hidden="true"
              className="absolute -top-2.5 left-1/2 z-10 h-4 w-16 -translate-x-1/2 -rotate-2 bg-sticker-3/90"
            />
            <SafeImage
              src={src}
              aspect="4/3"
              className="w-full rounded-card"
              onFail={() => setFailed(true)}
              fallback={null}
            />
          </div>
        )}

        <div
          className={cn(
            "grid gap-2.5",
            hasPhoto
              ? "justify-items-center sm:justify-items-start"
              : "justify-items-center text-center",
          )}
        >
          {r.boothNo && (
            <span className="rounded-chip border border-line bg-surface-tint px-3 py-0.5 text-xs font-extrabold tracking-widest uppercase text-primary-strong">
              {copy.visitor.boothNo(r.boothNo)}
            </span>
          )}
          <h2 className="font-display text-4xl font-extrabold leading-none tracking-tight [overflow-wrap:anywhere] sm:text-5xl">
            {r.name}
          </h2>
          {r.average !== null && (
            <div
              className={cn(
                "flex flex-wrap items-center justify-center gap-2",
                hasPhoto && "sm:justify-start",
              )}
            >
              <span className="font-display text-2xl font-extrabold text-accent-strong">
                {formatAverage(r.average)}
              </span>
              <RatingStars mode="display" value={r.average} size="md" />
              <span className="text-sm font-bold text-muted">
                · {copy.results.reviews(r.reviewCount)}
              </span>
            </div>
          )}
          {r.score !== null && (
            <span className="rounded-chip bg-surface-tint px-3 py-1 text-xs font-extrabold text-text">
              {copy.results.score(formatScore(r.score))}
            </span>
          )}
        </div>
      </div>

      {/* Penanda tahap podium */}
      <div aria-hidden="true" className="flex items-center gap-2">
        {([3, 2, 1] as const).map((rank) => (
          <span
            key={rank}
            className={cn(
              "h-2 rounded-full transition-all duration-300",
              step.rank === rank ? "w-8 bg-accent" : "w-2 bg-muted/40",
            )}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Animasi pemenang bergaya motion graphic (A8, B20, B23): panggung gelap `panggung` dengan sinar sorotan,
 * bunting bendera, pita juara terlipat, confetti/pita palet UNIMED, hitung mundur 3-2-1 → juara 3 → 2 → 1 → daftar hasil akhir,
 * serta suara hitung mundur & fanfare. Esc/Lewati menutup; klik panggung melompat ke daftar; `prefers-reduced-motion` langsung ke daftar.
 */
export function WinnerReveal({
  results,
  onClose,
  onOptOut,
  optedOut = false,
  interactive = true,
}: {
  results: readonly ResultEntry[];
  onClose: () => void;
  onOptOut?: (off: boolean) => void;
  optedOut?: boolean;
  /** false = Layar Besar: tanpa tombol/tautan */
  interactive?: boolean;
}) {
  const steps = useMemo(() => revealSteps(results), [results]);
  const listAt = steps.length - 1;
  const [i, setI] = useState(() => (prefersReducedMotion() ? listAt : 0));
  const ref = useRef<HTMLDialogElement>(null);
  const step = steps[Math.min(i, listAt)] as RevealStep;

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  useEffect(() => {
    if (step.kind === "count") triggerSfx("count", step.n);
    else if (step.kind === "place") triggerSfx("reveal", step.rank);
    else triggerSfx("win");
  }, [step]);

  useEffect(() => {
    if (step.kind === "list") return;
    const t = setTimeout(() => setI((n) => Math.min(n + 1, listAt)), step.ms);
    return () => clearTimeout(t);
  }, [step, listAt]);

  const intenseConfetti = step.kind === "list" || (step.kind === "place" && step.rank === 1);

  return (
    <dialog
      ref={ref}
      data-theme="panggung"
      aria-label={copy.reveal.label}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="reveal-stage fixed inset-0 m-0 h-dvh max-h-none w-dvw max-w-none overflow-y-auto border-0 p-0 text-text"
    >
      <StageDecorations />
      {(step.kind === "place" || step.kind === "list") && (
        <ConfettiLayer intense={intenseConfetti} />
      )}

      <div className="relative z-10 mx-auto grid min-h-dvh max-w-5xl grid-rows-[minmax(0,1fr)_auto] gap-6 px-4 pb-6 pt-14 sm:pt-16">
        <div className="relative grid place-items-center py-4">
          {/* Sentuh/klik panggung = lompat ke daftar. Tombol transparan (bisa difokus keyboard), bukan handler pada div. */}
          {interactive && step.kind !== "list" && (
            <button
              type="button"
              aria-label={copy.reveal.jump}
              onClick={() => setI(listAt)}
              className="absolute inset-0 z-20 cursor-pointer opacity-0"
            />
          )}
          <div aria-live="polite" className="contents">
            {step.kind === "count" && (
              <div key={step.n} className="relative grid place-items-center gap-4 text-center">
                <span className="rounded-chip border border-line bg-surface-raised/80 px-4 py-1 text-xs font-extrabold tracking-[0.2em] uppercase text-primary-strong">
                  {copy.reveal.drumroll}
                </span>
                <div className="relative grid size-56 place-items-center sm:size-72">
                  <span
                    aria-hidden="true"
                    className="reveal-count-ring absolute inset-0 rounded-full border-4"
                  />
                  <span
                    aria-hidden="true"
                    className="reveal-halo absolute inset-4 rounded-full blur-xl"
                  />
                  <span className="reveal-count-num relative font-display text-[9rem] font-extrabold leading-none text-text sm:text-[11rem]">
                    {copy.reveal.countdown(step.n)}
                  </span>
                </div>
              </div>
            )}
            {step.kind === "place" && <Place key={step.rank} step={step} />}
          </div>
          {step.kind === "list" && (
            <div className="reveal-pop grid w-full gap-5">
              <div className="grid justify-items-center gap-2 text-center">
                <FoldedRibbon label={copy.reveal.finalTitle} rank={1} />
                <p className="text-xs font-bold tracking-[0.18em] uppercase text-muted">
                  {copy.reveal.stageTag}
                </p>
              </div>
              <ResultsList results={results} interactive={false} />
            </div>
          )}
        </div>

        {interactive && (
          <div className="sticky bottom-3 z-30 mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-3 rounded-card border-(length:--border-w) border-line bg-surface-raised/90 px-4 py-2.5 shadow-card backdrop-blur-xs">
            {onOptOut && (
              <label className="flex items-center gap-2 text-sm text-text">
                <input
                  type="checkbox"
                  checked={optedOut}
                  onChange={(e) => onOptOut(e.target.checked)}
                />
                {copy.reveal.dontReplay}
              </label>
            )}
            <Button variant="primary" onClick={onClose}>
              {step.kind === "list" ? copy.reveal.viewPage : copy.reveal.skip}
            </Button>
          </div>
        )}
      </div>
    </dialog>
  );
}
