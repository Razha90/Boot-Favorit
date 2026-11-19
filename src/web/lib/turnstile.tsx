// Widget Cloudflare Turnstile (explore.md A6, B9). Tanpa `siteKey` (dev lokal) tidak ada widget dan token tidak
// diperlukan; server yang memutuskan (gagal tertutup di produksi). Token sekali pakai: panggil `reset()` setelah dipakai.

import { useCallback, useEffect, useRef, useState } from "react";
import { loadScript } from "./load-script";

interface TurnstileApi {
  render(
    el: HTMLElement,
    o: {
      sitekey: string;
      appearance?: "always" | "execute" | "interaction-only";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ): string;
  reset(id: string): void;
  remove(id: string): void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export function useTurnstile(siteKey: string | null) {
  const ref = useRef<HTMLDivElement | null>(null);
  const widget = useRef<string | null>(null);
  const [token, setToken] = useState<string | undefined>();

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    loadScript(SRC)
      .then(() => {
        const el = ref.current;
        if (cancelled || !el || !window.turnstile) return;
        widget.current = window.turnstile.render(el, {
          sitekey: siteKey,
          appearance: "interaction-only", // tak terlihat kecuali perlu tantangan
          callback: setToken,
          "expired-callback": () => setToken(undefined),
          "error-callback": () => setToken(undefined),
        });
      })
      .catch(() => setToken(undefined));
    return () => {
      cancelled = true;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [siteKey]);

  const reset = useCallback(() => {
    setToken(undefined);
    if (widget.current) window.turnstile?.reset(widget.current);
  }, []);

  return { ref, token, reset, required: siteKey !== null };
}

export type TurnstileState = ReturnType<typeof useTurnstile>;
