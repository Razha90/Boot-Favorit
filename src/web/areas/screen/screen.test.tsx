// @vitest-environment jsdom
import type {
  LatestReview,
  PublicBooth,
  PublicEventResponse,
  PublicSnapshot,
} from "@shared/api-types";
import { CONFIG } from "@shared/config";
import type { EventSchedule } from "@shared/event-state";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BOOTHS, sampleResolver } from "../../dev/fixtures";
import { copy } from "../../lib/copy";
import { MediaUrlProvider } from "../../lib/media-url";
import { assertNoBrokenUI } from "../../test/assertions";
import { makeEvent } from "../../test/render";
import { BoothsPanel, FeedPanel, RankingPanel, SpotlightPanel } from "./components/ScreenPanels";
import { Component as Layout } from "./layout";
import { Component as ScreenPage } from "./pages/screen";

const START = 1_000_000_000_000;
const SCHEDULE: EventSchedule = {
  registrationOpenAt: START - 3 * 86_400_000,
  registrationCloseAt: START - 2 * 86_400_000,
  eventStartAt: START,
  eventEndAt: START + 365 * 86_400_000,
  resultsPublishedAt: null,
  allowLateRegistration: false,
};
const BOOTH_LIST: PublicBooth[] = [
  { ...BOOTHS.lengkap, id: "a", name: "Kopi Rempah", ratingAverage: 4.7, ratingCount: 24 },
  { ...BOOTHS.hanyaNama, id: "b", name: "Es Teh Pak Budi" },
];
const FEED: LatestReview[] = [
  {
    id: "f1",
    boothId: "a",
    boothName: "Kopi Rempah",
    stars: 5,
    text: "Kopinya enak sekali",
    displayName: "Ani",
    createdAt: 2,
  },
];

let clock = START + 1000;
beforeEach(() => {
  clock = START + 1000;
  vi.spyOn(Date, "now").mockImplementation(() => clock);
  vi.stubGlobal("WebSocket", undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function serve(
  snapshot: Partial<PublicSnapshot> = {},
  event: PublicEventResponse["event"] = makeEvent({ schedule: SCHEDULE }),
) {
  const snap: PublicSnapshot = {
    eventId: "ev1",
    ratingsHidden: false,
    booths: BOOTH_LIST,
    stats: { boothCount: 2, reviewCount: 24, average: 4.7 },
    ranking: [{ boothId: "a", rank: 1, score: 4.5, average: 4.7, reviewCount: 24 }],
    feed: FEED,
    reveal: null,
    resultsPublished: false,
    resultsVersion: 0,
    ...snapshot,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s });
      if (input === "/api/event")
        return json({ event, serverNow: clock } satisfies PublicEventResponse);
      if (input === "/api/snapshot") return json(snap);
      if (input === "/api/results")
        return json({ published: false, version: 0, publishedAt: null, results: null });
      return json({ code: "not_found" }, 404);
    }),
  );
}

const mount = () =>
  render(
    <MemoryRouter initialEntries={["/screen"]}>
      <MediaUrlProvider resolve={sampleResolver}>
        <Routes>
          <Route path="/screen" element={<Layout />}>
            <Route index element={<ScreenPage />} />
          </Route>
        </Routes>
      </MediaUrlProvider>
    </MemoryRouter>,
  );

describe("Layar Besar: halaman", () => {
  it("panel pertama Sorotan; tanpa tombol dan tautan (proyektor); judul = nama resmi acara", async () => {
    serve();
    const { container } = mount();
    expect(await screen.findByText(copy.screen.spotlight)).toBeTruthy();
    expect(container.querySelector("h1")?.textContent).toBe(makeEvent().name);
    expect(container.querySelector("a, button")).toBeNull();
  });

  it("berganti panel otomatis menurut waktu SERVER: Sorotan → Semua booth → Ulasan terbaru → Peringkat (terakhir)", async () => {
    serve();
    mount();
    await screen.findByText(copy.screen.spotlight);
    const order: string[] = [copy.screen.spotlight];
    for (const title of [copy.screen.booths, copy.screen.feed, copy.screen.ranking]) {
      clock += CONFIG.live.screenPanelMs;
      await waitFor(() => expect(screen.getAllByText(title).length).toBeGreaterThan(0), {
        timeout: 3000,
      });
      order.push(title);
    }
    expect(order).toEqual([
      copy.screen.spotlight,
      copy.screen.booths,
      copy.screen.feed,
      copy.screen.ranking,
    ]);
    clock += CONFIG.live.screenPanelMs;
    await waitFor(
      () => expect(screen.getAllByText(copy.screen.spotlight).length).toBeGreaterThan(0),
      { timeout: 3000 },
    ); // berputar
  });

  it("peringkat tersembunyi (null): panel peringkat tidak pernah muncul dan tak ada skor", async () => {
    serve({ ranking: null });
    const { container } = mount();
    await screen.findByText(copy.screen.spotlight);
    for (let i = 0; i < 6; i++) {
      clock += CONFIG.live.screenPanelMs;
      await new Promise((r) => setTimeout(r, 1100));
      expect(screen.queryByText(copy.screen.ranking)).toBeNull();
      expect(container.textContent).not.toMatch(/skor \d/);
    }
  }, 15000);

  it("tanpa booth: layar menunggu (bukan layar kosong)", async () => {
    serve({
      booths: [],
      feed: [],
      ranking: null,
      stats: { boothCount: 0, reviewCount: 0, average: null },
    });
    mount();
    expect(await screen.findByText(copy.screen.waiting)).toBeTruthy();
  });

  it("belum ada event aktif: layar menunggu", async () => {
    serve({}, null);
    mount();
    expect(await screen.findByText(copy.screen.waiting)).toBeTruthy();
  });
});

describe("panel Layar Besar × data kosong", () => {
  const wrap = (ui: React.ReactElement) =>
    render(<MediaUrlProvider resolve={sampleResolver}>{ui}</MediaUrlProvider>);

  it("Sorotan: lengkap, hanya nama, tanpa foto/nomor/tagline, rating disembunyikan", () => {
    for (const [booth, hidden] of [
      [BOOTH_LIST[0] as PublicBooth, false],
      [BOOTH_LIST[1] as PublicBooth, false],
      [BOOTH_LIST[0] as PublicBooth, true],
      [{ ...BOOTHS.stringKosong, id: "s" } as PublicBooth, false],
    ] as const) {
      const { container, unmount } = wrap(<SpotlightPanel booth={booth} ratingsHidden={hidden} />);
      assertNoBrokenUI(container, "layar/sorotan");
      expect(container.querySelector("h2")?.textContent?.trim()).toBe(booth.name.trim());
      if (hidden) expect(container.textContent).not.toContain("4,7");
      unmount();
    }
  });

  it("Semua booth: banyak booth dipotong dengan '+N'; Ulasan: tanpa bintang bila rating disembunyikan", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      ...BOOTHS.hanyaNama,
      id: `m${i}`,
      name: `Booth ${i}`,
    }));
    const a = wrap(<BoothsPanel booths={many} />);
    expect(a.container.querySelectorAll("li")).toHaveLength(24);
    expect(a.container.textContent).toContain("+6");
    a.unmount();
    const b = wrap(<FeedPanel feed={[{ ...(FEED[0] as LatestReview), stars: null }]} />);
    expect(b.container.querySelector("[role='img']")).toBeNull();
    assertNoBrokenUI(b.container, "layar/ulasan");
  });

  it("Peringkat: hanya booth yang dikenal; baris pertama berlatar", () => {
    const booths = new Map(BOOTH_LIST.map((b) => [b.id, b]));
    const { container } = wrap(
      <RankingPanel
        ranking={[
          { boothId: "a", rank: 1, score: 4.5, average: 4.7, reviewCount: 24 },
          { boothId: "hilang", rank: 2, score: 4, average: 4, reviewCount: 9 },
        ]}
        booths={booths}
      />,
    );
    expect(container.querySelectorAll("li")).toHaveLength(1);
    expect(container.textContent).toContain("skor 4,50");
  });
});
