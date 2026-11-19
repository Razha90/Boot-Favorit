// Penjalan aksi anti klik ganda (explore.md B21 lapis 1 dan 2). Murni TypeScript (tanpa React) agar mudah diuji.
//
//  - Penjaga SINKRON memakai flag biasa, bukan state React: klik kedua yang datang sebelum React sempat
//    me-render ulang tetap diabaikan.
//  - Satu Idempotency-Key per NIAT aksi: "Coba lagi" setelah galat memakai kunci yang sama (server
//    mungkin sudah memproses); kunci baru dibuat hanya setelah sukses atau reset().
//  - Waktu tunggu klien ≠ gagal di server, karena itu galatnya NetworkError("timeout") dan aman diulang.

import { NetworkError } from "./api";

export type ActionStatus = "idle" | "pending" | "success" | "error";

export interface ActionContext {
  key: string;
  signal: AbortSignal;
}

export interface ActionState<R> {
  status: ActionStatus;
  error: Error | null;
  result: R | undefined;
}

export interface RunnerOptions<R> {
  timeoutMs: number;
  newKey?: () => string;
  onChange: (state: ActionState<R>) => void;
}

export function createActionRunner<R>(
  fn: (ctx: ActionContext) => Promise<R>,
  opts: RunnerOptions<R>,
) {
  const newKey = opts.newKey ?? (() => crypto.randomUUID());
  let running = false;
  let key: string | null = null;
  let state: ActionState<R> = { status: "idle", error: null, result: undefined };

  const set = (next: ActionState<R>) => {
    state = next;
    opts.onChange(state);
  };

  async function run(): Promise<R | undefined> {
    if (running) return undefined; // klik ganda: diabaikan
    running = true;
    key ??= newKey();
    set({ status: "pending", error: null, result: state.result });

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, opts.timeoutMs);

    try {
      const result = await fn({ key, signal: controller.signal });
      key = null; // niat selesai: aksi berikutnya adalah niat baru
      set({ status: "success", error: null, result });
      return result;
    } catch (err) {
      const error =
        timedOut && err instanceof DOMException && err.name === "AbortError"
          ? new NetworkError("timeout")
          : err instanceof Error
            ? err
            : new Error(String(err));
      set({ status: "error", error, result: undefined });
      return undefined;
    } finally {
      clearTimeout(timer);
      running = false;
    }
  }

  /** Kembali ke idle dan BUANG kunci (mis. isian berubah: itu niat baru). */
  function reset() {
    if (running) return;
    key = null;
    set({ status: "idle", error: null, result: undefined });
  }

  return {
    run,
    reset,
    get state() {
      return state;
    },
  };
}
