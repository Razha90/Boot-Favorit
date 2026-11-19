import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "../app-env";
import { edgeJson } from "./edge-cache";

/** Cache palsu seperti `caches.default`: kunci = URL permintaan. */
function fakeCache() {
  const store = new Map<string, Response>();
  return {
    store,
    match: async (r: Request) => store.get(r.url)?.clone(),
    put: async (r: Request, res: Response) => void store.set(r.url, res.clone()),
  };
}

function app(produce: () => Promise<unknown>, key = "k1") {
  return new Hono<AppEnv>().get("/x", (c) => edgeJson(c, { key, ttlSec: 5 }, produce));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("edgeJson", () => {
  it("tanpa Cache API (tes Node): selalu memproduksi dan tetap memberi ETag + Cache-Control", async () => {
    const produce = vi.fn(async () => ({ a: 1 }));
    const a = app(produce);
    const r1 = await a.request("/x");
    await a.request("/x");
    expect(produce).toHaveBeenCalledTimes(2);
    expect(await r1.json()).toEqual({ a: 1 });
    expect(r1.headers.get("etag")).toMatch(/^W\/"[0-9a-f]{16}"$/);
    expect(r1.headers.get("cache-control")).toBe("public, s-maxage=5");
  });

  it("dengan cache: permintaan kedua dengan kunci sama dilayani cache tanpa memproduksi lagi", async () => {
    const cache = fakeCache();
    vi.stubGlobal("caches", { default: cache });
    const produce = vi.fn(async () => ({ n: produce.mock.calls.length }));
    const a = app(produce);

    const first = await a.request("/x");
    expect(first.headers.get("x-cache")).toBe("MISS");
    const second = await a.request("/x");
    expect(second.headers.get("x-cache")).toBe("HIT");
    expect(await second.json()).toEqual({ n: 1 }); // isi dari permintaan pertama
    expect(produce).toHaveBeenCalledTimes(1);
  });

  it("kunci berbeda (versi berganti) = produksi ulang; kunci lama tidak mengganggu", async () => {
    const cache = fakeCache();
    vi.stubGlobal("caches", { default: cache });
    let version = "s1";
    const produce = vi.fn(async () => ({ version }));
    const a = new Hono<AppEnv>().get("/x", (c) =>
      edgeJson(c, { key: `snap:${version}`, ttlSec: 5 }, produce),
    );
    expect(await (await a.request("/x")).json()).toEqual({ version: "s1" });
    version = "s2";
    expect(await (await a.request("/x")).json()).toEqual({ version: "s2" });
    expect(produce).toHaveBeenCalledTimes(2);
  });

  it("ETag + If-None-Match → 304 tanpa badan (di MISS maupun HIT)", async () => {
    const cache = fakeCache();
    vi.stubGlobal("caches", { default: cache });
    const a = app(async () => ({ besar: "x".repeat(2000) }));
    const first = await a.request("/x");
    const etag = first.headers.get("etag") ?? "";
    const hit = await a.request("/x", { headers: { "If-None-Match": etag } });
    expect(hit.status).toBe(304);
    expect(await hit.text()).toBe("");
    const stale = await a.request("/x", { headers: { "If-None-Match": 'W/"lain"' } });
    expect(stale.status).toBe(200);
  });

  it("galat saat memproduksi tidak masuk cache (permintaan berikutnya mencoba lagi)", async () => {
    const cache = fakeCache();
    vi.stubGlobal("caches", { default: cache });
    let fail = true;
    const a = app(async () => {
      if (fail) throw new Error("gagal");
      return { ok: true };
    });
    expect((await a.request("/x")).status).toBe(500);
    expect(cache.store.size).toBe(0);
    fail = false;
    expect(await (await a.request("/x")).json()).toEqual({ ok: true });
  });
});
