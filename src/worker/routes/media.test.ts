import { describe, expect, it } from "vitest";
import { createApp } from "../index";
import { testEnv } from "../test/app";
import { createTestDb } from "../test/d1";
import { FakeR2 } from "../test/r2";

function setup() {
  const t = createTestDb();
  const r2 = new FakeR2();
  const app = createApp();
  const get = (path: string) => app.request(path, {}, testEnv(t, { MEDIA: r2.asBucket() }));
  return { r2, get };
}

describe("GET /media/*", () => {
  it("menyajikan gambar dengan header cache abadi dan nosniff", async () => {
    const { r2, get } = setup();
    await r2.put("events/e1/booths/b1/abc-thumb.webp", new Uint8Array([1, 2, 3]), {
      httpMetadata: { contentType: "image/webp" },
    });
    const res = await get("/media/events/e1/booths/b1/abc-thumb.webp");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(res.headers.get("cache-control")).toContain("immutable");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("404 polos (bukan JSON) bila tidak ada, supaya <img> tidak bingung", async () => {
    const { get } = setup();
    const res = await get("/media/events/e1/tidak-ada.webp");
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("");
  });

  it("hanya ruang nama events/ dan tanpa penelusuran jalur", async () => {
    const { r2, get } = setup();
    await r2.put("rahasia/data.bin", new Uint8Array([9]));
    expect((await get("/media/rahasia/data.bin")).status).toBe(404);
    expect((await get("/media/events/../rahasia/data.bin")).status).toBe(404);
    expect((await get("/media/events/%2e%2e/rahasia/data.bin")).status).toBe(404);
  });
});
