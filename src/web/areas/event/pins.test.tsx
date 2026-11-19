// @vitest-environment jsdom
// Booth sematan (explore.md B28): tombol di kartu/sorotan, tombol Sematan di kanan atas, penyimpanan lokal.
import { CONFIG } from "@shared/config";
import { getEventState } from "@shared/event-state";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BoothCard } from "../../components/shared/BoothCard";
import { BoothGrid } from "../../components/shared/BoothGrid";
import { BOOTHS } from "../../dev/fixtures";
import { pinsKey, readPins } from "../../lib/pins";
import { makeEvent, memStore, renderEvent, SCHEDULE } from "../../test/render";
import { PinFab } from "./components/PinFab";

afterEach(cleanup);

// jsdom: <dialog> belum punya showModal/close
HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
  this.setAttribute("open", "");
};
HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
  this.removeAttribute("open");
};

const LIST = [BOOTHS.lengkap, BOOTHS.namaDanNomor, BOOTHS.hanyaNama];

describe("PinButton di kartu booth", () => {
  it("sematkan/lepas: aria-pressed berganti dan tersimpan di penyimpanan lokal per event", () => {
    const store = memStore();
    renderEvent(<BoothGrid booths={LIST} />, { store });
    const btn = screen.getByRole("button", { name: `Sematkan booth ${BOOTHS.hanyaNama.name}` });
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(btn);
    expect(
      screen
        .getByRole("button", { name: `Lepas sematan booth ${BOOTHS.hanyaNama.name}` })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(readPins(store, "ev1")).toEqual([BOOTHS.hanyaNama.id]);
    expect(store.get(pinsKey("ev1"))).toContain(BOOTHS.hanyaNama.id);
    fireEvent.click(
      screen.getByRole("button", { name: `Lepas sematan booth ${BOOTHS.hanyaNama.name}` }),
    );
    expect(readPins(store, "ev1")).toEqual([]);
  });

  it("tombol sematkan tidak bersarang di dalam tautan kartu (HTML valid)", () => {
    const { container } = renderEvent(<BoothGrid booths={LIST} />);
    expect(container.querySelectorAll("a button")).toHaveLength(0);
    expect(container.querySelectorAll("li > button")).toHaveLength(LIST.length);
  });

  it("sorotan punya tombol sematkan berlabel di samping tombol utamanya", () => {
    renderEvent(<BoothCard booth={BOOTHS.hanyaNama} variant="spotlight" />);
    expect(screen.getByRole("button", { name: /Sematkan booth/ }).textContent).toContain(
      "Sematkan",
    );
  });

  it("tidak dirender setelah event selesai, dan tidak mengubah urutan kartu", () => {
    const ended = makeEvent();
    const { container } = renderEvent(<BoothGrid booths={LIST} />, {
      event: ended,
      serverNow: SCHEDULE.eventEndAt + 10,
    });
    expect(getEventState(ended.schedule, SCHEDULE.eventEndAt + 10).frozen).toBe(true);
    expect(container.querySelectorAll("li > button")).toHaveLength(0);

    cleanup();
    const store = memStore();
    const first = renderEvent(<BoothGrid booths={LIST} />, { store });
    const before = [...first.container.querySelectorAll("h3")].map((h) => h.textContent);
    fireEvent.click(screen.getByRole("button", { name: /Sematkan booth Es Teh/ }));
    const after = [...first.container.querySelectorAll("h3")].map((h) => h.textContent);
    expect(after).toEqual(before); // sematan pribadi tidak menggeser urutan (keadilan A8)
  });

  it("batas sematan: yang melebihi batas tidak tersimpan", () => {
    const store = memStore();
    store.set(
      pinsKey("ev1"),
      JSON.stringify(Array.from({ length: CONFIG.booth.pinsMax }, (_, i) => `x${i}`)),
    );
    renderEvent(<BoothGrid booths={LIST} />, { store });
    fireEvent.click(screen.getByRole("button", { name: /Sematkan booth Es Teh/ }));
    expect(readPins(store, "ev1")).toHaveLength(CONFIG.booth.pinsMax);
    expect(readPins(store, "ev1")).not.toContain(BOOTHS.hanyaNama.id);
  });
});

describe("readPins: data rusak tidak menjadi galat", () => {
  it("bukan array, JSON rusak, duplikat, dan nilai bukan teks dibersihkan", () => {
    const s = memStore();
    s.set(pinsKey("e"), "{bukan json");
    expect(readPins(s, "e")).toEqual([]);
    s.set(pinsKey("e"), JSON.stringify({ a: 1 }));
    expect(readPins(s, "e")).toEqual([]);
    s.set(pinsKey("e"), JSON.stringify(["a", "a", 3, "", "b"]));
    expect(readPins(s, "e")).toEqual(["a", "b"]);
  });
});

describe("PinFab: tombol Sematan di kanan atas", () => {
  it("terpasang di kanan atas dengan hitungan; kosong → petunjuk", () => {
    renderEvent(<PinFab booths={LIST} ratingsHidden={false} />);
    const fab = screen.getByRole("button", { name: /Booth sematanku, 0 disematkan/ });
    expect(fab.className).toContain("right-4");
    expect(fab.className).toContain("fixed"); // posisi atas diatur lewat style (env safe-area), tidak dibaca jsdom
    fireEvent.click(fab);
    expect(screen.getByText(/Belum ada booth yang kamu sematkan/)).toBeTruthy();
  });

  it("daftar menurut nomor booth (bukan rating), memuat institusi, tautan ke booth, lepas satu/semua", () => {
    const store = memStore();
    store.set(pinsKey("ev1"), JSON.stringify([BOOTHS.namaDanNomor.id, BOOTHS.lengkap.id]));
    renderEvent(<PinFab booths={LIST} ratingsHidden={false} />, { store });
    fireEvent.click(screen.getByRole("button", { name: /Booth sematanku, 2 disematkan/ }));
    const dialog = screen.getByRole("dialog", { hidden: true });
    const names = within(dialog)
      .getAllByRole("link")
      .map((a) => a.textContent ?? "");
    expect(names[0]).toContain("A12"); // A12 sebelum B7
    expect(names[1]).toContain("B7");
    expect(dialog.textContent).toContain("Fakultas Pariwisata");
    expect(within(dialog).getAllByRole("link")[0]?.getAttribute("href")).toBe(
      `/b/${BOOTHS.lengkap.id}`,
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: /Lepas sematan booth Kopi Rempah/ }),
    );
    expect(readPins(store, "ev1")).toEqual([BOOTHS.namaDanNomor.id]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Lepas semua" }));
    expect(readPins(store, "ev1")).toEqual([]);
  });

  it("sematan booth yang sudah tidak tayang dibuang saat snapshot dimuat", () => {
    const store = memStore();
    store.set(pinsKey("ev1"), JSON.stringify(["hilang", BOOTHS.lengkap.id]));
    renderEvent(<PinFab booths={LIST} ratingsHidden={false} />, { store });
    expect(readPins(store, "ev1")).toEqual([BOOTHS.lengkap.id]);
  });

  it("rating disembunyikan admin tidak bocor di daftar sematan", () => {
    const store = memStore();
    store.set(pinsKey("ev1"), JSON.stringify([BOOTHS.lengkap.id]));
    renderEvent(<PinFab booths={LIST} ratingsHidden />, { store });
    fireEvent.click(screen.getByRole("button", { name: /Booth sematanku/ }));
    expect(screen.getByRole("dialog", { hidden: true }).textContent).not.toContain("4,7");
  });

  it("tidak dirender setelah event selesai", () => {
    const { container } = renderEvent(<PinFab booths={LIST} ratingsHidden={false} />, {
      serverNow: SCHEDULE.eventEndAt + 10,
    });
    expect(container.querySelector("button")).toBeNull();
  });
});
