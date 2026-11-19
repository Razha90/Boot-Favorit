// @vitest-environment jsdom
import type { LatestReview, PublicSnapshot } from "@shared/api-types";
import type { TickMessage } from "@shared/live-core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BOOTHS } from "../../dev/fixtures";
import { applyTick, FEED_SIZE } from "./apply-tick";
import { backoffMs, useLive } from "./use-live";

const rv = (id: string): LatestReview => ({
  id,
  boothId: "b-lengkap",
  boothName: "K",
  stars: 5,
  text: id,
  displayName: "T",
  createdAt: 1,
});
const snap = (over: Partial<PublicSnapshot> = {}): PublicSnapshot => ({
  eventId: "e",
  ratingsHidden: false,
  booths: [
    { ...BOOTHS.lengkap, id: "a", ratingCount: 2, ratingAverage: 4 },
    { ...BOOTHS.hanyaNama, id: "b", ratingCount: 0, ratingAverage: null },
  ],
  stats: { boothCount: 2, reviewCount: 2, average: 4 },
  ranking: [],
  feed: [],
  reveal: null,
  resultsPublished: false,
  resultsVersion: 0,
  ...over,
});
const tick = (over: Partial<TickMessage> = {}): TickMessage => ({
  t: "tick",
  booths: [],
  ranks: null,
  leaderChanged: false,
  leader: null,
  feed: [],
  more: 0,
  ...over,
});

describe("applyTick", () => {
  it("delta booth dipasang; statistik global dihitung ulang", () => {
    const next = applyTick(snap(), tick({ booths: [{ id: "b", count: 2, avg: 5 }] }));
    expect(next.booths[1]).toMatchObject({ ratingCount: 2, ratingAverage: 5 });
    expect(next.stats).toEqual({ boothCount: 2, reviewCount: 4, average: 4.5 });
  });

  it("tanpa delta: objek booths tetap sama (tidak merender ulang daftar)", () => {
    const s = snap();
    expect(applyTick(s, tick()).booths).toBe(s.booths);
  });

  it("rating tersembunyi: delta diabaikan sepenuhnya", () => {
    const s = snap({ ratingsHidden: true });
    const next = applyTick(s, tick({ booths: [{ id: "a", count: 9, avg: 1 }] }));
    expect(next.booths).toBe(s.booths);
    expect(next.stats).toBe(s.stats);
  });

  it("peringkat: diganti hanya bila server mengirim dan peringkat memang boleh tampil", () => {
    const ranks = [{ boothId: "a", rank: 1, score: 4, average: 4, reviewCount: 3 }];
    expect(applyTick(snap({ ranking: [] }), tick({ ranks })).ranking).toEqual(ranks);
    expect(applyTick(snap({ ranking: [] }), tick({ ranks: null })).ranking).toEqual([]);
    // peringkat tersembunyi (null) tidak pernah "muncul" dari tick
    expect(applyTick(snap({ ranking: null }), tick({ ranks })).ranking).toBeNull();
  });

  it("feed: ulasan baru di depan, tanpa duplikat, dibatasi 5", () => {
    const s = snap({ feed: [rv("3"), rv("2"), rv("1")] });
    const next = applyTick(s, tick({ feed: [rv("5"), rv("4"), rv("3")] }));
    expect(next.feed.map((f) => f.id)).toEqual(["5", "4", "3", "2", "1"]);
    const big = applyTick(next, tick({ feed: [rv("9"), rv("8"), rv("7")] }));
    expect(big.feed).toHaveLength(FEED_SIZE);
    expect(big.feed[0]?.id).toBe("9");
  });
});

describe("backoffMs", () => {
  it("eksponensial, berjitter ±20%, dibatasi 30 detik", () => {
    expect(backoffMs(0, () => 0.5)).toBe(1000);
    expect(backoffMs(3, () => 0.5)).toBe(8000);
    expect(backoffMs(20, () => 0.5)).toBe(30_000);
    expect(backoffMs(2, () => 0)).toBe(3200);
    expect(backoffMs(2, () => 1)).toBe(4800);
  });
});

// ---------- hook dengan WebSocket palsu ----------
class FakeSocket {
  static all: FakeSocket[] = [];
  static OPEN = 1;
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];
  constructor(readonly url: string) {
    FakeSocket.all.push(this);
  }
  send(s: string) {
    this.sent.push(s);
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  emit(m: unknown) {
    this.onmessage?.({ data: typeof m === "string" ? m : JSON.stringify(m) });
  }
}

function setup(o: { enabled?: boolean; screen?: boolean } = {}) {
  const qc = new QueryClient();
  qc.setQueryData(["public", "snapshot", "e", 1], snap());
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const r = renderHook(() => useLive({ enabled: o.enabled ?? true, screen: o.screen }), {
    wrapper,
  });
  return { qc, ...r, sock: () => FakeSocket.all[FakeSocket.all.length - 1] as FakeSocket };
}
const visibility = (v: "hidden" | "visible") => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => v });
  document.dispatchEvent(new Event("visibilitychange"));
};

beforeEach(() => {
  FakeSocket.all = [];
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", FakeSocket);
  visibility("visible");
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useLive", () => {
  it("tidak aktif: tidak membuka koneksi; layar besar memakai slot ?screen=1", () => {
    setup({ enabled: false });
    expect(FakeSocket.all).toHaveLength(0);
    cleanup();
    const { sock } = setup({ screen: true });
    expect(sock().url).toMatch(/\/ws\?screen=1$/);
    cleanup();
    expect(setup().sock().url).toMatch(/\/ws$/);
  });

  it("hello → tersambung dan snapshot diambil ulang sekali (menutup celah saat putus)", () => {
    const { qc, result, sock } = setup();
    const spy = vi.spyOn(qc, "invalidateQueries");
    act(() => sock().open());
    expect(result.current.connected).toBe(false);
    act(() => sock().emit({ t: "hello", serverNow: 1 }));
    expect(result.current.connected).toBe(true);
    expect(spy).toHaveBeenCalledWith({ queryKey: ["public", "snapshot"] });
  });

  it("tick menambal snapshot di cache, menghitung '+N', dan memberi tanda pergantian peringkat 1", () => {
    const { qc, result, sock } = setup();
    act(() => sock().emit({ t: "hello", serverNow: 1 }));
    act(() =>
      sock().emit(
        tick({
          booths: [{ id: "b", count: 3, avg: 5 }],
          feed: [rv("x")],
          more: 7,
          leaderChanged: true,
          leader: "b",
        }),
      ),
    );
    const s = qc.getQueryData<PublicSnapshot>(["public", "snapshot", "e", 1]);
    expect(s?.booths[1]).toMatchObject({ ratingCount: 3, ratingAverage: 5 });
    expect(s?.feed.map((f) => f.id)).toEqual(["x"]);
    expect(result.current.more).toBe(7);
    expect(result.current.leader).toMatchObject({ boothId: "b" });
    act(() => result.current.resetMore());
    expect(result.current.more).toBe(0);
  });

  it("pesan rusak, 'pong', dan jenis tak dikenal diabaikan tanpa galat", () => {
    const { result, sock } = setup();
    act(() => sock().emit("pong"));
    act(() => sock().emit("bukan json {"));
    act(() => sock().emit({ t: "aneh" }));
    expect(result.current.connected).toBe(false);
  });

  it("refresh (aksi admin) → semua data publik dibuat usang", () => {
    const { qc, sock } = setup();
    const spy = vi.spyOn(qc, "invalidateQueries");
    act(() => sock().emit({ t: "refresh" }));
    expect(spy).toHaveBeenCalledWith({ queryKey: ["public"] });
  });

  it("event_status: ditutup, tidak menyambung lagi, polling jarang mengambil alih", () => {
    const { result, sock } = setup();
    act(() => sock().emit({ t: "hello", serverNow: 1 }));
    act(() => sock().emit({ t: "event_status", ended: true }));
    expect(result.current.connected).toBe(false);
    act(() => void vi.advanceTimersByTime(120_000));
    expect(FakeSocket.all).toHaveLength(1);
  });

  it("putus tiba-tiba: menyambung ulang dengan backoff; tersambung lagi → status kembali", () => {
    const { result, sock } = setup();
    act(() => sock().emit({ t: "hello", serverNow: 1 }));
    act(() => sock().close());
    expect(result.current.connected).toBe(false);
    expect(FakeSocket.all).toHaveLength(1);
    act(() => void vi.advanceTimersByTime(1300));
    expect(FakeSocket.all).toHaveLength(2);
    act(() => sock().emit({ t: "hello", serverNow: 2 }));
    expect(result.current.connected).toBe(true);
  });

  it("ditolak/penuh (langsung ditutup): terus mencoba dengan jeda membesar, tidak menyerbu server", () => {
    const { sock } = setup();
    for (let i = 0; i < 4; i++) act(() => sock().close());
    // jeda 1s lalu 2s lalu 4s: dalam 3 detik paling banyak 2 percobaan tambahan
    act(() => void vi.advanceTimersByTime(3000));
    expect(FakeSocket.all.length).toBeLessThanOrEqual(3);
  });

  it("tab tersembunyi = koneksi diputus; kembali terlihat = menyambung lagi", () => {
    const { sock } = setup();
    const first = sock();
    first.open();
    act(() => visibility("hidden"));
    expect(first.readyState).toBe(3);
    act(() => void vi.advanceTimersByTime(60_000));
    expect(FakeSocket.all).toHaveLength(1); // tidak menyambung saat tersembunyi
    act(() => visibility("visible"));
    expect(FakeSocket.all).toHaveLength(2);
  });

  it("ping keep-alive tiap 30 detik; membongkar komponen menutup koneksi", () => {
    const { sock, unmount } = setup();
    const s = sock();
    act(() => s.open());
    act(() => void vi.advanceTimersByTime(30_000));
    expect(s.sent).toEqual(["ping"]);
    unmount();
    expect(s.readyState).toBe(3);
    act(() => void vi.advanceTimersByTime(120_000));
    expect(FakeSocket.all).toHaveLength(1);
  });

  it("tanpa WebSocket di peramban: tidak ada galat (polling saja)", () => {
    vi.stubGlobal("WebSocket", undefined);
    const { result } = setup();
    expect(result.current.connected).toBe(false);
  });
});
