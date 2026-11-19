// @vitest-environment jsdom
// Tes halaman pengunjung dari ujung ke ujung (layout + data + halaman) dengan `fetch` palsu.
import type {
  PublicBoothDetail,
  PublicEvent,
  PublicEventResponse,
  PublicProducts,
  PublicReviews,
  PublicSnapshot,
} from "@shared/api-types";
import type { EventSchedule } from "@shared/event-state";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BOOTH_NAMES, BOOTHS, PRODUCTS, sampleResolver } from "../../dev/fixtures";
import { copy } from "../../lib/copy";
import { MediaUrlProvider } from "../../lib/media-url";
import { assertNoBrokenUI, failAllImages } from "../../test/assertions";
import { makeEvent } from "../../test/render";
import { Component as Layout } from "./layout";
import { Component as BoothPage } from "./pages/booth";
import { Component as HomePage } from "./pages/home";

const DAY = 86_400_000;

/** Jadwal relatif terhadap sekarang agar jam lokal (Date.now) dan jam server konsisten. */
const scheduleAt = (phase: "upcoming" | "live" | "ended"): EventSchedule => {
  const t = Date.now();
  // [buka daftar, tutup daftar, mulai, selesai] dalam hari relatif terhadap sekarang
  // Offset dalam hari terhadap sekarang.
  const o = {
    upcoming: { open: -2, close: -1, start: 1, end: 2 },
    live: { open: -3, close: -2, start: -1, end: 1 },
    ended: { open: -4, close: -3, start: -2, end: -1 },
  }[phase];
  return {
    registrationOpenAt: t + o.open * DAY,
    registrationCloseAt: t + o.close * DAY,
    eventStartAt: t + o.start * DAY,
    eventEndAt: t + o.end * DAY,
    resultsPublishedAt: null,
    allowLateRegistration: false,
  };
};

interface Api {
  event: PublicEventResponse | "fail";
  snapshot: PublicSnapshot | "fail";
  booth: Record<string, PublicBoothDetail>;
  products: Record<string, PublicProducts>;
  /** Ulasan publik per booth (bawaan: kosong) */
  reviews?: Record<string, PublicReviews>;
}

const snapshotOf = (
  booths: PublicSnapshot["booths"],
  over: Partial<PublicSnapshot> = {},
): PublicSnapshot => ({
  eventId: "ev1",
  ratingsHidden: false,
  booths,
  stats: { boothCount: booths.length, reviewCount: 0, average: null },
  ...over,
});

const detailOf = (
  booth: PublicSnapshot["booths"][number],
  over: Partial<PublicBoothDetail> = {},
): PublicBoothDetail => ({
  ...booth,
  about: null,
  teamName: null,
  photos: [],
  ratingsHidden: false,
  distribution: [0, 0, 0, 0, 0],
  hasWhatsapp: false,
  topCategories: [],
  ...over,
});

function mockApi(api: Api) {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  const fn = vi.fn(async (input: string | URL | Request) => {
    const path = String(input);
    if (path === "/api/event") return api.event === "fail" ? json({}, 500) : json(api.event);
    if (path === "/api/snapshot")
      return api.snapshot === "fail" ? json({}, 500) : json(api.snapshot);
    const products = path.match(/^\/api\/booths\/([^/]+)\/products$/);
    if (products) {
      const p = api.products[products[1] ?? ""];
      return p ? json(p) : json({ products: [], hasWhatsapp: false });
    }
    if (path === "/api/visitor/me") {
      return json({
        visitor: null,
        authMode: "google_or_email",
        googleClientId: null,
        turnstileSiteKey: null,
        reviewed: [],
      });
    }
    const reviews = path.match(/^\/api\/booths\/([^/?]+)\/reviews/);
    if (reviews) {
      return json(api.reviews?.[reviews[1] ?? ""] ?? { reviews: [], next: null });
    }
    const booth = path.match(/^\/api\/booths\/([^/]+)$/);
    if (booth) {
      const b = api.booth[booth[1] ?? ""];
      return b ? json({ booth: b }) : json({ code: "not_found" }, 404);
    }
    return json({ code: "not_found" }, 404);
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const eventResponse = (event: PublicEvent | null): PublicEventResponse => ({
  event,
  serverNow: Date.now(),
});

function mount(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <MediaUrlProvider resolve={sampleResolver}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/b/:boothId" element={<BoothPage />} />
          </Route>
        </Routes>
      </MediaUrlProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  window.scrollTo = () => {};
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Halaman event (/)", () => {
  it("belum ada event: layar 'Segera hadir' tanpa data lain", async () => {
    mockApi({ event: eventResponse(null), snapshot: "fail", booth: {}, products: {} });
    mount("/");
    expect(await screen.findByRole("heading", { name: copy.event.comingSoon.title })).toBeTruthy();
    expect(screen.queryByRole("contentinfo")).toBeNull();
  });

  it("galat memuat event: ada pesan galat dengan tombol coba lagi, bukan layar kosong", async () => {
    mockApi({ event: "fail", snapshot: "fail", booth: {}, products: {} });
    mount("/");
    expect(
      await screen.findByRole("button", { name: /coba lagi/i }, { timeout: 4000 }),
    ).toBeTruthy();
  });

  it("event berjalan dengan booth lengkap dan hanya-nama: keduanya tampil, tanpa gambar rusak", async () => {
    mockApi({
      event: eventResponse(makeEvent({ schedule: scheduleAt("live") })),
      snapshot: snapshotOf([BOOTHS.lengkap, BOOTHS.hanyaNama]),
      booth: {},
      products: {},
    });
    const { container } = mount("/");
    expect(await screen.findByText("2 booth ikut serta")).toBeTruthy();
    expect(container.querySelector("h1")?.textContent).toContain("Terfavorit");
    expect(screen.getAllByText(BOOTHS.lengkap.name).length).toBeGreaterThan(0);
    expect(screen.getAllByText(BOOTHS.hanyaNama.name).length).toBeGreaterThan(0);
    // satu keputusan mode untuk seluruh daftar; booth hanya-nama tetap berupa kartu utuh dengan tautan
    const links = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(links).toContain(`/b/${BOOTHS.hanyaNama.id}`);
    expect(links).toContain(`/b/${BOOTHS.lengkap.id}`);
    // tanpa foto = tanpa <img> yang src-nya kosong
    for (const img of container.querySelectorAll("img"))
      expect(img.getAttribute("src")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Yuk, cobain jelajah booth/ })).toBeTruthy();
  });

  it("semua booth hanya-nama: daftar tetap rapi (mode teks) dan tidak ada peringkat di kartu", async () => {
    mockApi({
      event: eventResponse(makeEvent({ schedule: scheduleAt("live") })),
      snapshot: snapshotOf([BOOTHS.hanyaNama, BOOTHS.namaDanNomor]),
      booth: {},
      products: {},
    });
    const { container } = mount("/");
    await screen.findByText("2 booth ikut serta");
    expect(container.querySelector("[data-visual-mode]")?.getAttribute("data-visual-mode")).toBe(
      "text",
    );
    expect(container.textContent).not.toMatch(/#\d|peringkat/i);
  });

  it("tanpa booth: keadaan kosong yang ramah, tanpa bagian sorotan, tanpa '0 booth'", async () => {
    mockApi({
      event: eventResponse(makeEvent({ schedule: scheduleAt("live") })),
      snapshot: snapshotOf([]),
      booth: {},
      products: {},
    });
    const { container } = mount("/");
    expect(await screen.findByText(copy.event.empty.title)).toBeTruthy();
    expect(container.textContent).not.toContain("0 booth ikut serta");
    expect(screen.queryByRole("heading", { name: /Sorotan/ })).toBeNull();
  });

  it("rating disembunyikan admin: angka rating tidak muncul di halaman", async () => {
    mockApi({
      event: eventResponse(makeEvent({ schedule: scheduleAt("live") })),
      snapshot: snapshotOf(
        [{ ...BOOTHS.lengkap, ratingAverage: null, ratingCount: 0 }, BOOTHS.hanyaNama],
        { ratingsHidden: true },
      ),
      booth: {},
      products: {},
    });
    const { container } = mount("/");
    await screen.findByText("2 booth ikut serta");
    expect(container.textContent).not.toContain("4.7");
    expect(container.textContent).not.toContain("4,7");
    expect(container.textContent).toContain(copy.visitor.ratingsHidden);
  });

  it("belum mulai: teks dan CTA menyesuaikan; event selesai: hanya-baca dan 'EVENT UDAH SELESAI'", async () => {
    mockApi({
      event: eventResponse(makeEvent({ schedule: scheduleAt("upcoming") })),
      snapshot: snapshotOf([BOOTHS.lengkap]),
      booth: {},
      products: {},
    });
    const first = mount("/");
    expect(await screen.findByText("VOTING SEGERA DIBUKA")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Intip booth-nya/ })).toBeTruthy();
    first.unmount();

    mockApi({
      event: eventResponse(makeEvent({ schedule: scheduleAt("ended") })),
      snapshot: snapshotOf([BOOTHS.lengkap]),
      booth: {},
      products: {},
    });
    mount("/");
    expect(await screen.findByText("EVENT UDAH SELESAI")).toBeTruthy();
    expect(screen.getByText(copy.readOnly.banner)).toBeTruthy();
  });

  it("judul tab = nama resmi acara", async () => {
    mockApi({
      event: eventResponse(makeEvent({ schedule: scheduleAt("live") })),
      snapshot: snapshotOf([BOOTHS.lengkap]),
      booth: {},
      products: {},
    });
    mount("/");
    await screen.findByText("1 booth ikut serta");
    expect(document.title).toBe("Penilaian Booth Terfavorit LPPM Expo Tahun 2026");
  });
});

describe("Halaman booth (/b/:id)", () => {
  const live = () => eventResponse(makeEvent({ schedule: scheduleAt("live") }));

  it("booth lengkap: nama, tagline, andalan, etalase, kenalan, ulasan, bagikan, form penilaian", async () => {
    const booth = detailOf(BOOTHS.lengkap, {
      about: "Kami meracik kopi rempah sejak 2019.",
      teamName: "Tim Rempah",
      photos: [
        { keyFull: "ok:1", keyThumb: "ok:1" },
        { keyFull: "ok:2", keyThumb: "ok:2" },
      ],
      distribution: [0, 1, 2, 8, 13],
      hasWhatsapp: true,
    });
    mockApi({
      event: live(),
      snapshot: snapshotOf([BOOTHS.lengkap]),
      booth: { [booth.id]: booth },
      products: {
        [booth.id]: {
          hasWhatsapp: true,
          products: [
            { ...PRODUCTS.lengkap, id: "p1", name: "Kopi Rempah Susu" },
            { ...PRODUCTS.tanpaFoto, id: "p9", name: "Teh Tarik" },
          ],
        },
      },
    });
    const { container } = mount(`/b/${booth.id}`);
    expect(await screen.findByRole("heading", { level: 1, name: booth.name })).toBeTruthy();
    expect(screen.getByText("Hangat di lidah")).toBeTruthy();
    expect(screen.getByText("Tim Rempah")).toBeTruthy();
    expect(screen.getByText(copy.visitor.boothNo("A12"))).toBeTruthy();
    expect(await screen.findByText(/Teh Tarik/)).toBeTruthy();
    expect(container.querySelector("#andalan")).not.toBeNull();
    expect(screen.getByText(copy.event.booth.about)).toBeTruthy();
    expect(screen.getByText("Kami meracik kopi rempah sejak 2019.")).toBeTruthy();
    expect(container.querySelector("section[aria-roledescription='carousel']")).not.toBeNull();
    expect(container.querySelector("[data-hero-layout]")?.getAttribute("data-hero-layout")).toBe(
      "photo",
    );
    expect(screen.getAllByRole("button", { name: copy.event.share.button }).length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getAllByRole("link", { name: /Pesan .* lewat WhatsApp|Pesan dulu lewat WA/ }).length,
    ).toBeGreaterThan(0);
    // nomor WA booth tidak pernah ada di halaman (tautan bagikan `wa.me/?text=` memang tanpa nomor)
    expect(container.innerHTML).not.toMatch(/wa\.me\/\d|\b62\d{8,}\b/);
    expect(container.querySelector("a[href^='/go/wa/']")).not.toBeNull();
    expect(container.querySelector("#nilai")).not.toBeNull();
  });

  it("booth hanya-nama: halaman utuh tanpa foto, andalan, etalase, kenalan, atau tombol WA", async () => {
    const booth = detailOf(BOOTHS.hanyaNama);
    mockApi({
      event: live(),
      snapshot: snapshotOf([BOOTHS.hanyaNama]),
      booth: { [booth.id]: booth },
      products: { [booth.id]: { products: [], hasWhatsapp: false } },
    });
    const { container } = mount(`/b/${booth.id}`);
    expect(await screen.findByRole("heading", { level: 1, name: booth.name })).toBeTruthy();
    await waitFor(() => expect(container.querySelector("[data-hero-layout]")).not.toBeNull());
    expect(container.querySelector("[data-hero-layout]")?.getAttribute("data-hero-layout")).toBe(
      "text",
    );
    expect(container.querySelector("#andalan")).toBeNull();
    expect(screen.queryByText(copy.event.booth.showcase)).toBeNull();
    expect(screen.queryByText(copy.event.booth.about)).toBeNull();
    expect(screen.queryByRole("link", { name: /WhatsApp|WA/ })).toBeNull();
    expect(container.querySelector("section[aria-roledescription='carousel']")).toBeNull();
    for (const img of container.querySelectorAll("img"))
      expect(img.getAttribute("src")).toBeTruthy();
    // kartu ulasan tetap ada dengan ajakan, bukan "0"
    expect(screen.getByText(copy.event.booth.noReviews)).toBeTruthy();
    // satu-satunya bagian wajib: nama + form penilaian
    expect(container.querySelector("#nilai")).not.toBeNull();
    expect(document.title).toBe(`${booth.name} · Penilaian Booth Terfavorit LPPM Expo Tahun 2026`);
  });

  it("booth tidak ada: pesan 'nggak ketemu' dengan jalan kembali ke daftar", async () => {
    mockApi({ event: live(), snapshot: snapshotOf([]), booth: {}, products: {} });
    mount("/b/tidak-ada");
    expect(
      await screen.findByText(copy.event.booth.notFoundTitle, {}, { timeout: 4000 }),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: copy.event.booth.back })).toBeTruthy();
  });

  it("foto yang gagal dimuat tidak meninggalkan gambar rusak; hero beralih ke teks", async () => {
    const booth = detailOf(BOOTHS.fotoGagal404, {
      photos: [{ keyFull: "broken:1", keyThumb: "broken:1" }],
    });
    mockApi({
      event: live(),
      snapshot: snapshotOf([BOOTHS.fotoGagal404]),
      booth: { [booth.id]: booth },
      products: { [booth.id]: { products: [], hasWhatsapp: false } },
    });
    const { container } = mount(`/b/${booth.id}`);
    await screen.findByRole("heading", { level: 1, name: booth.name });
    const { fireEvent } = await import("@testing-library/react");
    for (const img of container.querySelectorAll("img")) fireEvent.error(img);
    await waitFor(() =>
      expect(container.querySelector("[data-hero-layout]")?.getAttribute("data-hero-layout")).toBe(
        "text",
      ),
    );
    expect(container.querySelector("section[aria-roledescription='carousel']")).toBeNull();
  });

  it("rating disembunyikan: tidak ada angka, jumlah, atau sebaran", async () => {
    const booth = detailOf(
      { ...BOOTHS.lengkap, ratingAverage: null, ratingCount: 0 },
      { ratingsHidden: true, distribution: null },
    );
    mockApi({
      event: live(),
      snapshot: snapshotOf([BOOTHS.lengkap], { ratingsHidden: true }),
      booth: { [booth.id]: booth },
      products: { [booth.id]: { products: [], hasWhatsapp: false } },
    });
    const { container } = mount(`/b/${booth.id}`);
    await screen.findByRole("heading", { level: 1, name: booth.name });
    expect(container.textContent).not.toContain("24 ulasan");
    expect(screen.getAllByText(copy.visitor.ratingsHidden).length).toBeGreaterThan(0);
    expect(screen.queryByText(copy.event.booth.distribution)).toBeNull();
  });

  it("event selesai: tanpa ajakan kasih bintang dan tanpa tombol simpan/WA; ada banner hanya-baca", async () => {
    const booth = detailOf(BOOTHS.lengkap, { hasWhatsapp: false });
    mockApi({
      event: eventResponse(makeEvent({ schedule: scheduleAt("ended") })),
      snapshot: snapshotOf([BOOTHS.lengkap]),
      booth: { [booth.id]: booth },
      products: {
        [booth.id]: { hasWhatsapp: false, products: [{ ...PRODUCTS.tanpaFoto, id: "p9" }] },
      },
    });
    const { container } = mount(`/b/${booth.id}`);
    await screen.findByRole("heading", { level: 1, name: booth.name });
    await screen.findByText(/Teh Tarik/);
    expect(screen.getByText(copy.readOnly.banner)).toBeTruthy();
    expect(screen.queryByText(copy.event.booth.rateCta)).toBeNull();
    expect(screen.queryByRole("button", { name: new RegExp(copy.event.wishlist.save) })).toBeNull();
    expect(within(container).queryByText(copy.event.rate.ended)).not.toBeNull();
  });

  it("tautan produk (?p=) menyorot produk di etalase", async () => {
    const booth = detailOf(BOOTHS.hanyaNama);
    mockApi({
      event: live(),
      snapshot: snapshotOf([BOOTHS.hanyaNama]),
      booth: { [booth.id]: booth },
      products: {
        [booth.id]: {
          hasWhatsapp: false,
          products: [
            { ...PRODUCTS.tanpaFoto, id: "pa", name: "Aaa" },
            { ...PRODUCTS.tanpaFoto, id: "pb", name: "Bbb" },
          ],
        },
      },
    });
    const { container } = mount(`/b/${booth.id}?p=pb`);
    await screen.findByText("Bbb");
    expect(container.querySelector("#produk-pb")?.className).toContain("ring-4");
    expect(container.querySelector("#produk-pa")?.className).not.toContain("ring-4");
  });
});

// Matriks "data kosong" (A16, B26): setiap fixture booth di halaman utuh, sebelum dan sesudah semua gambar 404.
describe("Matriks data kosong: halaman utuh × fixture booth", () => {
  const live = () => eventResponse(makeEvent({ schedule: scheduleAt("live") }));

  for (const name of BOOTH_NAMES) {
    const b = BOOTHS[name];

    it(`halaman booth · ${name}`, async () => {
      const featured = b.featuredProduct;
      const booth = detailOf(b, {
        photos: b.coverKey
          ? [{ keyFull: b.coverKey, keyThumb: b.coverThumbKey ?? b.coverKey }]
          : [],
      });
      mockApi({
        event: live(),
        snapshot: snapshotOf([b]),
        booth: { [b.id]: booth },
        products: {
          [b.id]: {
            hasWhatsapp: false,
            products: featured
              ? [
                  {
                    ...PRODUCTS.tanpaFoto,
                    id: featured.id,
                    name: featured.name,
                    priceIdr: featured.priceIdr,
                    thumbKey: featured.thumbKey,
                    fullKey: featured.thumbKey,
                  },
                  PRODUCTS.fotoGagal404,
                ]
              : [],
          },
        },
      });
      const { container } = mount(`/b/${b.id}`);
      await screen.findByRole("heading", { level: 1 });
      if (featured) await screen.findByText(featured.name);
      assertNoBrokenUI(container, `booth/${name}`);
      await act(async () => void failAllImages(container));
      assertNoBrokenUI(container, `booth/${name}/setelah-404`);
      expect(container.querySelector("h1")?.textContent?.trim()).toBe(b.name.trim());
    });

    it(`halaman utama · ${name}`, async () => {
      mockApi({ event: live(), snapshot: snapshotOf([b]), booth: {}, products: {} });
      const { container } = mount("/");
      await screen.findByText("1 booth ikut serta");
      assertNoBrokenUI(container, `home/${name}`);
      await act(async () => void failAllImages(container));
      assertNoBrokenUI(container, `home/${name}/setelah-404`);
    });
  }

  it("halaman utama dengan seluruh fixture sekaligus", async () => {
    mockApi({
      event: live(),
      snapshot: snapshotOf(BOOTH_NAMES.map((n) => BOOTHS[n])),
      booth: {},
      products: {},
    });
    const { container } = mount("/");
    await screen.findByText(`${BOOTH_NAMES.length} booth ikut serta`);
    assertNoBrokenUI(container, "home/semua");
    await act(async () => void failAllImages(container));
    assertNoBrokenUI(container, "home/semua/setelah-404");
  });
});

describe("Halaman booth: penilaian dan ulasan (Tahap 6)", () => {
  const live = () =>
    eventResponse(
      makeEvent({ schedule: scheduleAt("live"), reviewCategories: [{ id: "c1", label: "Seru" }] }),
    );
  const withReviews = (over: Partial<PublicBoothDetail> = {}, reviews?: PublicReviews) => {
    const booth = detailOf(BOOTHS.lengkap, {
      ratingCount: 2,
      ratingAverage: 4.5,
      distribution: [0, 0, 0, 1, 1],
      ...over,
    });
    mockApi({
      event: live(),
      snapshot: snapshotOf([BOOTHS.lengkap]),
      booth: { [booth.id]: booth },
      products: { [booth.id]: { products: [], hasWhatsapp: false } },
      reviews: reviews ? { [booth.id]: reviews } : undefined,
    });
    return booth;
  };

  it("saat voting: kotak penilaian menampilkan ajakan masuk (bukan lagi pengganti 'disiapkan')", async () => {
    const booth = withReviews();
    mount(`/b/${booth.id}`);
    expect(await screen.findByText(copy.event.login.title)).toBeTruthy();
    expect(screen.queryByText(copy.event.rate.liveSoon)).toBeNull();
  });

  it("ulasan pengunjung lain dan 'Sering disebut' tampil di bawah sebaran bintang", async () => {
    const booth = withReviews(
      { topCategories: [{ id: "c1", label: "Seru", count: 2 }] },
      {
        reviews: [
          {
            id: "r1",
            stars: 5,
            text: "Kopinya enak sekali",
            displayName: "Budi",
            categories: [{ id: "c1", label: "Seru" }],
            createdAt: 2,
          },
          {
            id: "r2",
            stars: 4,
            text: "Ramah dan cepat",
            displayName: "Pengunjung",
            categories: [],
            createdAt: 1,
          },
        ],
        next: null,
      },
    );
    const { container } = mount(`/b/${booth.id}`);
    expect(await screen.findByText("Kopinya enak sekali")).toBeTruthy();
    expect(screen.getByText("Ramah dan cepat")).toBeTruthy();
    expect(container.textContent).toContain("Sering disebut: Seru (2)");
    assertNoBrokenUI(container, "booth/ulasan");
  });

  it("tanpa ulasan dan tanpa kategori: tidak ada bagian kosong; ajakan menjadi yang pertama", async () => {
    const booth = withReviews({
      ratingCount: 0,
      ratingAverage: null,
      distribution: [0, 0, 0, 0, 0],
    });
    const { container } = mount(`/b/${booth.id}`);
    await screen.findByText(copy.event.booth.noReviews);
    expect(container.textContent).not.toContain("Sering disebut");
    expect(screen.queryByRole("article")).toBeNull();
  });

  it("event selesai: kotak penilaian 'ditutup' dan tidak ada tombol lapor", async () => {
    const booth = detailOf(BOOTHS.lengkap);
    mockApi({
      event: eventResponse(makeEvent({ schedule: scheduleAt("ended") })),
      snapshot: snapshotOf([BOOTHS.lengkap]),
      booth: { [booth.id]: booth },
      products: { [booth.id]: { products: [], hasWhatsapp: false } },
      reviews: {
        [booth.id]: {
          reviews: [
            {
              id: "r1",
              stars: 5,
              text: "Mantap",
              displayName: "Budi",
              categories: [],
              createdAt: 1,
            },
          ],
          next: null,
        },
      },
    });
    mount(`/b/${booth.id}`);
    await screen.findByText("Mantap");
    expect(screen.getByText(copy.event.rate.ended)).toBeTruthy();
    expect(screen.queryByRole("button", { name: copy.event.reviews.report })).toBeNull();
    expect(screen.queryByText(copy.event.login.title)).toBeNull();
  });
});
