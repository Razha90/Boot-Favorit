import { ApiError } from "@shared/errors";
import { eq } from "drizzle-orm";
import type { Handler } from "hono";
import { describe, expect, it } from "vitest";
import type { AppEnv } from "../app-env";
import { idempotencyKeys } from "../db/schema";
import { clock, miniApp, testEnv } from "../test/app";
import { createTestDb } from "../test/d1";
import { idempotency, PROCESSING_TIMEOUT_MS, purgeExpiredIdempotencyKeys } from "./idempotency";

type TestHandler = Handler<AppEnv>;

function setup(handler?: TestHandler) {
  const t = createTestDb();
  const clk = clock(1_000_000);
  const app = miniApp(clk.now);
  const state = { calls: 0 };
  const defaultHandler: TestHandler = (c) => {
    state.calls++;
    return c.json({ created: state.calls }, 201);
  };
  app.post("/api/things", idempotency(), handler ?? defaultHandler);
  app.post("/api/other", idempotency(), defaultHandler);
  app.post("/api/required", idempotency({ required: true }), defaultHandler);
  app.get("/api/things", idempotency({ required: true }), (c) => c.json({ ok: true }));

  const post = (path: string, body: unknown, key?: string, headers: Record<string, string> = {}) =>
    app.request(
      path,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-connecting-ip": "10.0.0.1",
          ...(key ? { "Idempotency-Key": key } : {}),
          ...headers,
        },
        body: JSON.stringify(body),
      },
      testEnv(t),
    );
  return { t, clk, app, state, post };
}

const newKey = () => crypto.randomUUID();
const codeOf = async (res: Response) => ((await res.json()) as { code: string }).code;

describe("idempotency: alur dasar", () => {
  it("kunci baru menjalankan handler dan menyimpan respons", async () => {
    const { t, state, post } = setup();
    const key = newKey();
    const res = await post("/api/things", { a: 1 }, key);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ created: 1 });
    expect(state.calls).toBe(1);
    const row = await t.db.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, key)).get();
    expect(row).toMatchObject({ status: "done", responseStatus: 201 });
  });

  it("kunci sama dan isi sama: respons diputar ulang tanpa menjalankan handler lagi", async () => {
    const { state, post } = setup();
    const key = newKey();
    await post("/api/things", { a: 1 }, key);
    const replay = await post("/api/things", { a: 1 }, key);
    expect(replay.status).toBe(201);
    expect(replay.headers.get("Idempotent-Replay")).toBe("true");
    expect(await replay.json()).toEqual({ created: 1 });
    expect(state.calls).toBe(1);
  });

  it("kunci sama tetapi isi berbeda: 422 idempotency_mismatch", async () => {
    const { state, post } = setup();
    const key = newKey();
    await post("/api/things", { a: 1 }, key);
    const res = await post("/api/things", { a: 2 }, key);
    expect(res.status).toBe(422);
    expect(await codeOf(res)).toBe("idempotency_mismatch");
    expect(state.calls).toBe(1);
  });

  it("kunci sama tetapi rute berbeda: 422", async () => {
    const { post } = setup();
    const key = newKey();
    await post("/api/things", { a: 1 }, key);
    const res = await post("/api/other", { a: 1 }, key);
    expect(res.status).toBe(422);
  });

  it("pelaku berbeda boleh memakai kunci yang sama secara terpisah", async () => {
    const { state, post } = setup();
    const key = newKey();
    await post("/api/things", { a: 1 }, key, { "cf-connecting-ip": "10.0.0.1" });
    const other = await post("/api/things", { a: 1 }, key, { "cf-connecting-ip": "10.0.0.2" });
    expect(other.headers.get("Idempotent-Replay")).toBeNull();
    expect(state.calls).toBe(2);
  });

  it("GET tidak tersentuh walau rute meminta kunci", async () => {
    const { app, t } = setup();
    const res = await app.request("/api/things", {}, testEnv(t));
    expect(res.status).toBe(200);
  });
});

describe("idempotency: header", () => {
  it("wajib: tanpa header 400 idempotency_key_required", async () => {
    const { post } = setup();
    const res = await post("/api/required", {});
    expect(res.status).toBe(400);
    expect(await codeOf(res)).toBe("idempotency_key_required");
  });

  it("tidak wajib: tanpa header handler tetap jalan dan tidak ada baris tersimpan", async () => {
    const { t, state, post } = setup();
    await post("/api/things", {});
    await post("/api/things", {});
    expect(state.calls).toBe(2);
    expect(await t.db.select().from(idempotencyKeys)).toHaveLength(0);
  });

  it("kunci yang bukan UUID ditolak validation_error", async () => {
    const { state, post } = setup();
    const res = await post("/api/things", {}, "bukan-uuid");
    expect(res.status).toBe(400);
    expect(await codeOf(res)).toBe("validation_error");
    expect(state.calls).toBe(0);
  });
});

describe("idempotency: permintaan bersamaan dan kegagalan", () => {
  it("dua permintaan paralel dengan kunci sama: satu efek, yang kedua 409 request_in_progress", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    let calls = 0;
    const { post } = setup(async (c) => {
      calls++;
      await gate;
      return c.json({ ok: true }, 201);
    });
    const key = newKey();

    const first = post("/api/things", { a: 1 }, key);
    await new Promise((r) => setTimeout(r, 25)); // biarkan permintaan pertama mengklaim kunci
    const second = await post("/api/things", { a: 1 }, key);
    expect(second.status).toBe(409);
    expect(second.headers.get("Retry-After")).toBe("1");
    expect(await codeOf(second)).toBe("request_in_progress");

    release();
    expect((await first).status).toBe(201);
    expect(calls).toBe(1);

    // Setelah selesai, pengulangan memutar respons tersimpan.
    const third = await post("/api/things", { a: 1 }, key);
    expect(third.headers.get("Idempotent-Replay")).toBe("true");
    expect(calls).toBe(1);
  });

  it("processing yang menggantung > 60 detik diambil alih", async () => {
    const { t, clk, state, post } = setup();
    const key = newKey();
    // Permintaan lama yang "mati" di tengah jalan: ada baris processing, tidak ada yang melanjutkan.
    await post("/api/things", { a: 1 }, key); // membuat baris done; ubah jadi processing basi
    await t.db
      .update(idempotencyKeys)
      .set({ status: "processing", responseStatus: null, responseBody: null, updatedAt: clk.t })
      .where(eq(idempotencyKeys.key, key));
    state.calls = 0;

    clk.t += PROCESSING_TIMEOUT_MS - 1;
    expect((await post("/api/things", { a: 1 }, key)).status).toBe(409); // belum basi
    clk.t += 2;
    const res = await post("/api/things", { a: 1 }, key);
    expect(res.status).toBe(201);
    expect(state.calls).toBe(1);
  });

  it("respons 5xx tidak disimpan: kunci dilepas sehingga 'Coba lagi' menjalankan handler lagi", async () => {
    let calls = 0;
    const { t, post } = setup((c) => {
      calls++;
      if (calls === 1) throw new Error("D1 timeout");
      return c.json({ ok: true }, 201);
    });
    const key = newKey();
    const first = await post("/api/things", { a: 1 }, key);
    expect(first.status).toBe(500);
    expect(await t.db.select().from(idempotencyKeys)).toHaveLength(0);

    const retry = await post("/api/things", { a: 1 }, key);
    expect(retry.status).toBe(201);
    expect(calls).toBe(2);
  });

  it("galat 4xx dari handler disimpan dan diputar ulang apa adanya", async () => {
    let calls = 0;
    const { post } = setup(() => {
      calls++;
      throw new ApiError("product_limit");
    });
    const key = newKey();
    expect(await codeOf(await post("/api/things", { a: 1 }, key))).toBe("product_limit");
    const replay = await post("/api/things", { a: 1 }, key);
    expect(replay.status).toBe(409);
    expect(await codeOf(replay)).toBe("product_limit");
    expect(replay.headers.get("Idempotent-Replay")).toBe("true");
    expect(calls).toBe(1);
  });

  it("respons terlalu besar tidak disimpan (tidak idempoten, tetapi tidak merusak)", async () => {
    let calls = 0;
    const { post } = setup((c) => {
      calls++;
      return c.json({ blob: "x".repeat(20_000) });
    });
    const key = newKey();
    await post("/api/things", { a: 1 }, key);
    const again = await post("/api/things", { a: 1 }, key);
    expect(again.headers.get("Idempotent-Replay")).toBeNull();
    expect(calls).toBe(2);
  });
});

describe("purgeExpiredIdempotencyKeys", () => {
  it("menghapus kunci lebih tua dari TTL dan menyisakan yang baru", async () => {
    const t = createTestDb();
    const now = 100 * 3_600_000;
    const row = (key: string, createdAt: number) => ({
      actor: "a",
      key,
      route: "POST /x",
      bodyHash: "h",
      status: "done" as const,
      createdAt,
      updatedAt: createdAt,
    });
    await t.db
      .insert(idempotencyKeys)
      .values([row("lama", now - 25 * 3_600_000), row("baru", now - 1 * 3_600_000)]);
    expect(await purgeExpiredIdempotencyKeys(t.db, now)).toBe(1);
    const left = await t.db.select().from(idempotencyKeys);
    expect(left.map((r) => r.key)).toEqual(["baru"]);
  });
});
