import { describe, expect, it } from "vitest";
import { clock, miniApp } from "../test/app";
import { FixedWindowLimiter, rateLimit } from "./rate-limit";

describe("FixedWindowLimiter", () => {
  it("mengizinkan sampai batas lalu menolak dalam jendela yang sama", () => {
    const l = new FixedWindowLimiter(3, 10_000);
    expect(l.hit("k", 0).allowed).toBe(true);
    expect(l.hit("k", 1).allowed).toBe(true);
    const third = l.hit("k", 2);
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);
    expect(l.hit("k", 3).allowed).toBe(false);
  });

  it("jendela baru mereset hitungan", () => {
    const l = new FixedWindowLimiter(1, 10_000);
    expect(l.hit("k", 0).allowed).toBe(true);
    expect(l.hit("k", 9_999).allowed).toBe(false);
    expect(l.hit("k", 10_000).allowed).toBe(true);
  });

  it("kunci berbeda dihitung terpisah", () => {
    const l = new FixedWindowLimiter(1, 10_000);
    expect(l.hit("a", 0).allowed).toBe(true);
    expect(l.hit("b", 0).allowed).toBe(true);
    expect(l.hit("a", 1).allowed).toBe(false);
  });

  it("retryAfterSec sisa waktu jendela, minimal 1", () => {
    const l = new FixedWindowLimiter(1, 10_000);
    l.hit("k", 0);
    expect(l.hit("k", 2_500).retryAfterSec).toBe(8);
    expect(l.hit("k", 9_999).retryAfterSec).toBe(1);
  });

  it("membuang jendela kedaluwarsa agar memori tidak membesar", () => {
    const l = new FixedWindowLimiter(5, 1_000);
    for (let i = 0; i < 100; i++) l.hit(`k${i}`, 0);
    expect(l.size).toBe(100);
    l.hit("baru", 5_000);
    expect(l.size).toBe(1);
  });
});

describe("rateLimit (middleware)", () => {
  it("menjawab 429 rate_limited + Retry-After setelah batas", async () => {
    const clk = clock(0);
    const app = miniApp(clk.now);
    app.post("/otp", rateLimit({ name: "otp", limit: 2, windowSec: 60 }), (c) => c.json({ ok: 1 }));
    const send = (ip: string) =>
      app.request("/otp", { method: "POST", headers: { "cf-connecting-ip": ip } }, {} as Env);

    expect((await send("1.1.1.1")).status).toBe(200);
    expect((await send("1.1.1.1")).status).toBe(200);
    const blocked = await send("1.1.1.1");
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBe("60");
    expect(await blocked.json()).toEqual({ code: "rate_limited" });

    // Klien lain tidak terpengaruh.
    expect((await send("2.2.2.2")).status).toBe(200);

    // Setelah jendela lewat, boleh lagi.
    clk.t = 60_000;
    expect((await send("1.1.1.1")).status).toBe(200);
  });

  it("memakai fungsi kunci kustom (mis. per email)", async () => {
    const app = miniApp(() => 0);
    app.post(
      "/otp",
      rateLimit({ name: "otp-email", limit: 1, windowSec: 60, key: (c) => c.req.query("e") ?? "" }),
      (c) => c.json({ ok: 1 }),
    );
    const send = (e: string) => app.request(`/otp?e=${e}`, { method: "POST" }, {} as Env);
    expect((await send("a")).status).toBe(200);
    expect((await send("a")).status).toBe(429);
    expect((await send("b")).status).toBe(200);
  });
});
