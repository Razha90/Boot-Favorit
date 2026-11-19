// @vitest-environment jsdom
// Matriks "data kosong" (explore.md A16, B26 pengujian 1–4): setiap komponen × setiap fixture.
import { act, cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { BOOTH_NAMES, BOOTHS, PRODUCTS, sampleResolver } from "../../dev/fixtures";
import { MediaUrlProvider } from "../../lib/media-url";
import { assertNoBrokenUI, failAllImages } from "../../test/assertions";
import { BoothCard, type BoothCardVariant } from "./BoothCard";
import { BoothGrid } from "./BoothGrid";
import { FeaturedProduct, ProductCard, ProductGrid } from "./ProductCard";

afterEach(cleanup);

const mount = (ui: ReactElement) =>
  render(
    <MemoryRouter>
      <MediaUrlProvider resolve={sampleResolver}>{ui}</MediaUrlProvider>
    </MemoryRouter>,
  );

const VARIANTS: BoothCardVariant[] = ["card", "spotlight", "row", "compact", "admin"];

describe("BoothCard × fixture: tidak pernah ada UI rusak", () => {
  for (const variant of VARIANTS) {
    for (const name of BOOTH_NAMES) {
      for (const mode of ["photo", "text"] as const) {
        if (variant !== "card" && mode === "text") continue;
        it(`${variant} · ${name}${variant === "card" ? ` · ${mode}` : ""}`, async () => {
          const { container } = mount(
            <BoothCard
              booth={BOOTHS[name]}
              variant={variant}
              visualMode={mode}
              completeness="partial"
            />,
          );
          assertNoBrokenUI(container, `${variant}/${name}`);
          // Dan tetap bersih setelah SEMUA gambar gagal dimuat (404).
          await act(async () => {
            failAllImages(container);
          });
          assertNoBrokenUI(container, `${variant}/${name}/setelah-404`);
          expect(container.querySelector("img[src='']")).toBeNull();
        });
      }
    }
  }
});

describe("foto kosong = foto gagal = bingkai/hanya-teks yang SAMA", () => {
  it("kartu berfoto yang gagal dimuat tampil persis seperti kartu tanpa foto (bingkai)", async () => {
    const failed = mount(
      <BoothCard
        booth={{ ...BOOTHS.fotoGagal404, name: "Sama", boothNo: "X1" }}
        visualMode="photo"
      />,
    );
    expect(failed.container.querySelectorAll("img")).toHaveLength(1);
    await act(async () => {
      failAllImages(failed.container);
    });
    expect(failed.container.querySelectorAll("img")).toHaveLength(0);
    const frameFailed = failed.container.querySelector("[data-photo-frame]");
    expect(frameFailed?.textContent).toContain("S"); // inisial
    expect(frameFailed?.getAttribute("aria-hidden")).toBe("true");
    failed.unmount();

    const none = mount(
      <BoothCard
        booth={{
          ...BOOTHS.fotoGagal404,
          id: BOOTHS.fotoGagal404.id,
          name: "Sama",
          boothNo: "X1",
          coverThumbKey: null,
          coverKey: null,
        }}
        visualMode="photo"
      />,
    );
    const frameNone = none.container.querySelector("[data-photo-frame]");
    expect(frameNone?.outerHTML).toBe(frameFailed?.outerHTML); // identik, bukan "pesan kesalahan"
  });

  it("sorotan tanpa foto = hanya-teks; sorotan yang fotonya gagal beralih ke hanya-teks", async () => {
    const none = mount(<BoothCard booth={BOOTHS.hanyaNama} variant="spotlight" />);
    expect(none.container.querySelector("article")?.getAttribute("data-layout")).toBe("text");
    expect(none.container.querySelector("img")).toBeNull();
    none.unmount();

    const failed = mount(<BoothCard booth={BOOTHS.fotoGagal404} variant="spotlight" />);
    expect(failed.container.querySelector("article")?.getAttribute("data-layout")).toBe("photo");
    await act(async () => {
      failAllImages(failed.container);
    });
    expect(failed.container.querySelector("article")?.getAttribute("data-layout")).toBe("text");
    expect(failed.container.querySelector("h2")?.textContent).toBe(BOOTHS.fotoGagal404.name);
  });

  it("sorotan tetap punya tombol dan nama saat hanya nama", () => {
    const { container } = mount(<BoothCard booth={BOOTHS.hanyaNama} variant="spotlight" />);
    expect(container.querySelector("a")?.getAttribute("href")).toBe(`/b/${BOOTHS.hanyaNama.id}`);
    expect(container.querySelector("h2")?.textContent).toBe("Es Teh Pak Budi");
  });
});

describe("bagian teks yang kosong hilang (tidak dirender)", () => {
  it("nomor booth kosong/spasi: tidak ada stiker nomor; tagline dan deskripsi kosong: tidak ada paragraf", () => {
    const { container } = mount(<BoothCard booth={BOOTHS.stringKosong} variant="spotlight" />);
    expect(container.querySelectorAll("p")).toHaveLength(0);
    // Hanya nama + tombol; tak ada elemen stiker kosong.
    expect(container.textContent).not.toMatch(/Booth\s*$/);
  });

  it("rating belum ada: 'Belum ada ulasan', bukan 0,0", () => {
    const { container } = mount(<BoothCard booth={BOOTHS.hanyaNama} />);
    expect(container.textContent).toContain("Belum ada ulasan");
    expect(container.textContent).not.toMatch(/0,0/);
  });

  it("rating disembunyikan admin: tidak ada angka maupun bintang", () => {
    const { container } = mount(<BoothCard booth={BOOTHS.lengkap} ratingsHidden />);
    expect(container.textContent).toContain("Rating disembunyikan");
    expect(container.querySelector("[role='img']")).toBeNull();
    expect(container.textContent).not.toContain("4,7");
  });

  it("stiker harga: 'mulai Rp 14rb', 'Gratis' bila semua gratis, tidak ada bila tanpa produk", () => {
    expect(mount(<BoothCard booth={BOOTHS.lengkap} />).container.textContent).toContain("Rp 14rb");
    cleanup();
    expect(mount(<BoothCard booth={BOOTHS.gratis} />).container.textContent).toContain("Gratis");
    cleanup();
    const none = mount(<BoothCard booth={BOOTHS.hanyaNama} />).container.textContent ?? "";
    expect(none).not.toMatch(/Rp|Gratis/);
  });

  it("kartu mini andalan di sorotan: tanpa foto → hanya nama dan harga", () => {
    const withoutPhoto = {
      ...BOOTHS.lengkap,
      coverKey: null,
      featuredProduct: { id: "p", name: "Kopi", priceIdr: 18000, thumbKey: null },
    };
    const { container } = mount(<BoothCard booth={withoutPhoto} variant="spotlight" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("Kopi");
    expect(container.textContent).toContain("Rp 18.000");
  });
});

describe("keadilan: ukuran kartu seragam", () => {
  const mixed = [
    BOOTHS.lengkap,
    BOOTHS.namaDanNomor,
    BOOTHS.hanyaNama,
    BOOTHS.fotoGagal404,
    BOOTHS.namaPanjang,
  ];

  it("dalam grid campuran, semua kartu punya kelas dan rasio visual yang sama", async () => {
    const { container } = mount(<BoothGrid booths={mixed} />);
    await act(async () => {
      failAllImages(container);
    });
    const cards = [...container.querySelectorAll("li > a")];
    expect(cards).toHaveLength(mixed.length);
    // Kelas sama persis (tidak ada kartu yang lebih besar/menonjol karena datanya lengkap)
    expect(new Set(cards.map((c) => c.className)).size).toBe(1);
    const visuals = [...container.querySelectorAll("[data-card-visual]")];
    expect(visuals).toHaveLength(mixed.length);
    expect(new Set(visuals.map((v) => v.getAttribute("style"))).size).toBe(1);
    expect(visuals[0]?.getAttribute("style")).toMatch(/4\s*\/\s*3/);
  });

  it("tak satu pun berfoto → seluruh grid hanya-teks (tanpa bingkai raksasa yang identik)", () => {
    const { container } = mount(
      <BoothGrid booths={[BOOTHS.hanyaNama, BOOTHS.namaDanNomor, BOOTHS.namaSimbol]} />,
    );
    expect(container.querySelector("ul")?.getAttribute("data-visual-mode")).toBe("text");
    expect(container.querySelector("[data-card-visual]")).toBeNull();
    expect(container.querySelector("[data-photo-frame]")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    assertNoBrokenUI(container);
  });

  it("satu saja yang berfoto → mode foto; yang kosong memakai bingkai", () => {
    const { container } = mount(<BoothGrid booths={[BOOTHS.hanyaNama, BOOTHS.gratis]} />);
    expect(container.querySelector("ul")?.getAttribute("data-visual-mode")).toBe("photo");
    expect(container.querySelectorAll("[data-photo-frame]")).toHaveLength(1);
    expect(container.querySelectorAll("img")).toHaveLength(1);
  });

  it("urutan tidak bergantung pada kelengkapan data (komponen tidak mengacak)", () => {
    const { container } = mount(<BoothGrid booths={mixed} />);
    const names = [...container.querySelectorAll("h3")].map((h) => h.textContent);
    expect(names).toEqual(mixed.map((b) => b.name));
  });

  it("daftar kosong: keadaan kosong yang ramah, bukan grid kosong", () => {
    const { container } = mount(<BoothGrid booths={[]} />);
    expect(container.querySelector("ul")).toBeNull();
    expect(container.textContent).toContain("Belum ada booth");
  });
});

describe("produk: bingkai, hanya-teks, atau hilang", () => {
  it("etalase tanpa satu pun foto → daftar kompak; sebagian berfoto → bingkai untuk yang kosong", () => {
    const none = mount(
      <ProductGrid products={[PRODUCTS.tanpaFoto, PRODUCTS.gratis, PRODUCTS.namaPanjang]} />,
    );
    expect(none.container.querySelector("ul")?.getAttribute("data-visual-mode")).toBe("text");
    expect(none.container.querySelector("[data-product-visual]")).toBeNull();
    assertNoBrokenUI(none.container);
    none.unmount();

    const mixed = mount(<ProductGrid products={[PRODUCTS.lengkap, PRODUCTS.tanpaFoto]} />);
    expect(mixed.container.querySelector("ul")?.getAttribute("data-visual-mode")).toBe("photo");
    expect(mixed.container.querySelectorAll("[data-photo-frame]")).toHaveLength(1);
  });

  it("tanpa produk: tidak dirender sama sekali (tidak ada judul kosong)", () => {
    const { container } = mount(<ProductGrid products={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("andalan tanpa foto = hanya teks; foto gagal → hanya teks", async () => {
    const none = mount(<FeaturedProduct product={PRODUCTS.tanpaFoto} />);
    expect(none.container.querySelector("section")?.getAttribute("data-layout")).toBe("text");
    expect(none.container.querySelector("img")).toBeNull();
    none.unmount();

    const failed = mount(<FeaturedProduct product={PRODUCTS.fotoGagal404} />);
    await act(async () => {
      failAllImages(failed.container);
    });
    expect(failed.container.querySelector("img")).toBeNull();
    assertNoBrokenUI(failed.container);
  });

  it("harga: Gratis, harga normal dicoret hanya bila lebih besar, penanda", () => {
    const a = mount(<ProductCard product={PRODUCTS.gratis} visualMode="text" />);
    expect(a.container.textContent).toContain("Gratis");
    expect(a.container.textContent).toContain("Baru");
    a.unmount();
    const b = mount(<ProductCard product={PRODUCTS.lengkap} visualMode="photo" />);
    expect(b.container.querySelector("s")?.textContent).toContain("Rp 24.000");
    expect(b.container.textContent).toContain("Stok terbatas");
    b.unmount();
    const c = mount(
      <ProductCard product={{ ...PRODUCTS.lengkap, comparePriceIdr: 10000 }} visualMode="photo" />,
    );
    expect(c.container.querySelector("s")).toBeNull(); // normal ≤ harga → tidak dicoret
  });

  for (const name of Object.keys(PRODUCTS) as (keyof typeof PRODUCTS)[]) {
    it(`ProductCard · ${name}: bersih sebelum dan sesudah gambar gagal`, async () => {
      const { container } = mount(<ProductCard product={PRODUCTS[name]} visualMode="photo" />);
      assertNoBrokenUI(container);
      await act(async () => {
        failAllImages(container);
      });
      assertNoBrokenUI(container);
    });
  }
});
