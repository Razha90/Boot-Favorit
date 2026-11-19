// @vitest-environment jsdom
import { CONFIG } from "@shared/config";
import type { ResultEntry } from "@shared/results";
import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RESULT_ENTRIES } from "../../dev/fixtures";
import { copy } from "../../lib/copy";
import { assertNoBrokenUI, failAllImages } from "../../test/assertions";
import { renderEvent } from "../../test/render";
import { ResultsList } from "./ResultsList";
import { WinnerReveal } from "./WinnerReveal";

const entry = (id: string, rank: number | null, over: Partial<ResultEntry> = {}): ResultEntry => ({
  boothId: id,
  rank,
  name: `Booth ${id}`,
  boothNo: null,
  coverThumbKey: "ok:1",
  average: rank ? 5 - rank * 0.3 : 3,
  reviewCount: rank ? 10 : 1,
  score: rank ? 4.2 - rank * 0.1 : null,
  topCategories: [{ label: "Seru", count: 12 }],
  ...over,
});
const RESULTS = [
  entry("a", 1),
  entry("b", 2),
  entry("c", 3),
  entry("d", 4),
  entry("e", 5),
  entry("x", null),
];

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("ResultsList", () => {
  it("SELURUH booth tercantum; juara 1-3 berbingkai khusus berbeda; 4 dan seterusnya baris sama; belum cukup ulasan terpisah", () => {
    const { container } = renderEvent(<ResultsList results={RESULTS} />);
    const tiers = [...container.querySelectorAll("[data-tier]")].map((n) =>
      n.getAttribute("data-tier"),
    );
    expect(tiers).toEqual(["1", "2", "3", "row", "row", "row"]);
    const classes = (t: string) => container.querySelector(`[data-tier='${t}']`)?.className ?? "";
    expect(classes("1")).not.toBe(classes("2"));
    expect(classes("2")).not.toBe(classes("3")); // nada garis berbeda
    expect(classes("1")).toContain("border-primary");
    expect(screen.getByText(copy.results.unranked)).toBeTruthy();
    for (const e of RESULTS) expect(container.textContent).toContain(e.name);
  });

  it("baris menampilkan rata-rata, jumlah ulasan, skor, dan tag teratas", () => {
    const { container } = renderEvent(<ResultsList results={[entry("a", 1)]} />);
    expect(container.textContent).toContain("4,7");
    expect(container.textContent).toContain(copy.results.reviews(10));
    expect(container.textContent).toContain("skor 4,10");
    expect(container.textContent).toContain("Sering disebut: Seru 12");
    expect(screen.getByText("Juara 1")).toBeTruthy();
  });

  it("tanpa foto atau foto gagal: bingkai, tidak pernah gambar rusak (A16)", async () => {
    const { container } = renderEvent(
      <ResultsList
        results={[
          entry("a", 1, { coverThumbKey: null }),
          entry("b", 2, { coverThumbKey: "broken:1" }),
          entry("c", 4),
        ]}
      />,
    );
    await act(async () => void failAllImages(container));
    assertNoBrokenUI(container, "hasil");
    expect(container.querySelectorAll("[data-photo-frame]").length).toBeGreaterThanOrEqual(2);
  });

  it("booth tanpa ulasan: 'Belum ada ulasan', bukan 0,0; kosong total: pesan ramah", () => {
    const { container } = renderEvent(
      <ResultsList results={[entry("x", null, { average: null, reviewCount: 0 })]} />,
    );
    expect(container.textContent).toContain(copy.visitor.noRatingsYet);
    expect(container.textContent).not.toMatch(/0,0/);
    cleanup();
    renderEvent(<ResultsList results={[]} />);
    expect(screen.getByText(copy.results.empty)).toBeTruthy();
  });

  it("interaktif: nama menjadi tautan ke halaman booth; non-interaktif (layar besar): tanpa tautan", () => {
    const a = renderEvent(<ResultsList results={[entry("a", 1)]} />);
    expect(a.container.querySelector("a[href='/b/a']")).not.toBeNull();
    a.unmount();
    const b = renderEvent(<ResultsList results={[entry("a", 1)]} interactive={false} />);
    expect(b.container.querySelector("a")).toBeNull();
  });

  it("nama sangat panjang tanpa spasi dan emoji tidak merusak", () => {
    const { container } = renderEvent(
      <ResultsList
        results={[
          entry("a", 1, { name: "Warung".repeat(20) }),
          entry("b", 2, { name: "🍜 Mie Ayam 🔥" }),
        ]}
      />,
    );
    assertNoBrokenUI(container, "hasil/aneh");
  });
});

describe("WinnerReveal", () => {
  const open = (props: Partial<Parameters<typeof WinnerReveal>[0]> = {}) => {
    const onClose = vi.fn();
    const r = renderEvent(<WinnerReveal results={RESULTS} onClose={onClose} {...props} />);
    return { onClose, ...r };
  };
  const step = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
  const text = () => document.body.textContent ?? "";

  it("urutan: 3-2-1 → juara 3 → 2 → 1 → daftar hasil (±13,5 detik), tanpa confetti", () => {
    vi.useFakeTimers();
    open();
    expect(screen.getByText("3")).toBeTruthy();
    step(CONFIG.reveal.countdownStepMs);
    expect(screen.getByText("2")).toBeTruthy();
    step(CONFIG.reveal.countdownStepMs);
    expect(screen.getByText("1")).toBeTruthy();
    step(CONFIG.reveal.countdownStepMs);
    expect(screen.getByText("Juara 3")).toBeTruthy();
    expect(text()).toContain("Booth c");
    step(CONFIG.reveal.placeMs);
    expect(screen.getByText("Juara 2")).toBeTruthy();
    step(CONFIG.reveal.placeMs);
    expect(screen.getByText("Juara 1")).toBeTruthy();
    expect(text()).toContain("Booth a");
    step(CONFIG.reveal.placeMs);
    // daftar hasil akhir seluruh booth
    expect(document.querySelectorAll("[data-tier]").length).toBe(RESULTS.length);
    expect(screen.getByRole("button", { name: copy.reveal.viewPage })).toBeTruthy();
    expect(document.querySelector("canvas, [class*='confetti']")).toBeNull();
  });

  it("Lewati menutup kapan saja; Esc (cancel) menutup; di daftar tombol menjadi 'Lihat halaman'", () => {
    vi.useFakeTimers();
    const { onClose } = open();
    fireEvent.click(screen.getByRole("button", { name: copy.reveal.skip }));
    expect(onClose).toHaveBeenCalledTimes(1);
    const dialog = document.querySelector("dialog") as HTMLDialogElement;
    const esc = new Event("cancel", { cancelable: true });
    dialog.dispatchEvent(esc);
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(esc.defaultPrevented).toBe(true); // ditutup lewat state, bukan bawaan peramban
  });

  it("sentuh/klik panggung melompat ke daftar hasil", () => {
    vi.useFakeTimers();
    open();
    fireEvent.click(screen.getByRole("button", { name: copy.reveal.jump }));
    expect(document.querySelectorAll("[data-tier]").length).toBe(RESULTS.length);
    expect(screen.queryByRole("button", { name: copy.reveal.jump })).toBeNull();
  });

  it("opt-out 'jangan putar otomatis' hanya bila disediakan (mode putar-ulang), dan memanggil callback", () => {
    vi.useFakeTimers();
    const onOptOut = vi.fn();
    open({ onOptOut, optedOut: false });
    const box = screen.getByRole("checkbox", { name: copy.reveal.dontReplay });
    fireEvent.click(box);
    expect(onOptOut).toHaveBeenCalledWith(true);
    cleanup();
    open(); // pemutaran langsung oleh admin: tanpa kotak centang
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("gerak dikurangi (prefers-reduced-motion): langsung ke daftar tanpa urutan", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: (q: string) => ({ matches: q.includes("reduce"), media: q }),
    });
    try {
      open();
      expect(document.querySelectorAll("[data-tier]").length).toBe(RESULTS.length);
      expect(screen.queryByText("3")).toBeNull();
    } finally {
      Reflect.deleteProperty(window, "matchMedia");
    }
  });

  it("hanya 2 booth diperingkat: tanpa panggung juara 3; tak ada yang diperingkat: langsung daftar", () => {
    vi.useFakeTimers();
    open({ results: [entry("a", 1), entry("b", 2), entry("x", null)] });
    for (let i = 0; i < 3; i++) step(CONFIG.reveal.countdownStepMs); // tiap langkah dijadwalkan ulang setelah render
    expect(screen.getByText("Juara 2")).toBeTruthy();
    expect(screen.queryByText("Juara 3")).toBeNull();
    cleanup();
    open({ results: [entry("x", null), entry("y", null)] });
    expect(document.querySelectorAll("[data-tier]").length).toBe(2);
  });

  it("Layar Besar (tidak interaktif): tanpa tombol, kotak centang, atau tautan", () => {
    vi.useFakeTimers();
    open({ interactive: false });
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    step(20_000);
    expect(document.querySelector("a")).toBeNull();
  });

  it("dialog berlabel dan juara diumumkan lewat aria-live", () => {
    vi.useFakeTimers();
    open();
    const d = screen.getByRole("dialog", { hidden: true });
    expect(d.getAttribute("aria-label")).toBe(copy.reveal.label);
    expect(within(d).getByText("3").closest("[aria-live='polite']")).not.toBeNull();
  });
});

describe("ResultsList × setiap fixture hasil (matriks data kosong)", () => {
  for (const name of Object.keys(RESULT_ENTRIES) as (keyof typeof RESULT_ENTRIES)[]) {
    it(`hasil · ${name}: bersih sebelum dan sesudah semua gambar 404`, async () => {
      const { container } = renderEvent(<ResultsList results={RESULT_ENTRIES[name]} />);
      assertNoBrokenUI(container, `hasil/${name}`);
      await act(async () => void failAllImages(container));
      assertNoBrokenUI(container, `hasil/${name}/setelah-404`);
    });

    it(`animasi · ${name}: berjalan sampai daftar tanpa galat`, () => {
      vi.useFakeTimers();
      renderEvent(<WinnerReveal results={RESULT_ENTRIES[name]} onClose={() => {}} />);
      for (let i = 0; i < 8; i++) act(() => void vi.advanceTimersByTime(3500));
      expect(document.querySelectorAll("[data-tier]").length).toBe(RESULT_ENTRIES[name].length);
    });
  }
});
