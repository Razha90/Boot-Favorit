// @vitest-environment jsdom
// Poster QR cetak (explore.md B29): isi poster, kemudahan pindai (zona tenang, ECC), dan tombol cetak satu poster.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { encode } from "uqr";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PosterPrintButton } from "./PosterPrint";
import { QrCode } from "./QrCode";
import { type PosterContent, QrPoster } from "./QrPoster";

afterEach(() => {
  cleanup();
  document.body.classList.remove("poster-printing");
});

const BOOTH: PosterContent = {
  kind: "booth",
  eventName: "Expo Rasa",
  title: "Kopi Rempah",
  badge: "Booth A1",
  teamName: "Fakultas Teknik",
  tagline: "Hangat di lidah",
  url: "https://eventunimed.id/b/abc?src=qr",
  displayUrl: "eventunimed.id",
  qrLabel: "QR booth Kopi Rempah",
  seed: "abc",
};

describe("QrCode: mudah dipindai", () => {
  it("zona tenang 4 modul di semua sisi (standar QR) dan koreksi galat dapat dipilih", () => {
    const value = "https://eventunimed.id/";
    const n = encode(value, { ecc: "M", border: 0 }).size;
    const { container } = render(<QrCode value={value} label="x" />);
    expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe(`0 0 ${n + 8} ${n + 8}`);
    // tidak ada modul gelap di dalam zona tenang: koordinat terkecil >= 4
    const d = container.querySelector("path")?.getAttribute("d") ?? "";
    const coords = [...d.matchAll(/M(\d+) (\d+)h/g)].map((m) => [Number(m[1]), Number(m[2])]);
    expect(Math.min(...coords.map((c) => c[0] ?? 99))).toBeGreaterThanOrEqual(4);
    expect(Math.min(...coords.map((c) => c[1] ?? 99))).toBeGreaterThanOrEqual(4);
    expect(Math.max(...coords.map((c) => c[0] ?? 0))).toBeLessThan(n + 4);

    const q = render(<QrCode value={value} label="q" ecc="Q" plain />);
    const sizeQ = q.container.querySelector("svg")?.getAttribute("viewBox");
    expect(sizeQ).toBeTruthy();
    expect(q.container.querySelector("svg")?.getAttribute("class")).not.toContain("rounded-card");
  });
});

describe("QrPoster", () => {
  it("poster booth: nama, nomor, institusi, tagline, QR berlabel, langkah, logo resmi, stiker, alamat", () => {
    const { container } = render(<QrPoster size="a4" {...BOOTH} />);
    expect(container.textContent).toContain("Kopi Rempah");
    expect(container.textContent).toContain("Booth A1");
    expect(container.textContent).toContain("Fakultas Teknik");
    expect(container.textContent).toContain("Hangat di lidah");
    expect(container.textContent).toContain("Pindai di sini");
    expect(container.textContent).toContain("Pindai untuk melihat produk");
    expect(container.textContent).toContain("eventunimed.id");
    expect(container.textContent).toContain("LPPM UNIMED");
    expect(screen.getByRole("img", { name: "QR booth Kopi Rempah" })).toBeTruthy();
    expect(container.querySelectorAll("ol li")).toHaveLength(3);
    expect(container.querySelector("img[src='/brand/lppm-logo.png']")).not.toBeNull();
    expect(container.querySelectorAll("img[src^='/art/food/']")).toHaveLength(4);
  });

  it("data opsional kosong: tidak ada elemen kosong; poster pendaftaran tanpa langkah penilaian", () => {
    const { container } = render(
      <QrPoster
        size="a4"
        {...BOOTH}
        kind="register"
        badge={null}
        teamName={null}
        tagline={null}
        title="Pendaftaran Booth"
      />,
    );
    const empties = [...container.querySelectorAll("p, h2, li, span")].filter(
      (el) => el.childElementCount === 0 && !el.textContent?.trim() && !el.closest("[aria-hidden]"),
    );
    expect(empties).toHaveLength(0);
    expect(container.querySelectorAll("ol")).toHaveLength(0);
    expect(container.textContent).toContain("mendaftarkan booth kamu");
  });

  it("ukuran A4 dan A5 memiliki rasio dan ukuran cetak masing-masing; gambar eager untuk cetak", () => {
    const a4 = render(<QrPoster size="a4" {...BOOTH} />).container.querySelector("article");
    expect(a4?.className).toContain("aspect-[210/297]");
    expect(a4?.className).toContain("print:w-[210mm]");
    cleanup();
    const a5 = render(<QrPoster size="a5" eager {...BOOTH} />);
    expect(a5.container.querySelector("article")?.className).toContain("print:w-[148mm]");
    expect(a5.container.querySelector("img")?.getAttribute("loading")).toBe("eager");
  });

  it("pesan wajib di QR utama event dan booth berbeda", () => {
    const e = render(<QrPoster size="a4" {...BOOTH} kind="event" title="Jelajahi" />);
    expect(e.container.textContent).toContain("menjelajahi semua booth");
  });
});

describe("PosterPrintButton (portal booth)", () => {
  it("memilih ukuran, lalu mencetak SATU poster lewat lapisan cetak dan membersihkannya setelah cetak", async () => {
    const print = vi.fn();
    window.print = print;
    render(
      <MemoryRouter>
        <PosterPrintButton content={BOOTH} />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("Ukuran kertas"), { target: { value: "a5" } });
    fireEvent.click(screen.getByRole("button", { name: "Cetak poster QR" }));
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    const layer = document.body.querySelector(".poster-print-root");
    expect(layer?.querySelectorAll("article[data-poster='booth']")).toHaveLength(1);
    expect(layer?.querySelector("style")?.textContent).toContain("size: a5 portrait");
    expect(layer?.querySelector("img")?.getAttribute("loading")).toBe("eager");
    await act(async () => {
      window.dispatchEvent(new Event("afterprint"));
    });
    expect(document.body.querySelector(".poster-print-root")).toBeNull();
  });
});
