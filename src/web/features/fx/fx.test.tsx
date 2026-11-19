// @vitest-environment jsdom
import { CONFIG } from "@shared/config";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copy } from "../../lib/copy";
import { synthEngine } from "../../lib/sfx";
import { setSfxGlobalEnabled, triggerSfx, unlockSfx } from "../../lib/sfx-bridge";
import { burstStars, ClickFx } from "./ClickFx";
import { SoundProvider, SoundToggle } from "./SoundProvider";

function stubAudio() {
  const osc = {
    type: "sine",
    frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  const gain = {
    gain: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
  };
  const ctx = {
    state: "running",
    currentTime: 0,
    destination: {},
    resume: vi.fn(async () => {}),
    createOscillator: vi.fn(() => osc),
    createGain: vi.fn(() => gain),
  };
  const Ctor = vi.fn(function makeAudioContext() {
    return ctx;
  });
  Object.defineProperty(window, "AudioContext", {
    configurable: true,
    writable: true,
    value: Ctor,
  });
  return { ctx, osc, gain };
}

beforeEach(() => {
  document.documentElement.dataset.vibe = "seru";
  delete document.documentElement.dataset.motion;
});

afterEach(() => {
  cleanup();
  setSfxGlobalEnabled(false);
  delete document.documentElement.dataset.sfx;
  delete document.documentElement.dataset.vibe;
  delete document.documentElement.dataset.motion;
  Reflect.deleteProperty(window, "AudioContext");
  Reflect.deleteProperty(window, "matchMedia");
  try {
    localStorage.removeItem("sfx");
  } catch {
    // diabaikan
  }
  vi.useRealTimers();
});

describe("B23 SFX & FX", () => {
  it("SoundToggle menyimpan pilihan dan mengatur data-sfx; default mati bila prefers-reduced-motion", () => {
    render(
      <MemoryRouter>
        <SoundProvider>
          <SoundToggle />
        </SoundProvider>
      </MemoryRouter>,
    );
    const btn = screen.getByRole("button", { name: copy.fx.soundOn });
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    expect(document.documentElement.dataset.sfx).toBe("on");

    fireEvent.click(btn);
    expect(document.documentElement.dataset.sfx).toBe("off");
    expect(localStorage.getItem("sfx")).toBe("off");

    cleanup();
    localStorage.removeItem("sfx");
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: (q: string) => ({ matches: q.includes("reduce"), media: q }),
    });
    render(
      <MemoryRouter>
        <SoundProvider>
          <SoundToggle />
        </SoundProvider>
      </MemoryRouter>,
    );
    expect(document.documentElement.dataset.sfx).toBe("off");
  });

  it("ClickFx memunculkan cincin klik di gaya seru, menggetarkan tombol nonaktif, dan memercikkan bintang", () => {
    vi.useFakeTimers();
    const { container } = render(
      <div>
        <ClickFx />
        <button type="button" onClick={(e) => burstStars(e.currentTarget)}>
          Aktif
        </button>
        <button type="button" disabled>
          Nonaktif
        </button>
      </div>,
    );
    const active = screen.getByRole("button", { name: "Aktif" });
    const disabledBtn = screen.getByRole("button", { name: "Nonaktif" });
    active.getBoundingClientRect = () =>
      ({
        left: 100,
        top: 100,
        width: 40,
        height: 20,
        right: 140,
        bottom: 120,
        x: 100,
        y: 100,
        toJSON: () => {},
      }) as DOMRect;

    fireEvent.pointerDown(active, { clientX: 50, clientY: 60 });
    expect(document.querySelector(".fx-ring")).not.toBeNull();
    fireEvent.click(active);
    expect(document.querySelectorAll(".fx-star-burst").length).toBe(CONFIG.fx.burstCount);

    fireEvent.pointerDown(disabledBtn, { clientX: 10, clientY: 10 });
    expect(disabledBtn.classList.contains("fx-shake")).toBe(true);

    // Dalam gaya Pro tidak menambah cincin baru
    document.documentElement.dataset.vibe = "pro";
    act(() => void vi.advanceTimersByTime(1000));
    expect(document.querySelectorAll(".fx-ring").length).toBe(0);
    fireEvent.pointerDown(active, { clientX: 50, clientY: 60 });
    expect(document.querySelectorAll(".fx-ring").length).toBe(0);
    expect(container).toBeTruthy();
  });

  it("synthEngine memainkan nada Web Audio untuk semua peristiwa utama tanpa galat", () => {
    const { ctx } = stubAudio();
    setSfxGlobalEnabled(true);
    unlockSfx();
    expect(synthEngine.unlock()).toBe(true);
    synthEngine.play("star", 5);
    synthEngine.play("count", 3);
    synthEngine.play("reveal", 1);
    synthEngine.play("win");
    synthEngine.play("ok");
    synthEngine.play("err");
    synthEngine.play("rank");
    synthEngine.play("ding");
    synthEngine.play("toggle", true);
    synthEngine.play("toggle", false);
    triggerSfx("pop");
    expect(ctx.createOscillator).toHaveBeenCalled();
  });
});
