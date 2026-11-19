// @vitest-environment jsdom
// Stiker kartun makanan pengganti foto + baris institusi pada kartu booth (explore.md A16, B27).
import { foodArtFor, foodArtPath } from "@shared/food-art";
import { act, cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { BOOTHS, sampleResolver } from "../../dev/fixtures";
import { MediaUrlProvider } from "../../lib/media-url";
import { failAllImages } from "../../test/assertions";
import { photoImgs } from "../../test/render";
import { BoothCard } from "./BoothCard";
import { BoothGrid } from "./BoothGrid";

afterEach(cleanup);

const mount = (ui: ReactElement) =>
  render(
    <MemoryRouter>
      <MediaUrlProvider resolve={sampleResolver}>{ui}</MediaUrlProvider>
    </MemoryRouter>,
  );

const artImgs = (root: ParentNode) =>
  [...root.querySelectorAll("img")].filter((i) => i.getAttribute("src")?.startsWith("/art/food/"));

describe("stiker makanan di kartu booth", () => {
  it("tanpa foto: stiker dekoratif dengan ilustrasi yang ditentukan id booth (alt kosong)", () => {
    const { container } = mount(<BoothCard booth={BOOTHS.hanyaNama} />);
    const [art] = artImgs(container);
    expect(artImgs(container)).toHaveLength(1);
    expect(art?.getAttribute("src")).toBe(foodArtPath(foodArtFor(BOOTHS.hanyaNama.id)));
    expect(art?.getAttribute("alt")).toBe("");
    expect(photoImgs(container)).toHaveLength(0);
  });

  it("berfoto: tidak ada stiker; foto yang gagal dimuat menjadi kartu bersetiker", async () => {
    const ok = mount(<BoothCard booth={BOOTHS.lengkap} />);
    expect(artImgs(ok.container)).toHaveLength(0);
    cleanup();

    const failed = mount(<BoothCard booth={BOOTHS.fotoGagal404} />);
    // sebelum 404: foto dicoba dimuat, belum ada stiker
    expect(photoImgs(failed.container)).toHaveLength(1);
    await act(async () => {
      for (const img of photoImgs(failed.container)) img.dispatchEvent(new Event("error"));
    });
    expect(photoImgs(failed.container)).toHaveLength(0);
    expect(artImgs(failed.container)).toHaveLength(1);
  });

  it("stiker yang berkasnya gagal dimuat hilang bersih (tidak pernah ikon rusak)", async () => {
    const { container } = mount(<BoothCard booth={BOOTHS.hanyaNama} />);
    await act(async () => {
      failAllImages(container);
    });
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(container.querySelector("h3")?.textContent).toBe(BOOTHS.hanyaNama.name);
  });

  it("sorotan hanya-teks memakai stiker besar + hiasan kecil; sorotan berfoto tidak", () => {
    const text = mount(<BoothCard booth={BOOTHS.hanyaNama} variant="spotlight" />);
    expect(text.container.querySelector("article")?.getAttribute("data-layout")).toBe("text");
    expect(artImgs(text.container)).toHaveLength(3); // satu besar + dua hiasan kecil
    cleanup();
    const photo = mount(<BoothCard booth={BOOTHS.lengkap} variant="spotlight" />);
    expect(photo.container.querySelector("article")?.getAttribute("data-layout")).toBe("photo");
    expect(artImgs(photo.container)).toHaveLength(0);
  });

  it("di grid, ilustrasi bervariasi antar booth tetapi stabil untuk booth yang sama", () => {
    const booths = Array.from({ length: 12 }, (_, i) => ({
      ...BOOTHS.hanyaNama,
      id: `b-${i}`,
      name: `Booth ${i}`,
    }));
    const { container } = mount(<BoothGrid booths={booths} />);
    const srcs = artImgs(container).map((i) => i.getAttribute("src"));
    expect(srcs).toHaveLength(12);
    expect(new Set(srcs).size).toBeGreaterThan(4);
    cleanup();
    const again = mount(<BoothGrid booths={booths} />);
    expect(artImgs(again.container).map((i) => i.getAttribute("src"))).toEqual(srcs);
  });
});

describe("institusi/fakultas di kartu booth", () => {
  it("tampil di kartu, sorotan, dan baris peringkat bila ada", () => {
    for (const variant of ["card", "spotlight", "row"] as const) {
      const { container } = mount(<BoothCard booth={BOOTHS.lengkap} variant={variant} />);
      expect(container.textContent, variant).toContain("Fakultas Pariwisata");
      cleanup();
    }
  });

  it("kosong: kartu tetap punya baris yang disisakan (tinggi seragam) tetapi tanpa teks atau <p> kosong", () => {
    const filled = mount(<BoothCard booth={BOOTHS.lengkap} />);
    const empty = mount(<BoothCard booth={BOOTHS.hanyaNama} />);
    const lines = (c: HTMLElement) => c.querySelectorAll("span.h-4.truncate").length;
    expect(lines(filled.container)).toBe(1);
    expect(lines(empty.container)).toBe(1);
    expect(empty.container.querySelectorAll("p")).toHaveLength(0);
    // baris peringkat dan sorotan: tidak ada baris kosong sama sekali
    cleanup();
    const row = mount(<BoothCard booth={BOOTHS.hanyaNama} variant="row" />);
    expect(row.container.textContent).toContain("Es Teh Pak Budi");
    expect(row.container.querySelectorAll("span.truncate")).toHaveLength(1); // hanya nama
  });
});
