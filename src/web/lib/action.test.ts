import { ApiError } from "@shared/errors";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type ActionState, createActionRunner } from "./action";
import { NetworkError } from "./api";

afterEach(() => vi.useRealTimers());

function setup<R>(fn: Parameters<typeof createActionRunner<R>>[0], timeoutMs = 15_000) {
  const states: ActionState<R>[] = [];
  let n = 0;
  const runner = createActionRunner<R>(fn, {
    timeoutMs,
    newKey: () => `key-${++n}`,
    onChange: (s) => states.push(s),
  });
  return { runner, states };
}

describe("createActionRunner: anti klik ganda", () => {
  it("dua panggilan sinkron: fungsi hanya dijalankan sekali", async () => {
    const fn = vi.fn(async () => "ok");
    const { runner } = setup(fn);
    const [a, b] = [runner.run(), runner.run()]; // tanpa await di antaranya
    expect(await a).toBe("ok");
    expect(await b).toBeUndefined();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("selama pending panggilan berikutnya diabaikan; setelah selesai boleh lagi", async () => {
    let release!: () => void;
    const fn = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          release = () => resolve("selesai");
        }),
    );
    const { runner } = setup(fn);
    const first = runner.run();
    expect(runner.state.status).toBe("pending");
    await runner.run();
    expect(fn).toHaveBeenCalledTimes(1);
    release();
    await first;
    expect(runner.state.status).toBe("success");
    const second = runner.run();
    expect(fn).toHaveBeenCalledTimes(2);
    release();
    await second;
  });
});

describe("createActionRunner: kunci idempotensi", () => {
  it("'Coba lagi' setelah galat memakai kunci yang SAMA", async () => {
    const keys: string[] = [];
    let fail = true;
    const { runner } = setup(async ({ key }) => {
      keys.push(key);
      if (fail) throw new ApiError("internal_error");
      return "ok";
    });
    await runner.run();
    expect(runner.state.status).toBe("error");
    fail = false;
    await runner.run();
    expect(keys).toEqual(["key-1", "key-1"]);
    expect(runner.state.status).toBe("success");
  });

  it("setelah sukses, aksi berikutnya memakai kunci BARU", async () => {
    const keys: string[] = [];
    const { runner } = setup(async ({ key }) => {
      keys.push(key);
      return "ok";
    });
    await runner.run();
    await runner.run();
    expect(keys).toEqual(["key-1", "key-2"]);
  });

  it("reset() membuang kunci (isian berubah = niat baru)", async () => {
    const keys: string[] = [];
    let fail = true;
    const { runner } = setup(async ({ key }) => {
      keys.push(key);
      if (fail) throw new Error("gagal");
      return "ok";
    });
    await runner.run();
    runner.reset();
    expect(runner.state.status).toBe("idle");
    fail = false;
    await runner.run();
    expect(keys).toEqual(["key-1", "key-2"]);
  });
});

describe("createActionRunner: galat dan waktu tunggu", () => {
  it("menyimpan galat dan status error", async () => {
    const { runner, states } = setup(async () => {
      throw new ApiError("email_in_use");
    });
    await runner.run();
    expect(runner.state.status).toBe("error");
    expect((runner.state.error as ApiError).code).toBe("email_in_use");
    expect(states.map((s) => s.status)).toEqual(["pending", "error"]);
  });

  it("melewati batas waktu: abort sinyal lalu NetworkError('timeout'), aman diulang", async () => {
    vi.useFakeTimers();
    const fn = vi.fn(
      ({ signal }: { signal: AbortSignal }) =>
        new Promise<string>((_, reject) => {
          signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    const { runner } = setup(fn, 15_000);
    const p = runner.run();
    await vi.advanceTimersByTimeAsync(15_000);
    await p;
    expect(runner.state.status).toBe("error");
    expect(runner.state.error).toBeInstanceOf(NetworkError);
    expect((runner.state.error as NetworkError).reason).toBe("timeout");
    // Setelah timeout, tombol bisa dipakai lagi (kunci sama dipertahankan).
    const again = runner.run();
    expect(fn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(15_000);
    await again;
  });
});
