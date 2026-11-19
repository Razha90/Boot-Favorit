import { useCallback, useEffect, useRef, useState } from "react";
import { type ActionContext, type ActionState, createActionRunner } from "./action";
import { REQUEST_TIMEOUT_MS } from "./api";

export interface UseActionOptions {
  timeoutMs?: number;
}

/**
 * Hook untuk SEMUA aksi yang mengubah data. Mengembalikan { run, reset, status, error, result }.
 * `fn` boleh berubah di setiap render (selalu memakai versi terbaru); runner dan kuncinya stabil.
 */
export function useAction<R>(fn: (ctx: ActionContext) => Promise<R>, o: UseActionOptions = {}) {
  const [state, setState] = useState<ActionState<R>>({
    status: "idle",
    error: null,
    result: undefined,
  });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const runner = useRef<ReturnType<typeof createActionRunner<R>> | null>(null);
  if (runner.current === null) {
    runner.current = createActionRunner<R>((ctx) => fnRef.current(ctx), {
      timeoutMs: o.timeoutMs ?? REQUEST_TIMEOUT_MS,
      onChange: (s) => {
        if (mounted.current) setState(s);
      },
    });
  }

  const run = useCallback(() => runner.current?.run() ?? Promise.resolve(undefined), []);
  const reset = useCallback(() => runner.current?.reset(), []);
  return { run, reset, ...state };
}
