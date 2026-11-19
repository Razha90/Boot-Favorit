// Mesin suara sintesis Web Audio API tanpa berkas audio (explore.md B23, demo-event.html).
// Dimuat dinamis saat sentuhan/interaksi pertama; aman di SSR/jsdom/tab tersembunyi.
import { CONFIG } from "@shared/config";

export type SfxMap = {
  click: [];
  hover: [];
  tick: [];
  toggle: [on: boolean];
  star: [stars: number];
  ok: [];
  err: [];
  no: [];
  ding: [];
  rank: [];
  swish: [];
  pop: [];
  count: [n: number];
  reveal: [rank: 1 | 2 | 3];
  win: [];
};

export type SfxName = keyof SfxMap;

interface AudioLike {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

const STAR_FREQS = [523, 587, 659, 784, 880] as const;
const COUNT_FREQS: Record<number, number> = { 3: 440, 2: 523, 1: 659 };
const REVEAL_CHORDS: Record<1 | 2 | 3, readonly number[]> = {
  3: [392, 494],
  2: [440, 554, 659],
  1: [523, 659, 784, 1047],
};

class SynthEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private lastPlayed = new Map<string, number>();

  unlock(): boolean {
    if (typeof window === "undefined") return false;
    try {
      if (!this.ctx) {
        const w = window as unknown as AudioLike;
        const Ctor = w.AudioContext ?? w.webkitAudioContext;
        if (!Ctor) return false;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = CONFIG.fx.volume;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === "suspended") {
        void this.ctx.resume().catch(() => {});
      }
      return true;
    } catch {
      return false;
    }
  }

  private gate(key: string, ms: number): boolean {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const prev = this.lastPlayed.get(key);
    if (prev !== undefined && now - prev < ms) return false;
    this.lastPlayed.set(key, now);
    return true;
  }

  private tone(
    freq: number,
    delaySec: number,
    durSec: number,
    type: OscillatorType = "sine",
    gain = 0.3,
    endFreq?: number,
  ) {
    if (!this.ctx || !this.master) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    const t0 = this.ctx.currentTime + delaySec;
    const osc = this.ctx.createOscillator();
    const vca = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + durSec);
    vca.gain.setValueAtTime(0.0001, t0);
    vca.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    vca.gain.exponentialRampToValueAtTime(0.0001, t0 + durSec);
    osc.connect(vca);
    vca.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + durSec + 0.02);
  }

  play<K extends SfxName>(name: K, ...args: SfxMap[K]) {
    if (!this.ctx) return;
    switch (name) {
      case "click":
        if (!this.gate("click", 40)) return;
        this.tone(520, 0, 0.06, "triangle", 0.45, 320);
        this.tone(880, 0.012, 0.05, "sine", 0.18);
        return;
      case "hover":
        if (!CONFIG.fx.hoverSound || !this.gate("hover", 90)) return;
        this.tone(900, 0, 0.022, "sine", 0.08);
        return;
      case "tick":
        this.tone(1200, 0, 0.03, "square", 0.05);
        return;
      case "toggle": {
        const [on] = args as SfxMap["toggle"];
        if (on) {
          this.tone(440, 0, 0.07, "triangle", 0.3);
          this.tone(660, 0.06, 0.09, "triangle", 0.3);
        } else {
          this.tone(660, 0, 0.07, "triangle", 0.28);
          this.tone(440, 0.06, 0.09, "triangle", 0.28);
        }
        return;
      }
      case "star": {
        const [stars] = args as SfxMap["star"];
        const idx = Math.max(0, Math.min(4, (stars || 1) - 1));
        const freq = STAR_FREQS[idx] ?? 523;
        this.tone(freq, 0, 0.16, "triangle", 0.35);
        this.tone(freq * 2, 0.02, 0.12, "sine", 0.12);
        if (stars === 5) {
          this.tone(1047, 0.1, 0.2, "sine", 0.22);
          this.tone(1319, 0.18, 0.25, "sine", 0.16);
        }
        return;
      }
      case "ok":
        for (const [k, n] of [523, 659, 784, 1047].entries()) {
          this.tone(n, k * 0.085, 0.16, "triangle", 0.32);
        }
        return;
      case "err":
        this.tone(190, 0, 0.16, "sawtooth", 0.22, 130);
        this.tone(170, 0.18, 0.2, "sawtooth", 0.22, 110);
        return;
      case "no":
        if (!this.gate("no", 120)) return;
        this.tone(220, 0, 0.09, "square", 0.12, 170);
        return;
      case "ding":
        if (!this.gate("ding", 1200)) return;
        this.tone(988, 0, 0.22, "sine", 0.22);
        this.tone(1319, 0.08, 0.3, "sine", 0.14);
        return;
      case "rank":
        this.tone(660, 0, 0.1, "triangle", 0.3);
        this.tone(880, 0.1, 0.1, "triangle", 0.3);
        this.tone(1320, 0.2, 0.24, "triangle", 0.32);
        return;
      case "swish":
        if (!this.gate("swish", 300)) return;
        this.tone(300, 0, 0.09, "sine", 0.07, 900);
        return;
      case "pop":
        if (!this.gate("pop", 150)) return;
        this.tone(600, 0, 0.07, "triangle", 0.28, 900);
        return;
      case "count": {
        const [n] = args as SfxMap["count"];
        this.tone(COUNT_FREQS[n] ?? 440, 0, 0.12, "square", 0.1);
        return;
      }
      case "reveal": {
        const [rank] = args as SfxMap["reveal"];
        const chord = REVEAL_CHORDS[rank] ?? [523];
        for (const [k, n] of chord.entries()) {
          this.tone(n, k * 0.1, rank === 1 ? 0.34 : 0.2, "triangle", 0.32);
        }
        if (rank === 1) this.tone(262, 0, 0.6, "sine", 0.22);
        return;
      }
      case "win":
        for (const [k, n] of [523, 659, 784, 1047, 1319].entries()) {
          this.tone(n, k * 0.09, 0.24, "triangle", 0.3);
        }
        for (const n of [523, 659, 784]) {
          this.tone(n, 0.5, 0.7, "sine", 0.16);
        }
        return;
    }
  }
}

export const synthEngine = new SynthEngine();
