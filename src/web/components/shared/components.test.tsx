// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PhotoFrame } from "./PhotoFrame";
import { isPresent, Present } from "./Present";
import { PriceTag } from "./PriceTag";
import { ProfileCompleteness } from "./ProfileCompleteness";
import { RatingStars } from "./RatingStars";
import { RatingSummary } from "./RatingSummary";
import { SafeImage } from "./SafeImage";

afterEach(cleanup);

function Controlled({ onChange }: { onChange?: (n: number) => void }) {
  const [v, setV] = useState(0);
  return (
    <RatingStars
      mode="input"
      value={v}
      onChange={(n) => {
        setV(n);
        onChange?.(n);
      }}
    />
  );
}

describe("Present / isPresent", () => {
  it("null, undefined, false, spasi, dan larik kosong dianggap tidak ada; 0 dan objek ada", () => {
    for (const v of [null, undefined, false, "", "   ", "\n", []])
      expect(isPresent(v), String(v)).toBe(false);
    for (const v of ["a", 0, 5, true, {}, [1]]) expect(isPresent(v), String(v)).toBe(true);
  });

  it("tidak merender apa pun (termasuk induk kosong) bila datanya tidak ada", () => {
    const { container } = render(
      <div>
        <Present when="  ">
          <h2>Kenalan</h2>
        </Present>
      </div>,
    );
    expect(container.querySelector("h2")).toBeNull(); // judul ikut hilang
    expect(container.innerHTML).toBe("<div></div>");
  });
});

describe("PhotoFrame", () => {
  it("dekoratif (aria-hidden), tanpa <img>, berisi inisial; nomor hanya bila ada", () => {
    const { container, rerender } = render(
      <PhotoFrame id="b1" name="Kopi Rempah" boothNo="A12" size="md" />,
    );
    const f = container.querySelector("[data-photo-frame]");
    expect(f?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("img")).toBeNull();
    expect(f?.textContent).toContain("KR");
    expect(f?.textContent).toContain("A12");
    rerender(<PhotoFrame id="b1" name="Kopi Rempah" boothNo="   " size="md" />);
    expect(container.querySelector("[data-photo-frame]")?.textContent).toBe("KR");
  });

  it("warna stabil dari id (sama tiap dimuat) dan bervariasi antar id", () => {
    const color = (id: string) => {
      const { container } = render(<PhotoFrame id={id} name="X" />);
      const cls = container
        .querySelector("[data-photo-frame]")
        ?.className.match(/bg-sticker-\d/)?.[0];
      cleanup();
      return cls;
    };
    expect(color("abc")).toBe(color("abc"));
    const set = new Set(Array.from({ length: 30 }, (_, i) => color(`booth-${i}`)));
    expect(set.size).toBeGreaterThan(2);
  });

  it("ukuran kecil tanpa selotip/miring; nama simbol memakai cadangan", () => {
    const { container } = render(<PhotoFrame id="z" name="☕" boothNo="B9" size="xs" />);
    expect(container.querySelector("[data-photo-frame]")?.textContent).toBe("B9");
    const { container: c2 } = render(<PhotoFrame id="z" name="☕" size="xs" />);
    expect(c2.querySelector("[data-photo-frame]")?.textContent).toBe("•");
  });
});

describe("SafeImage", () => {
  it("tanpa src → fallback; src ada → <img>; error → fallback dan onFail dipanggil", () => {
    const onFail = vi.fn();
    const { container, rerender } = render(
      <SafeImage src={null} fallback={<i data-testid="fb" />} />,
    );
    expect(screen.getByTestId("fb")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();

    rerender(<SafeImage src="http://x/a.webp" fallback={<i data-testid="fb" />} onFail={onFail} />);
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("http://x/a.webp");
    fireEvent.error(img);
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByTestId("fb")).toBeTruthy();
  });

  it("src baru = coba lagi setelah gagal", () => {
    const { container, rerender } = render(<SafeImage src="http://x/a.webp" />);
    fireEvent.error(container.querySelector("img") as HTMLImageElement);
    expect(container.querySelector("img")).toBeNull();
    rerender(<SafeImage src="http://x/b.webp" />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("http://x/b.webp");
  });

  it("fallback null = komponen hilang (strategi 'hilang')", () => {
    const { container } = render(<SafeImage src={null} fallback={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("menahan ruang dengan aspect-ratio (tanpa layout shift)", () => {
    const { container } = render(<SafeImage src="http://x/a.webp" aspect="4/3" />);
    expect(container.querySelector("img")?.getAttribute("style")).toMatch(/aspect-ratio/);
  });
});

describe("RatingStars", () => {
  it("display: label aksesibel dengan nilai; tanpa nilai = 0 bintang", () => {
    render(<RatingStars mode="display" value={4.66} />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe("4,7 dari 5 bintang");
    cleanup();
    render(<RatingStars mode="display" value={null} />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe("0 dari 5 bintang");
  });

  it("input: radiogroup, klik memilih, aria-checked mengikuti", () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(5);
    fireEvent.click(radios[3] as HTMLElement);
    expect(onChange).toHaveBeenCalledWith(4);
    expect(screen.getAllByRole("radio").map((r) => r.getAttribute("aria-checked"))).toEqual([
      "false",
      "false",
      "false",
      "true",
      "false",
    ]);
  });

  it("input: bisa dioperasikan keyboard (panah, Home, End) dengan satu titik fokus", () => {
    render(<Controlled />);
    const tab = () => screen.getAllByRole("radio").map((r) => r.getAttribute("tabindex"));
    expect(tab()).toEqual(["0", "-1", "-1", "-1", "-1"]); // belum memilih: bintang pertama
    fireEvent.keyDown(screen.getAllByRole("radio")[0] as HTMLElement, { key: "ArrowRight" });
    expect(screen.getAllByRole("radio")[1]?.getAttribute("aria-checked")).toBe("true");
    expect(tab()).toEqual(["-1", "0", "-1", "-1", "-1"]);
    fireEvent.keyDown(screen.getAllByRole("radio")[1] as HTMLElement, { key: "End" });
    expect(screen.getAllByRole("radio")[4]?.getAttribute("aria-checked")).toBe("true");
    fireEvent.keyDown(screen.getAllByRole("radio")[4] as HTMLElement, { key: "ArrowRight" }); // batas atas
    expect(screen.getAllByRole("radio")[4]?.getAttribute("aria-checked")).toBe("true");
    fireEvent.keyDown(screen.getAllByRole("radio")[4] as HTMLElement, { key: "Home" });
    expect(screen.getAllByRole("radio")[0]?.getAttribute("aria-checked")).toBe("true");
  });

  it("input: disabled menonaktifkan semua bintang", () => {
    render(<RatingStars mode="input" value={2} onChange={() => {}} disabled />);
    for (const r of screen.getAllByRole("radio"))
      expect((r as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("RatingSummary", () => {
  it("normal, belum ada ulasan, dan disembunyikan", () => {
    const { container, rerender } = render(<RatingSummary average={4.7} count={24} />);
    expect(container.textContent).toContain("4,7");
    expect(container.textContent).toContain("(24)");
    rerender(<RatingSummary average={null} count={0} />);
    expect(container.textContent).toBe("Belum ada ulasan");
    rerender(<RatingSummary average={4.7} count={0} />); // jumlah 0 mengalahkan rata-rata yang tersisa
    expect(container.textContent).toBe("Belum ada ulasan");
    rerender(<RatingSummary average={4.7} count={24} hidden />);
    expect(container.textContent).toBe("Rating disembunyikan");
  });
});

describe("PriceTag", () => {
  it("format rupiah, Gratis, dan ringkas", () => {
    const { container, rerender } = render(<PriceTag priceIdr={18000} />);
    expect(container.textContent).toBe("Rp 18.000");
    rerender(<PriceTag priceIdr={0} />);
    expect(container.textContent).toBe("Gratis");
    rerender(<PriceTag priceIdr={14500} size="short" />);
    expect(container.textContent).toBe("Rp 14,5rb");
  });

  it("harga normal dicoret hanya bila lebih besar; tidak untuk ringkas", () => {
    const { container, rerender } = render(<PriceTag priceIdr={18000} compareIdr={24000} />);
    expect(container.querySelector("s")?.textContent).toContain("Rp 24.000");
    rerender(<PriceTag priceIdr={18000} compareIdr={18000} />);
    expect(container.querySelector("s")).toBeNull();
    rerender(<PriceTag priceIdr={18000} compareIdr={24000} size="short" />);
    expect(container.querySelector("s")).toBeNull();
  });
});

describe("ProfileCompleteness", () => {
  it("chip menurut tingkat; saran lembut hanya untuk yang belum lengkap", () => {
    const { container, rerender } = render(<ProfileCompleteness level="name_only" />);
    expect(container.textContent).toBe("Hanya nama");
    rerender(<ProfileCompleteness level="name_only" variant="hint" />);
    expect(container.textContent).toContain("Tambahkan foto");
    rerender(<ProfileCompleteness level="partial" variant="hint" />);
    expect(container.textContent).toContain("lengkapi");
    rerender(<ProfileCompleteness level="full" variant="hint" />);
    expect(container.innerHTML).toBe(""); // lengkap: tidak ada saran
  });
});
