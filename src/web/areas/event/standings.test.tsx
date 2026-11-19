// @vitest-environment jsdom
// Bagian 03 (peringkat, ulasan terbaru, hasil akhir) dan animasi pemenang di halaman event, dengan `fetch` palsu.
import type {
  LatestReview,
  PublicBooth,
  PublicEventResponse,
  PublicResults,
  PublicSnapshot,
} from "@shared/api-types";
import type { EventSchedule } from "@shared/event-state";
import type { ResultEntry } from "@shared/results";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BOOTHS, sampleResolver } from "../../dev/fixtures";
import { copy } from "../../lib/copy";
import { MediaUrlProvider } from "../../lib/media-url";
import { makeEvent } from "../../test/render";
import { Component as Layout } from "./layout";
import { Component as HomePage } from "./pages/home";
import { Component as ResultsPage } from "./pages/results";

const DAY = 86_400_000;
const sched = (phase: "live" | "ended", published: number | null = null): EventSchedule => {
  const t = Date.now();
  const o = phase === "live" ? [-3, -2, -1, 30] : [-4, -3, -2, -1];
  return {
    registrationOpenAt: t + (o[0] ?? 0) * DAY,
    registrationCloseAt: t + (o[1] ?? 0) * DAY,
    eventStartAt: t + (o[2] ?? 0) * DAY,
    eventEndAt: t + (o[3] ?? 0) * DAY,
    resultsPublishedAt: published,
    allowLateRegistration: false,
  };
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
  {
    id: "f2",
    boothId: "b",
    boothName: "Es Teh Pak Budi",
    stars: 4,
    text: "Segar dan murah",
    displayName: "Pengunjung",
    createdAt: 1,
  },
];
const RESULTS: ResultEntry[] = [
  {
    boothId: "a",
    rank: 1,
    name: "Kopi Rempah",
    boothNo: "A12",
    coverThumbKey: null,
    average: 4.7,
    reviewCount: 24,
    score: 4.5,
    topCategories: [{ label: "Seru", count: 9 }],
  },
  {
    boothId: "b",
    rank: null,
    name: "Es Teh Pak Budi",
    boothNo: null,
    coverThumbKey: null,
    average: null,
    reviewCount: 0,
    score: null,
    topCategories: [],
  },
];

interface Server {
  schedule: EventSchedule;
  snapshot: Partial<PublicSnapshot>;
  results?: PublicResults;
}

function serve(s: Server) {
  const snapshot: PublicSnapshot = {
    eventId: "ev1",
    ratingsHidden: false,
    booths: BOOTH_LIST,
    stats: { boothCount: 2, reviewCount: 24, average: 4.43 },
    ranking: [{ boothId: "a", rank: 1, score: 4.5, average: 4.7, reviewCount: 24 }],
    feed: FEED,
    reveal: null,
    resultsPublished: false,
    resultsVersion: 0,
    ...s.snapshot,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
      const path = String(input);
      if (path === "/api/event") {
        const body: PublicEventResponse = {
          event: makeEvent({ schedule: s.schedule }),
          serverNow: Date.now(),
        };
        return json(body);
      }
      if (path === "/api/snapshot") return json(snapshot);
      if (path === "/api/results")
        return json(
          s.results ?? { published: false, version: 0, publishedAt: null, results: null },
        );
      if (path === "/api/visitor/me")
        return json({
          visitor: null,
          authMode: "google_or_email",
          googleClientId: null,
          turnstileSiteKey: null,
          reviewed: [],
        });
      return json({ code: "not_found" }, 404);
    }),
  );
}

function mount(route = "/") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <MediaUrlProvider resolve={sampleResolver}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/results" element={<ResultsPage />} />
          </Route>
        </Routes>
      </MediaUrlProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal("WebSocket", undefined); // polling saja; WebSocket diuji di features/live
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const PUBLISHED = (): Server => ({
  schedule: sched("ended", Date.now() - 1000),
  snapshot: { resultsPublished: true, resultsVersion: 1 },
  results: { published: true, version: 1, publishedAt: 1, results: RESULTS },
});

describe("Bagian 03: peringkat dan ulasan terbaru (selama event)", () => {
  it("selalu paling bawah: sesudah 'Semua booth'; kartu booth TIDAK memuat peringkat", async () => {
    serve({ schedule: sched("live"), snapshot: {} });
    const { container } = mount();
    await screen.findByText(copy.standings.ranking);
    const sections = [...container.querySelectorAll("main section")].map((s) =>
      s.getAttribute("aria-labelledby"),
    );
    expect(sections).toEqual(["sorotan", "semua", "peringkat"]);
    const grid = container.querySelector("section[aria-labelledby='semua']");
    expect(grid?.textContent).not.toMatch(/peringkat|skor|#\d/i);
    expect(container.querySelector("section[aria-labelledby='peringkat']")?.textContent).toContain(
      "skor 4,50",
    );
  });

  it("ulasan terbaru tampil dengan nama booth, bintang, dan aria-live", async () => {
    serve({ schedule: sched("live"), snapshot: {} });
    const { container } = mount();
    await screen.findByText("Kopinya enak sekali");
    expect(container.querySelector("ul[aria-live='polite']")).not.toBeNull();
    expect(screen.getByText("Segar dan murah")).toBeTruthy();
  });

  it("peringkat disembunyikan (server mengirim null): hanya 'Ulasan terbaru', tanpa skor sama sekali", async () => {
    serve({ schedule: sched("live"), snapshot: { ranking: null } });
    const { container } = mount();
    await screen.findByText(copy.standings.latest);
    expect(screen.queryByText(copy.standings.ranking)).toBeNull();
    expect(container.textContent).not.toMatch(/skor \d/);
  });

  it("rating disembunyikan: tanpa peringkat, tanpa bintang pada ulasan, tanpa baris statistik di masthead", async () => {
    serve({
      schedule: sched("live"),
      snapshot: {
        ratingsHidden: true,
        ranking: null,
        stats: { boothCount: 2, reviewCount: 0, average: null },
        feed: FEED.map((f) => ({ ...f, stars: null })),
      },
    });
    const { container } = mount();
    await screen.findByText("Kopinya enak sekali");
    expect(container.querySelector("ul[aria-live] [role='img']")).toBeNull();
    expect(container.textContent).not.toMatch(/rata-rata \d/);
  });

  it("tanpa peringkat dan tanpa ulasan: bagian 03 tidak dirender (tanpa bagian kosong)", async () => {
    serve({ schedule: sched("live"), snapshot: { ranking: null, feed: [] } });
    const { container } = mount();
    await screen.findByText("Kopi Rempah", { selector: "h3" });
    expect(container.querySelector("section[aria-labelledby='peringkat']")).toBeNull();
  });

  it("masthead: 'N ulasan · M booth · rata-rata X'", async () => {
    serve({ schedule: sched("live"), snapshot: {} });
    mount();
    expect(await screen.findByText("24 ulasan · 2 booth · rata-rata 4,43")).toBeTruthy();
  });
});

describe("setelah event selesai", () => {
  it("belum diumumkan: 'Hasil segera diumumkan', tanpa animasi dan tanpa tombol putar ulang", async () => {
    serve({ schedule: sched("ended"), snapshot: {} });
    mount();
    await screen.findByText(copy.standings.waiting);
    expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
    expect(screen.queryByRole("button", { name: copy.results.replay })).toBeNull();
  });

  it("diumumkan: animasi diputar OTOMATIS setiap halaman dibuka; Lewati → hanya-baca dengan hasil akhir di bawah", async () => {
    serve(PUBLISHED());
    const { container } = mount();
    const dialog = await screen.findByRole("dialog", { hidden: true });
    expect(dialog.getAttribute("aria-label")).toBe(copy.reveal.label);
    fireEvent.click(screen.getByRole("button", { name: copy.reveal.skip }));
    await waitFor(() => expect(screen.queryByRole("dialog", { hidden: true })).toBeNull());
    expect(screen.getByRole("button", { name: copy.results.replay })).toBeTruthy();
    expect(container.querySelector("section[aria-labelledby='peringkat']")?.textContent).toContain(
      "Juara 1",
    );
    expect(screen.getByText(copy.event.hero.stats(24, 2, 4.43))).toBeTruthy();
  });

  it("muat ulang memutar lagi (tidak ada 'sudah dilihat'); 'Putar ulang animasi pemenang' memutar manual", async () => {
    serve(PUBLISHED());
    const first = mount();
    fireEvent.click(await screen.findByRole("button", { name: copy.reveal.skip }));
    await waitFor(() => expect(screen.queryByRole("dialog", { hidden: true })).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: copy.results.replay }));
    expect(await screen.findByRole("dialog", { hidden: true })).toBeTruthy();
    first.unmount();
    mount();
    expect(await screen.findByRole("dialog", { hidden: true })).toBeTruthy();
  });

  it("'Jangan putar otomatis lagi di perangkat ini': tersimpan per versi hasil; versi baru menyalakannya lagi", async () => {
    serve(PUBLISHED());
    const a = mount();
    fireEvent.click(await screen.findByRole("checkbox", { name: copy.reveal.dontReplay }));
    fireEvent.click(screen.getByRole("button", { name: copy.reveal.skip }));
    await waitFor(() => expect(screen.queryByRole("dialog", { hidden: true })).toBeNull());
    expect(window.localStorage.getItem("winnerAutoplayOff:ev1:1")).toBe("1");
    expect(screen.getByRole("button", { name: copy.results.autoplayOff })).toBeTruthy();
    a.unmount();

    mount(); // muat ulang: tidak diputar otomatis lagi
    await screen.findByRole("button", { name: copy.results.replay });
    expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
    cleanup();

    const s = PUBLISHED();
    s.snapshot = { resultsPublished: true, resultsVersion: 2 }; // admin memperbarui hasil
    s.results = { published: true, version: 2, publishedAt: 2, results: RESULTS };
    serve(s);
    mount();
    expect(await screen.findByRole("dialog", { hidden: true })).toBeTruthy();
  });

  it("saklar banner menyalakan kembali pemutaran otomatis", async () => {
    window.localStorage.setItem("winnerAutoplayOff:ev1:1", "1");
    serve(PUBLISHED());
    mount();
    fireEvent.click(await screen.findByRole("button", { name: copy.results.autoplayOff }));
    expect(window.localStorage.getItem("winnerAutoplayOff:ev1:1")).toBeNull();
    expect(screen.getByRole("button", { name: copy.results.autoplayOn })).toBeTruthy();
  });
});

describe("pemutaran langsung oleh admin (live)", () => {
  const live = (target: "screen" | "everyone", ageMs: number): Server => {
    const s = PUBLISHED();
    s.snapshot = { ...s.snapshot, reveal: { seq: 4, startedAt: Date.now() - ageMs, target } };
    // sudah dimatikan otomatis: yang diuji hanya pemutaran langsung
    window.localStorage.setItem("winnerAutoplayOff:ev1:1", "1");
    return s;
  };

  it("target 'everyone' dan baru: diputar sekali per seq; tanpa kotak centang opt-out", async () => {
    serve(live("everyone", 5000));
    const a = mount();
    expect(await screen.findByRole("dialog", { hidden: true })).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: copy.reveal.skip }));
    a.unmount();
    mount(); // seq yang sama sudah dilihat di perangkat ini
    await screen.findByRole("button", { name: copy.results.replay });
    expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
  });

  it("target 'screen': tidak diputar di halaman pengunjung; terlambat (> 90 detik): tidak diputar", async () => {
    serve(live("screen", 5000));
    mount();
    await screen.findByRole("button", { name: copy.results.replay });
    expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
    cleanup();
    window.localStorage.removeItem("revealSeen:ev1");
    serve(live("everyone", 200_000));
    mount();
    await screen.findByRole("button", { name: copy.results.replay });
    expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
  });
});

describe("halaman /results", () => {
  it("menampilkan hasil akhir seluruh booth dan memutar animasi otomatis", async () => {
    serve(PUBLISHED());
    const { container } = mount("/results");
    expect(await screen.findByRole("dialog", { hidden: true })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: copy.reveal.skip }));
    await waitFor(() => expect(container.querySelector("[data-tier='1']")).not.toBeNull());
    expect(container.textContent).toContain("Es Teh Pak Budi"); // belum cukup ulasan tetap tercantum
    expect(container.querySelector("h1")?.textContent).toBe(makeEvent().name);
  });

  it("belum diumumkan: 'Hasil segera diumumkan', tanpa animasi", async () => {
    serve({ schedule: sched("ended"), snapshot: {} });
    mount("/results");
    expect(await screen.findByText(copy.results.notYet)).toBeTruthy();
    expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
    void act;
  });
});
