// Klien realtime (explore.md B8). Polling snapshot tetap dasar; WebSocket hanya ditambahkan untuk yang butuh live.
// Hemat: terputus saat tab tersembunyi, tersambung lagi saat kembali; backoff berjitter; tanpa WebSocket (atau penuh/gagal)
// polling jalan sendiri. Kode ini hanya diimpor oleh area `event` dan `screen` (B16).

import type { PublicSnapshot } from "@shared/api-types";
import type { LiveMessage } from "@shared/live-core";
import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { applyTick } from "./apply-tick";

const PING_MS = 30_000;
const MAX_BACKOFF_MS = 30_000;

export interface LiveState {
  connected: boolean;
  /** Ulasan baru yang tidak muat di feed ("+N ulasan baru") sejak terakhir direset */
  more: number;
  resetMore: () => void;
  /** Peringkat 1 berpindah ke booth ini (toast "X naik ke peringkat 1"); `nonce` berbeda tiap kejadian */
  leader: { boothId: string; nonce: number } | null;
}

export const OFFLINE: LiveState = { connected: false, more: 0, resetMore: () => {}, leader: null };

/** Backoff eksponensial berjitter ±20% (klien tidak menyambung serentak setelah gangguan). */
export function backoffMs(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt);
  return Math.round(base * (0.8 + random() * 0.4));
}

function patchSnapshots(qc: QueryClient, msg: Extract<LiveMessage, { t: "tick" }>): void {
  qc.setQueriesData<PublicSnapshot>({ queryKey: ["public", "snapshot"] }, (old) =>
    old ? applyTick(old, msg) : old,
  );
}

export function useLive(o: { enabled: boolean; screen?: boolean }): LiveState {
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [more, setMore] = useState(0);
  const [leader, setLeader] = useState<LiveState["leader"]>(null);
  const resetMore = useCallback(() => setMore(0), []);
  const nonce = useRef(0);

  useEffect(() => {
    if (!o.enabled || typeof WebSocket === "undefined") return;
    let ws: WebSocket | null = null;
    let retry = 0;
    let reconnect: ReturnType<typeof setTimeout> | null = null;
    let ping: ReturnType<typeof setInterval> | null = null;
    let stopped = false; // event selesai atau efek dibersihkan: jangan menyambung lagi

    const clearTimers = () => {
      if (reconnect) clearTimeout(reconnect);
      if (ping) clearInterval(ping);
      reconnect = null;
      ping = null;
    };
    const close = () => {
      clearTimers();
      const w = ws;
      ws = null;
      if (w) {
        w.onclose = null;
        w.onmessage = null;
        w.onerror = null;
        try {
          w.close();
        } catch {
          // sudah tertutup
        }
      }
      setConnected(false);
    };

    const scheduleReconnect = () => {
      if (stopped || document.visibilityState === "hidden") return;
      reconnect = setTimeout(connect, backoffMs(retry++));
    };

    function onMessage(e: MessageEvent) {
      if (typeof e.data !== "string" || e.data === "pong") return;
      let msg: LiveMessage;
      try {
        msg = JSON.parse(e.data) as LiveMessage;
      } catch {
        return;
      }
      if (msg.t === "hello") {
        retry = 0;
        setConnected(true);
        // Snapshot bisa tertinggal selama koneksi putus: ambil sekali setelah tersambung.
        void qc.invalidateQueries({ queryKey: ["public", "snapshot"] });
      } else if (msg.t === "tick") {
        patchSnapshots(qc, msg);
        if (msg.more > 0) setMore((n) => n + msg.more);
        if (msg.leaderChanged && msg.leader) {
          setLeader({ boothId: msg.leader, nonce: ++nonce.current });
        }
      } else if (msg.t === "refresh") {
        // Admin mengubah sesuatu: kunci cache sudah berganti, jadi pengambilan ulang langsung segar.
        void qc.invalidateQueries({ queryKey: ["public"] });
        setMore(0);
      } else if (msg.t === "event_status") {
        stopped = true; // event selesai: siaran berhenti, polling jarang mengambil alih
        close();
        void qc.invalidateQueries({ queryKey: ["public"] });
      }
    }

    function connect() {
      if (stopped || ws || document.visibilityState === "hidden") return;
      const proto = location.protocol === "https:" ? "wss" : "ws";
      let sock: WebSocket;
      try {
        sock = new WebSocket(`${proto}://${location.host}/ws${o.screen ? "?screen=1" : ""}`);
      } catch {
        scheduleReconnect();
        return;
      }
      ws = sock;
      sock.onmessage = onMessage;
      sock.onopen = () => {
        ping = setInterval(() => {
          if (sock.readyState === WebSocket.OPEN) sock.send("ping");
        }, PING_MS);
      };
      sock.onclose = () => {
        ws = null;
        clearTimers();
        setConnected(false);
        scheduleReconnect(); // penuh/gagal: polling berjalan selama belum tersambung
      };
      sock.onerror = () => sock.close();
    }

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        close(); // tab tersembunyi = putuskan koneksi (B8 butir 6)
      } else if (!stopped && !ws) {
        retry = 0;
        connect();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    connect();

    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisibility);
      close();
    };
  }, [o.enabled, o.screen, qc]);

  return { connected, more, resetMore, leader };
}
