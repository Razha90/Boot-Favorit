// @vitest-environment jsdom
// Matriks "data kosong" untuk komponen area event (explore.md A16, B26): komponen × fixture × gambar gagal.
import type { PublicEvent } from "@shared/api-types";
import { getEventState } from "@shared/event-state";
import { act, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BOOTH_NAMES, BOOTHS, PRODUCTS, REVIEWS } from "../../dev/fixtures";
import { assertNoBrokenUI, failAllImages } from "../../test/assertions";
import { isEmpty, makeEvent, photoImgs, renderEvent, SCHEDULE } from "../../test/render";
import { AboutText } from "./components/booth-parts";
import { SiteFooter } from "./components/chrome";
import { Hero } from "./components/Hero";
import { PhotoSlideshow } from "./components/PhotoSlideshow";
import { ReviewForm } from "./components/ReviewForm";
import { ReviewItem } from "./components/ReviewItem";
import { Showcase } from "./components/Showcase";
import { SpotlightSection } from "./components/SpotlightSection";
import { ThankYou } from "./components/ThankYou";

afterEach(cleanup);

/** Bersih sebelum DAN sesudah semua gambar gagal dimuat (404). */
async function assertCleanThroughFailure(container: HTMLElement, label: string) {
  assertNoBrokenUI(container, label);
  await act(async () => void failAllImages(container));
  assertNoBrokenUI(container, `${label}/setelah-404`);
}

describe("SpotlightSection × setiap fixture booth", () => {
  for (const name of BOOTH_NAMES) {
    it(`sorotan · ${name}`, async () => {
      const { container } = renderEvent(
        <SpotlightSection
          booths={[BOOTHS[name]]}
          seed="s"
          serverNow={() => 0}
          ratingsHidden={false}
        />,
      );
      await assertCleanThroughFailure(container, `sorotan/${name}`);
      expect(container.querySelector("h2")?.textContent?.trim()).toBe(BOOTHS[name].name.trim());
    });
  }

  it("rating disembunyikan: tanpa angka maupun bintang di sorotan", () => {
    const { container } = renderEvent(
      <SpotlightSection booths={[BOOTHS.lengkap]} seed="s" serverNow={() => 0} ratingsHidden />,
    );
    expect(container.textContent).not.toContain("4,7");
    expect(container.querySelector("[role='img']")).toBeNull();
  });
});

describe("Showcase × setiap fixture produk", () => {
  for (const name of Object.keys(PRODUCTS) as (keyof typeof PRODUCTS)[]) {
    it(`etalase · ${name}`, async () => {
      const { container } = renderEvent(<Showcase products={[PRODUCTS[name]]} />);
      await assertCleanThroughFailure(container, `etalase/${name}`);
    });
  }

  it("etalase campuran seluruh fixture", async () => {
    const { container } = renderEvent(<Showcase products={Object.values(PRODUCTS)} />);
    await assertCleanThroughFailure(container, "etalase/campuran");
  });
});

describe("Hero × foto suasana 0–3 (ok/gagal)", () => {
  const cases: [string, string[]][] = [
    ["tanpa foto", []],
    ["1 foto", ["ok:1"]],
    ["2 foto", ["ok:1", "ok:2"]],
    ["3 foto", ["ok:1", "ok:2", "ok:3"]],
    ["foto gagal semua", ["broken:1", "broken:2"]],
    ["kunci kosong/spasi", ["", "   "]],
  ];
  const hero = (event: PublicEvent, now: number) => {
    const state = getEventState(event.schedule, now);
    return (
      <Hero
        event={event}
        state={state}
        boothCount={0}
        serverNow={() => now}
        registrationVisible={state.registrationButtonVisible}
      />
    );
  };

  for (const [label, heroKeys] of cases) {
    for (const [phase, now] of [
      ["belum mulai", 1500],
      ["berjalan", 3500],
      ["selesai", 5000],
    ] as const) {
      it(`${label} · ${phase}`, async () => {
        const event = makeEvent({ media: { logoKey: null, ogImageKey: null, heroKeys } });
        const { container } = renderEvent(hero(event, now), { event, serverNow: now });
        await assertCleanThroughFailure(container, `hero/${label}/${phase}`);
        expect(container.querySelector("h1")?.textContent).toBe(event.name);
      });
    }
  }

  it("jadwal dengan hasil diumumkan tetap rapi", () => {
    const event = makeEvent({ schedule: { ...SCHEDULE, resultsPublishedAt: 4100 } });
    const { container } = renderEvent(hero(event, 5000), { event, serverNow: 5000 });
    assertNoBrokenUI(container, "hero/hasil");
  });
});

describe("PhotoSlideshow dan SiteFooter", () => {
  it("slideshow: satu foto, banyak foto, semua gagal", async () => {
    for (const photos of [
      [{ keyFull: "ok:1", keyThumb: "ok:1" }],
      [1, 2, 3].map((n) => ({ keyFull: `ok:${n}`, keyThumb: `ok:${n}` })),
      [{ keyFull: "broken:1", keyThumb: "broken:1" }],
    ]) {
      const { container, unmount } = renderEvent(<PhotoSlideshow photos={photos} />);
      await assertCleanThroughFailure(container, `slideshow/${photos.length}`);
      unmount();
    }
  });

  it("kaki halaman: tanpa logo, logo ok, logo gagal", async () => {
    for (const logoKey of [null, "ok:1", "broken:1", ""]) {
      const event = makeEvent({ media: { logoKey, ogImageKey: null, heroKeys: [] } });
      const { container, unmount } = renderEvent(<SiteFooter event={event} />, { event });
      await assertCleanThroughFailure(container, `footer/${logoKey}`);
      unmount();
    }
  });
});

describe("AboutText × teks aneh", () => {
  const texts = [
    "Satu baris.",
    "Baris satu\nBaris dua\n\nParagraf baru",
    "Tanpaspasi".repeat(40),
    "🍜🔥 emoji dan <b>tag</b> & entitas &amp;",
    "x".repeat(5000),
  ];
  for (const text of texts) {
    it(`teks ${text.slice(0, 18).replace(/\n/g, "⏎")}… (${text.length} huruf)`, () => {
      const { container } = renderEvent(<AboutText text={text} />);
      assertNoBrokenUI(container, "kenalan");
      expect(container.querySelector("b")).toBeNull(); // selalu di-escape
    });
  }

  it("kosong tidak dirender", () => {
    for (const t of [null, "", "  \n "]) {
      expect(isEmpty(renderEvent(<AboutText text={t} />).container)).toBe(true);
      cleanup();
    }
  });
});

describe("ReviewItem × setiap fixture ulasan", () => {
  for (const name of Object.keys(REVIEWS) as (keyof typeof REVIEWS)[]) {
    it(`ulasan · ${name}`, async () => {
      const { container } = renderEvent(<ReviewItem review={REVIEWS[name]} onReport={() => {}} />);
      await assertCleanThroughFailure(container, `ulasan/${name}`);
      expect(photoImgs(container)).toHaveLength(0);
    });
  }

  it("rating disembunyikan: tidak ada bintang di ulasan", () => {
    const { container } = renderEvent(<ReviewItem review={REVIEWS.ratingDisembunyikan} />);
    expect(container.querySelector("[role='img']")).toBeNull();
  });
});

describe("ReviewForm dan ThankYou × data kosong", () => {
  const noop = async () => {};
  it("form tanpa kategori, tanpa isian awal: tidak ada bagian kosong", () => {
    const { container } = renderEvent(<ReviewForm categories={[]} submit={noop} />);
    assertNoBrokenUI(container, "form/kosong");
    expect(container.querySelector("fieldset")).toBeNull();
  });

  it("form mengedit dengan komentar null dan kategori kosong", () => {
    const { container } = renderEvent(
      <ReviewForm
        categories={[{ id: "c1", label: "Seru" }]}
        initial={{ boothId: "b", stars: 3, comment: null, categoryIds: [], anonymous: false }}
        submit={noop}
      />,
    );
    assertNoBrokenUI(container, "form/edit-null");
    expect((container.querySelector("textarea") as HTMLTextAreaElement).value).toBe("");
  });

  it("terima kasih tanpa saran booth dan tanpa total: tidak ada daftar/kalimat kosong", () => {
    const { container } = renderEvent(
      <ThankYou
        result={{
          review: { boothId: "b", stars: 5, comment: null, categoryIds: [], anonymous: false },
          created: true,
          commentHeld: false,
          progress: { reviewed: 0, total: 0 },
          suggestions: [],
        }}
        onEdit={() => {}}
      />,
    );
    assertNoBrokenUI(container, "terimakasih/kosong");
    expect(container.querySelector("ul")).toBeNull();
    expect(container.textContent).not.toMatch(/0 dari 0/);
  });
});
