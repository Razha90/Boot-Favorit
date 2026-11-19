import { CONFIG } from "@shared/config";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useRef } from "react";
import { triggerSfx, unlockSfx } from "../../lib/sfx-bridge";

const INTERACTIVE =
  'a,button,[role="button"],[role="radio"],label[for],select,summary,input[type="checkbox"]';

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

const isMotionOff = () =>
  prefersReducedMotion() || document.documentElement.dataset.motion === "off";

function spawnRing(x: number, y: number, tone: number) {
  if (typeof document === "undefined" || isMotionOff()) return;
  const el = document.createElement("i");
  el.className = "fx-ring";
  el.dataset.tone = String(tone % 3);
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  document.body.appendChild(el);
  window.setTimeout(() => el.remove(), CONFIG.fx.ringMs);
}

const STAR_TONES = [
  "text-sticker-1",
  "text-sticker-2",
  "text-sticker-3",
  "text-sticker-4",
  "text-sticker-5",
] as const;

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Memercikkan bintang SVG berwarna palet UNIMED dari tengah tombol/elemen saat ditekan di gaya Seru (B23, A12).
 */
export function burstStars(target: Element | null) {
  if (!target || typeof document === "undefined" || isMotionOff()) return;
  if (document.documentElement.dataset.vibe !== "seru") return;
  const rect = target.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const n = CONFIG.fx.burstCount;
  for (let i = 0; i < n; i++) {
    const el = document.createElement("i");
    el.className = `fx-star-burst ${STAR_TONES[i % STAR_TONES.length]}`;
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("fill", "currentColor");
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute(
      "d",
      "M12 2.5 14.95 8.7 21.75 9.6 16.75 14.3 18 21 12 17.7 6 21 7.25 14.3 2.25 9.6 9.05 8.7Z",
    );
    svg.appendChild(path);
    el.appendChild(svg);
    const angle = (Math.PI * 2 * i) / n + Math.random() * 0.45;
    const dist = 34 + Math.random() * 28;
    el.style.left = `${cx}px`;
    el.style.top = `${cy}px`;
    el.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
    el.style.setProperty("--dy", `${Math.sin(angle) * dist}px`);
    el.style.setProperty("--r", `${Math.round(Math.random() * 160 - 80)}deg`);
    document.body.appendChild(el);
    window.setTimeout(() => el.remove(), CONFIG.fx.particleMs);
  }
}

/**
 * Efek miring halus mengikuti posisi mouse pada kartu (mouse event B23, dinonaktifkan di layar sentuh / gerak minimal).
 * Tidak mengubah tinggi kotak diam sehingga keadilan ukuran kartu tetap terjaga.
 */
export function pointerTiltProps(active = true) {
  if (!active) return {};
  return {
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      if (e.pointerType !== "mouse" || isMotionOff()) return;
      const el = e.currentTarget;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty("--rx", `${(-py * 5).toFixed(2)}deg`);
      el.style.setProperty("--ry", `${(px * 6).toFixed(2)}deg`);
    },
    onPointerLeave: (e: ReactPointerEvent<HTMLElement>) => {
      const el = e.currentTarget;
      el.style.removeProperty("--rx");
      el.style.removeProperty("--ry");
    },
  };
}

/**
 * Pendengar klik & hover global untuk area pengunjung (B23): membangunkan Web Audio saat sentuhan pertama,
 * memunculkan cincin klik pada `pointerdown`, menggetarkan tombol nonaktif, dan memutar suara klik/nonaktif/hover.
 */
export function ClickFx() {
  const toneRef = useRef(0);
  const lastHoverRef = useRef<Element | null>(null);

  useEffect(() => {
    const onPointerDown = (e: globalThis.PointerEvent) => {
      if (document.documentElement.dataset.vibe !== "seru") return;
      unlockSfx();
      const target = e.target instanceof Element ? e.target : null;
      const el = target?.closest(INTERACTIVE) ?? null;
      if (el?.matches(':disabled,[aria-disabled="true"]')) {
        triggerSfx("no");
        if (!isMotionOff()) {
          el.classList.remove("fx-shake");
          void (el as HTMLElement).offsetWidth;
          el.classList.add("fx-shake");
        }
        return;
      }
      if (e.clientX > 0 || e.clientY > 0) {
        spawnRing(e.clientX, e.clientY, toneRef.current++);
      }
      if (el && !el.closest("[data-sfx-custom]")) {
        triggerSfx("click");
      }
    };

    const onPointerOver = (e: globalThis.PointerEvent) => {
      if (e.pointerType !== "mouse" || document.documentElement.dataset.vibe !== "seru") return;
      const target = e.target instanceof Element ? e.target : null;
      const el = target?.closest(INTERACTIVE) ?? null;
      if (!el || el === lastHoverRef.current) {
        if (!el) lastHoverRef.current = null;
        return;
      }
      lastHoverRef.current = el;
      if (!el.matches(':disabled,[aria-disabled="true"]')) {
        triggerSfx("hover");
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerover", onPointerOver, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointerover", onPointerOver, true);
    };
  }, []);

  return null;
}
