// Tombol "Masuk dengan Google" (Google Identity Services). Hanya dimuat bila event punya `googleClientId`.
// Browser menerima ID token (credential); keabsahannya diperiksa di server (B7), bukan di sini.

import { useEffect, useRef } from "react";
import { loadScript } from "./load-script";

interface GoogleAccounts {
  id: {
    initialize(o: { client_id: string; callback: (r: { credential: string }) => void }): void;
    renderButton(
      el: HTMLElement,
      o: { type: "standard"; theme: "outline"; size: "large"; text: "signin_with"; width: number },
    ): void;
  };
}
declare global {
  interface Window {
    google?: { accounts: GoogleAccounts };
  }
}

export function GoogleButton({
  clientId,
  onCredential,
}: {
  clientId: string;
  onCredential: (credential: string) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const cb = useRef(onCredential);
  cb.current = onCredential;

  useEffect(() => {
    let cancelled = false;
    loadScript("https://accounts.google.com/gsi/client")
      .then(() => {
        const el = ref.current;
        const g = window.google?.accounts.id;
        if (cancelled || !el || !g) return;
        g.initialize({ client_id: clientId, callback: (r) => cb.current(r.credential) });
        g.renderButton(el, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "signin_with",
          width: Math.min(320, el.clientWidth || 320),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return <div ref={ref} className="min-h-11" />;
}
