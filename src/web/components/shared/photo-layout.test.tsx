// @vitest-environment jsdom
// Tata letak tahan foto yang datang belakangan (booth mengunggah foto di tengah event): slot seragam, tanpa tinggi
// meledak, tanpa kolom kosong saat foto gagal. Pengukuran piksel sungguhan: scripts/e2e/photo-stress.mjs.
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { BOOTHS, PRODUCTS, sampleResolver } from "../../dev/fixtures";
import { MediaUrlProvider } from "../../lib/media-url";
import { failAllImages } from "../../test/assertions";
import { BoothCard } from "./BoothCard";
import { FeaturedProduct, ProductGrid } from "./ProductCard";
import { SafeImage } from "./SafeImage";

afterEach(cleanup);

const mount = (ui: React.ReactElement) =>
  render(
    <MemoryRouter>
      <MediaUrlProvider resolve={sampleResolver}>{ui}</MediaUrlProvider>
    </MemoryRouter>,
  );

describe("SafeImage: ukuran tidak saling bertabrakan", () => {
  it("tanpa kelas tinggi → h-auto; dengan h-*/size-* → TIDAK ada h-auto (foto sangat tinggi tidak meledak)", () => {
    const a = render(<SafeImage src="/x.png" className="w-full" />);
    expect(a.container.querySelector("img")?.className).toContain("h-auto");
    cleanup();
    for (const cls of ["size-full", "h-44! w-full", "w-full h-12"]) {
      const r = render(<SafeImage src="/x.png" className={cls} />);
      expect(r.container.querySelector("img")?.className, cls).not.toContain("h-auto");
      cleanup();
    }
    // tinggi hanya pada breakpoint (md:h-72) atau kelas yang hanya mirip: h-auto dasar tetap (md:h-72 menimpanya di md ke atas)
    const bp = render(<SafeImage src="/x.png" className="md:h-72" />);
    expect(bp.container.querySelector("img")?.className).toContain("h-auto");
    cleanup();
    const r = render(<SafeImage src="/x.png" className="light-box" />);
    expect(r.container.querySelector("img")?.className).toContain("h-auto");
  });
});

describe("etalase produk campuran", () => {
  const withPhoto = PRODUCTS.lengkap ?? Object.values(PRODUCTS)[0];
  const noPhoto = { ...(withPhoto as object), id: "p-none", thumbKey: null, fullKey: null };
  const withPhoto2 = { ...(withPhoto as object), id: "p-foto", thumbKey: "ok:1", fullKey: "ok:1" };
  const broken = {
    ...(withPhoto as object),
    id: "p-rusak",
    thumbKey: "broken:1",
    fullKey: "broken:1",
  };
  const products = [withPhoto2, noPhoto, broken] as never[];

  it("mode foto: SEMUA kartu punya slot 1:1 yang sama; tanpa foto/gagal = ubin ilustrasi", async () => {
    const { container } = mount(<ProductGrid products={products} />);
    const slots = () => [...container.querySelectorAll("[data-product-visual]")];
    expect(slots()).toHaveLength(3);
    expect(new Set(slots().map((s) => s.getAttribute("style"))).size).toBe(1);
    expect(container.querySelectorAll("[data-product-art]")).toHaveLength(1); // yang tanpa foto
    await act(async () => {
      failAllImages(container);
    });
    expect(slots()).toHaveLength(3); // tetap satu slot per kartu setelah foto gagal
    expect(container.querySelectorAll("[data-product-art]")).toHaveLength(3);
    expect(container.querySelectorAll("[data-photo-frame]")).toHaveLength(0);
  });

  it("tak satu pun berfoto: daftar kompak tanpa slot (tidak ada kotak raksasa)", () => {
    const { container } = mount(<ProductGrid products={[noPhoto, noPhoto] as never[]} />);
    expect(container.querySelector("ul")?.getAttribute("data-visual-mode")).toBe("text");
    expect(container.querySelector("[data-product-visual]")).toBeNull();
  });
});

describe("produk andalan: foto gagal dimuat", () => {
  it("beralih ke tata letak hanya-teks tanpa kolom kosong", async () => {
    const p = {
      ...(Object.values(PRODUCTS)[0] as object),
      fullKey: "broken:1",
      thumbKey: "broken:1",
    } as never;
    const { container } = mount(<FeaturedProduct product={p} />);
    expect(container.querySelector("section")?.getAttribute("data-layout")).toBe("photo");
    await act(async () => {
      failAllImages(container);
    });
    const section = container.querySelector("section");
    expect(section?.getAttribute("data-layout")).toBe("text");
    expect(section?.className).not.toContain("sm:grid-cols-2");
    fireEvent.error(document.body); // tidak berbahaya
  });
});

describe("sorotan booth: tinggi sama untuk tata letak foto dan hanya-teks", () => {
  it("kedua tata letak memakai tinggi minimum yang sama (halaman di bawahnya tidak melompat saat berotasi)", () => {
    const text = mount(<BoothCard booth={BOOTHS.hanyaNama} variant="spotlight" />);
    const photo = mount(<BoothCard booth={BOOTHS.lengkap} variant="spotlight" />);
    const minH = (c: HTMLElement) =>
      /min-h-\[30rem\].*md:min-h-\[23rem\]/.test(c.querySelector("article")?.className ?? "");
    expect(minH(text.container)).toBe(true);
    expect(minH(photo.container)).toBe(true);
    expect(photo.container.querySelector("article")?.getAttribute("data-layout")).toBe("photo");
    expect(text.container.querySelector("article")?.getAttribute("data-layout")).toBe("text");
  });
});
