import type { ResultEntry } from "@shared/results";
import { type RevealStep, revealSteps } from "@shared/reveal";
import { useEffect, useMemo, useRef, useState } from "react";
import { copy } from "../../lib/copy";
import { formatAverage } from "../../lib/format";
import { useMediaUrl } from "../../lib/media-url";
import { Button } from "../ui/Button";
import { PhotoFrame } from "./PhotoFrame";
import { ResultsList } from "./ResultsList";
import { SafeImage } from "./SafeImage";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

function Place({ step }: { step: Extract<RevealStep, { kind: "place" }> }) {
  const resolve = useMediaUrl();
  const r = step.entry;
  return (
    <div className="reveal-pop grid max-w-xl justify-items-center gap-4 text-center">
      <span className="font-hand text-5xl text-accent-strong">{copy.reveal.place(step.rank)}</span>
      <div className="w-72 max-w-full">
        <SafeImage
          src={resolve(r.coverThumbKey)}
          aspect="4/3"
          className="w-full rounded-card"
          fallback={<PhotoFrame id={r.boothId} name={r.name} boothNo={r.boothNo} size="winner" />}
        />
      </div>
      <h2 className="font-display text-5xl font-extrabold leading-tight [overflow-wrap:anywhere]">
        {r.name}
      </h2>
      {r.average !== null && (
        <p className="text-lg font-bold">
          {formatAverage(r.average)} ★ · {copy.results.reviews(r.reviewCount)}
        </p>
      )}
    </div>
  );
}

/**
 * Animasi pemenang (A8, B20): 3-2-1 → juara 3 → 2 → 1 → daftar hasil, layar penuh, tanpa confetti, tanpa suara.
 * Esc atau tombol Lewati menutup; sentuh lapisan melompat ke daftar. `prefers-reduced-motion` langsung ke daftar.
 * `onOptOut` hanya ada pada mode putar-ulang (pemutaran langsung oleh admin tidak terpengaruh pilihan itu).
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
    if (step.kind === "list") return;
    const t = setTimeout(() => setI((n) => Math.min(n + 1, listAt)), step.ms);
    return () => clearTimeout(t);
  }, [step, listAt]);

  return (
    <dialog
      ref={ref}
      aria-label={copy.reveal.label}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-dvw max-w-none overflow-y-auto border-0 bg-surface p-0 text-text"
    >
      <div className="mx-auto grid min-h-dvh max-w-5xl content-start gap-6 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-hand text-3xl">{copy.reveal.label}</span>
          {interactive && (
            <div className="flex flex-wrap items-center gap-3">
              {onOptOut && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={optedOut}
                    onChange={(e) => onOptOut(e.target.checked)}
                  />
                  {copy.reveal.dontReplay}
                </label>
              )}
              <Button onClick={onClose}>
                {step.kind === "list" ? copy.reveal.viewPage : copy.reveal.skip}
              </Button>
            </div>
          )}
        </div>

        <div className="relative grid min-h-[60dvh] place-items-center">
          {/* Sentuh/klik panggung = lompat ke daftar. Tombol transparan (bisa difokus keyboard), bukan handler pada div. */}
          {interactive && step.kind !== "list" && (
            <button
              type="button"
              aria-label={copy.reveal.jump}
              onClick={() => setI(listAt)}
              className="absolute inset-0 z-10 cursor-pointer opacity-0"
            />
          )}
          <div aria-live="polite" className="contents">
            {step.kind === "count" && (
              <span
                key={step.n}
                className="reveal-pop font-display text-[10rem] font-extrabold leading-none"
              >
                {copy.reveal.countdown(step.n)}
              </span>
            )}
            {step.kind === "place" && <Place key={step.rank} step={step} />}
          </div>
          {step.kind === "list" && (
            <div className="w-full">
              <ResultsList results={results} interactive={false} />
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
