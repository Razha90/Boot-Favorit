// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { countdownText, heroCopy, splitHighlight } from "./hero-copy";
import { createSafeStorage, type SafeStorage } from "./safe-storage";
import { buildShareText, buildShareUrl, canNativeShare, whatsappShareLink } from "./share";
import { getVisitorSeed } from "./visitor-seed";
import {
  compareBoothNo,
  readWishlist,
  useWishlist,
  WishlistProvider,
  wishlistKey,
} from "./wishlist";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

const memStore = (): SafeStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    get: (k) => data.get(k) ?? null,
    set: (k, v) => void data.set(k, v),
    remove: (k) => void data.delete(k),
  };
};

describe("safe-storage", () => {
  it("menyimpan dan membaca; remove menghapus", () => {
    const s = createSafeStorage();
    s.set("k1", "v");
    expect(s.get("k1")).toBe("v");
    s.remove("k1");
    expect(s.get("k1")).toBeNull();
  });

  it("localStorage melempar (mode privat/diblokir): turun ke sessionStorage lalu memori, tanpa galat", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage) {
      throw new DOMException("QuotaExceeded");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("SecurityError");
    });
    const s = createSafeStorage();
    expect(() => s.set("k2", "tetap-ada")).not.toThrow();
    expect(s.get("k2")).toBe("tetap-ada"); // dari memori
  });
});

describe("visitor-seed", () => {
  it("dibuat sekali lalu stabil; pengunjung lain mendapat seed berbeda", () => {
    const a = memStore();
    const first = getVisitorSeed(a, () => 123456);
    expect(first).toBeTruthy();
    expect(getVisitorSeed(a, () => 999)).toBe(first); // tidak dibuat ulang
    expect(getVisitorSeed(memStore(), () => 654321)).not.toBe(first);
  });
});

describe("share", () => {
  it("tautan booth dan produk, dengan src=share", () => {
    expect(buildShareUrl({ origin: "https://eventunimed.id", boothId: "b1" })).toBe(
      "https://eventunimed.id/b/b1?src=share",
    );
    expect(
      buildShareUrl({ origin: "https://eventunimed.id", boothId: "b1", productId: "p9" }),
    ).toBe("https://eventunimed.id/b/b1?p=p9&src=share");
  });

  it("teks bawaan tidak pernah meminta bintang atau ulasan", () => {
    const texts = [
      buildShareText({ eventName: "Expo", boothName: "Kopi" }),
      buildShareText({ eventName: "Expo", boothName: "Kopi", productName: "Susu" }),
    ];
    for (const t of texts) expect(t).not.toMatch(/bintang|ulasan|rating|nilai/i);
    expect(texts[1]).toContain("Susu");
  });

  it("tautan WhatsApp bagikan tanpa nomor (memilih kontak sendiri)", () => {
    const link = whatsappShareLink("Halo", "https://x/b/1");
    expect(link.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(link)).toContain("https://x/b/1");
  });

  it("deteksi Web Share API", () => {
    expect(canNativeShare({ share: async () => {} })).toBe(true);
    expect(canNativeShare({} as Navigator)).toBe(false);
    expect(canNativeShare(undefined)).toBe(false);
  });
});

describe("hero-copy: teks selaras dengan status event", () => {
  const phases = [
    ["upcoming", false, "VOTING SEGERA DIBUKA", "Intip booth-nya"],
    ["live", false, "VOTING DIBUKA", "Yuk, cobain jelajah booth"],
    ["ended", false, "EVENT UDAH SELESAI", "Lihat semua booth"],
    ["ended", true, "EVENT UDAH SELESAI", "Lihat Rekap & Booth Terfavorit"],
  ] as const;
  for (const [phase, resultsPublished, badge, cta] of phases) {
    it(`${phase}${resultsPublished ? " + hasil diumumkan" : ""}`, () => {
      const c = heroCopy({ phase, resultsPublished });
      expect(c.badge).toBe(badge);
      expect(c.cta).toBe(cta);
      expect(c.live).toBe(phase === "live");
      expect(c.sub.length).toBeGreaterThan(10);
    });
  }

  it("splitHighlight menandai kata sorotan tanpa membedakan huruf besar-kecil", () => {
    expect(splitHighlight("Penilaian Booth Terfavorit LPPM Expo", "terfavorit")).toEqual([
      { text: "Penilaian Booth ", hl: false },
      { text: "Terfavorit", hl: true },
      { text: " LPPM Expo", hl: false },
    ]);
    expect(splitHighlight("Judul", null)).toEqual([{ text: "Judul", hl: false }]);
    expect(splitHighlight("Judul", "tidak ada")).toEqual([{ text: "Judul", hl: false }]);
    expect(splitHighlight("Terfavorit", "Terfavorit")).toEqual([{ text: "Terfavorit", hl: true }]);
  });

  it("countdownText memilih satuan yang sesuai", () => {
    const now = 0;
    expect(countdownText(2 * 86_400_000 + 3 * 3_600_000, now)).toBe("2 hari 3 jam");
    expect(countdownText(3 * 3_600_000 + 5 * 60_000, now)).toBe("3 jam 5 menit");
    expect(countdownText(5 * 60_000, now)).toBe("5 menit");
    expect(countdownText(30_000, now)).toBe("kurang dari semenit");
    expect(countdownText(-1000, now)).toBe("kurang dari semenit");
  });
});

describe("wishlist", () => {
  const wrapper =
    (store: SafeStorage, eventId = "e1") =>
    ({ children }: { children: ReactNode }) => (
      <WishlistProvider eventId={eventId} store={store}>
        {children}
      </WishlistProvider>
    );

  it("menambah, mencegah ganda, menghapus, dan menyimpan per event", () => {
    const store = memStore();
    const { result } = renderHook(() => useWishlist(), { wrapper: wrapper(store) });
    act(() => {
      result.current.add("b1", "p1");
      result.current.add("b1", "p1"); // ganda diabaikan
    });
    expect(result.current.count).toBe(1);
    expect(result.current.has("b1", "p1")).toBe(true);
    expect(JSON.parse(store.data.get(wishlistKey("e1")) ?? "[]")).toEqual([
      { boothId: "b1", productId: "p1" },
    ]);
    act(() => result.current.remove("b1", "p1"));
    expect(result.current.count).toBe(0);
  });

  it("dimuat dari penyimpanan, terpisah antar event", () => {
    const store = memStore();
    store.set(wishlistKey("e1"), JSON.stringify([{ boothId: "b", productId: "p" }]));
    const a = renderHook(() => useWishlist(), { wrapper: wrapper(store, "e1") });
    expect(a.result.current.count).toBe(1);
    const b = renderHook(() => useWishlist(), { wrapper: wrapper(store, "e2") });
    expect(b.result.current.count).toBe(0);
  });

  it("batas wishlistMax (50): menolak yang ke-51", () => {
    const { result } = renderHook(() => useWishlist(), { wrapper: wrapper(memStore()) });
    for (let i = 0; i < 50; i++) act(() => void result.current.add("b", `p${i}`));
    expect(result.current.count).toBe(50);
    let ok = true;
    act(() => {
      ok = result.current.add("b", "p-lebih");
    });
    expect(ok).toBe(false);
    expect(result.current.count).toBe(50);
  });

  it("prune membuang produk yang sudah hilang", () => {
    const store = memStore();
    const { result } = renderHook(() => useWishlist(), { wrapper: wrapper(store) });
    act(() => {
      result.current.add("b1", "p1");
      result.current.add("b1", "p2");
    });
    act(() => result.current.prune(new Set(["b1:p2"])));
    expect(result.current.entries).toEqual([{ boothId: "b1", productId: "p2" }]);
  });

  it("data rusak di penyimpanan tidak menjatuhkan: mulai dari kosong", () => {
    const store = memStore();
    for (const bad of ["{bukan json", '"string"', '{"a":1}', '[{"boothId":1}]', "null"]) {
      store.set(wishlistKey("e1"), bad);
      expect(readWishlist(store, "e1")).toEqual([]);
    }
  });

  it("hook di luar provider memberi galat yang jelas", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useWishlist())).toThrow(/WishlistProvider/);
  });

  it("urutan nomor booth natural; tanpa nomor di akhir", () => {
    const sorted = ["B1", "A10", null, "A2", "a1"].sort(compareBoothNo);
    expect(sorted).toEqual(["a1", "A2", "A10", "B1", null]);
  });
});
