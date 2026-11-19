import { describe, expect, it } from "vitest";
import { CONFIG } from "./config";
import type { ResultEntry } from "./results";
import {
  autoplayOffKey,
  panelAt,
  revealDurationMs,
  revealSteps,
  screenPanels,
  shouldAutoReplay,
  shouldPlayLive,
} from "./reveal";

const e = (id: string, rank: number | null): ResultEntry => ({
  boothId: id,
  rank,
  name: id,
  boothNo: null,
  coverThumbKey: null,
  average: 4,
  reviewCount: 5,
  score: rank ? 4 : null,
  topCategories: [],
});

describe("revealSteps", () => {
  it("3-2-1 → juara 3 → 2 → 1 → daftar; total sekitar 13,5 detik", () => {
    const s = revealSteps([e("a", 1), e("b", 2), e("c", 3), e("d", 4), e("x", null)]);
    expect(
      s.map((x) => (x.kind === "count" ? `n${x.n}` : x.kind === "place" ? `p${x.rank}` : "list")),
    ).toEqual(["n3", "n2", "n1", "p3", "p2", "p1", "list"]);
    expect(revealDurationMs(s)).toBe(3 * CONFIG.reveal.countdownStepMs + 3 * CONFIG.reveal.placeMs);
    expect(revealDurationMs(s)).toBeGreaterThanOrEqual(12_000);
    expect(revealDurationMs(s)).toBeLessThanOrEqual(14_000);
  });

  it("panggung memuat booth yang dimaksud (juara 3 dulu, juara 1 terakhir)", () => {
    const s = revealSteps([e("a", 1), e("b", 2), e("c", 3)]);
    const places = s.flatMap((x) => (x.kind === "place" ? [x.entry.boothId] : []));
    expect(places).toEqual(["c", "b", "a"]);
  });

  it("hanya 2 booth diperingkat: hanya juara 2 dan 1; satu: hanya juara 1", () => {
    const two = revealSteps([e("a", 1), e("b", 2), e("x", null)]);
    expect(two.filter((x) => x.kind === "place")).toHaveLength(2);
    const one = revealSteps([e("a", 1)]);
    expect(one.filter((x) => x.kind === "place")).toHaveLength(1);
  });

  it("tak ada yang diperingkat (atau daftar kosong): langsung daftar, tanpa hitung mundur", () => {
    expect(revealSteps([e("x", null), e("y", null)])).toEqual([{ kind: "list" }]);
    expect(revealSteps([])).toEqual([{ kind: "list" }]);
  });
});

describe("kapan animasi diputar", () => {
  it("mode replay: hanya selesai + diumumkan + belum dimatikan perangkat ini", () => {
    const base = { frozen: true, resultsPublished: true, optedOut: false };
    expect(shouldAutoReplay(base)).toBe(true);
    expect(shouldAutoReplay({ ...base, optedOut: true })).toBe(false);
    expect(shouldAutoReplay({ ...base, resultsPublished: false })).toBe(false); // "Hasil segera diumumkan"
    expect(shouldAutoReplay({ ...base, frozen: false })).toBe(false);
  });

  it("kunci opt-out memuat versi hasil: pembaruan hasil menyalakan pemutaran lagi", () => {
    expect(autoplayOffKey("ev", 1)).not.toBe(autoplayOffKey("ev", 2));
  });

  const reveal = { seq: 3, startedAt: 1_000_000, target: "everyone" as const };
  it("mode live: sekali per seq, hanya bila baru; terlambat tidak memutar ulang", () => {
    const at = (now: number, lastSeenSeq: number, area: "screen" | "event" = "event", r = reveal) =>
      shouldPlayLive({ reveal: r, lastSeenSeq, now, area });
    expect(at(1_005_000, 2)).toBe(true);
    expect(at(1_005_000, 3)).toBe(false); // seq sama sudah dilihat
    expect(at(1_000_000 + CONFIG.reveal.liveWindowMs - 1, 2)).toBe(true);
    expect(at(1_000_000 + CONFIG.reveal.liveWindowMs, 2)).toBe(false); // terlambat
    expect(shouldPlayLive({ reveal: null, lastSeenSeq: 0, now: 1, area: "event" })).toBe(false);
  });

  it("target 'screen' hanya diputar di Layar Besar; 'everyone' di kedua tempat", () => {
    const screenOnly = { ...reveal, target: "screen" as const };
    expect(
      shouldPlayLive({ reveal: screenOnly, lastSeenSeq: 0, now: 1_001_000, area: "event" }),
    ).toBe(false);
    expect(
      shouldPlayLive({ reveal: screenOnly, lastSeenSeq: 0, now: 1_001_000, area: "screen" }),
    ).toBe(true);
    expect(shouldPlayLive({ reveal, lastSeenSeq: 0, now: 1_001_000, area: "screen" })).toBe(true);
  });
});

describe("panel Layar Besar", () => {
  const base = {
    boothCount: 8,
    feedCount: 5,
    rankingCount: 8,
    resultsPublished: false,
    frozen: false,
  };

  it("urutan Sorotan → Semua booth → Ulasan terbaru → Peringkat; peringkat SELALU terakhir", () => {
    expect(screenPanels(base)).toEqual(["spotlight", "booths", "feed", "ranking"]);
  });

  it("peringkat tersembunyi (null) atau kosong: panel peringkat tidak ada", () => {
    expect(screenPanels({ ...base, rankingCount: null })).toEqual(["spotlight", "booths", "feed"]);
    expect(screenPanels({ ...base, rankingCount: 0 })).toEqual(["spotlight", "booths", "feed"]);
  });

  it("tanpa ulasan: tanpa panel ulasan; tanpa booth: tanpa sorotan dan daftar", () => {
    expect(screenPanels({ ...base, feedCount: 0 })).toEqual(["spotlight", "booths", "ranking"]);
    expect(screenPanels({ ...base, boothCount: 0, feedCount: 0, rankingCount: null })).toEqual([]);
  });

  it("selesai + diumumkan: hasil akhir menggantikan peringkat langsung (tetap terakhir)", () => {
    expect(screenPanels({ ...base, frozen: true, resultsPublished: true })).toEqual([
      "spotlight",
      "booths",
      "feed",
      "results",
    ]);
    expect(screenPanels({ ...base, frozen: true, resultsPublished: false })).toEqual([
      "spotlight",
      "booths",
      "feed",
      "ranking",
    ]);
  });

  it("panelAt: deterministik dari waktu server, berputar, kosong → null", () => {
    const p = ["a", "b", "c"];
    expect(panelAt(p, 0, 0, 1000)).toBe("a");
    expect(panelAt(p, 1999, 0, 1000)).toBe("b");
    expect(panelAt(p, 3000, 0, 1000)).toBe("a"); // berputar
    expect(panelAt(p, -5000, 0, 1000)).toBe("a"); // sebelum mulai tidak mundur
    expect(panelAt([], 5, 0, 1000)).toBeNull();
  });
});
