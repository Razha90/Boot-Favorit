// @vitest-environment jsdom
// Pita statistik langsung di antara hero dan daftar booth (beranda).
import { cleanup, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { renderEvent } from "../../test/render";
import { StatsBand, type StatsBandProps } from "./components/StatsBand";

afterEach(cleanup);

const HOUR = 3_600_000;
const props = (over: Partial<StatsBandProps> = {}): StatsBandProps => ({
  stats: { reviewCount: 30, boothCount: 3, average: 4.07 },
  ratingsHidden: false,
  state: { phase: "live", frozen: false },
  eventStartAt: 0,
  eventEndAt: 21 * HOUR,
  serverNow: () => 0,
  liveConnected: false,
  ...over,
});

const band = () => within(screen.getByRole("region", { name: "Ringkasan acara" }));

describe("StatsBand", () => {
  it("menampilkan booth, ulasan, rata-rata (koma desimal), dan hitung mundur voting", () => {
    renderEvent(<StatsBand {...props()} />);
    expect(band().getByText("3")).toBeTruthy();
    expect(band().getByText("30")).toBeTruthy();
    expect(band().getByText("4,07")).toBeTruthy();
    expect(band().getByText(/lagi voting ditutup/i)).toBeTruthy();
    expect(band().getByText(/21 jam/)).toBeTruthy();
  });

  it("rating disembunyikan admin: ulasan dan rata-rata tidak ditampilkan sama sekali", () => {
    renderEvent(<StatsBand {...props({ ratingsHidden: true })} />);
    const text = screen.getByRole("region", { name: "Ringkasan acara" }).textContent ?? "";
    expect(text).not.toContain("30");
    expect(text).not.toContain("4,07");
    expect(text).not.toMatch(/ulasan masuk|rata-rata/i);
    expect(band().getByText("3")).toBeTruthy();
  });

  it("belum ada rata-rata (belum ada ulasan): kotak rata-rata tidak dirender; ulasan tampil 0", () => {
    renderEvent(
      <StatsBand {...props({ stats: { reviewCount: 0, boothCount: 3, average: null } })} />,
    );
    expect(band().queryByText(/rata-rata bintang/i)).toBeNull();
    expect(band().getByText("0")).toBeTruthy();
  });

  it("status event: belum mulai → 'lagi voting dibuka'; selesai → 'Selesai'", () => {
    renderEvent(
      <StatsBand
        {...props({ state: { phase: "upcoming", frozen: false }, eventStartAt: 2 * HOUR })}
      />,
    );
    expect(band().getByText(/lagi voting dibuka/i)).toBeTruthy();
    cleanup();
    renderEvent(<StatsBand {...props({ state: { phase: "ended", frozen: true } })} />);
    expect(band().getByText("Selesai")).toBeTruthy();
    expect(band().getByText("voting ditutup")).toBeTruthy();
  });

  it("tanda LIVE hanya saat koneksi live aktif dan voting berlangsung; tanpa peringkat atau skor booth", () => {
    renderEvent(<StatsBand {...props({ liveConnected: true })} />);
    expect(band().getByText("LIVE")).toBeTruthy();
    cleanup();
    renderEvent(<StatsBand {...props({ liveConnected: false })} />);
    expect(band().queryByText("LIVE")).toBeNull();
    expect(screen.getByRole("region", { name: "Ringkasan acara" }).textContent).not.toMatch(
      /peringkat|skor|juara/i,
    );
  });
});
