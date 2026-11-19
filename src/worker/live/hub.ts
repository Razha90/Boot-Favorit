// LiveHub: satu Durable Object per event (explore.md B8). Hanya klien yang butuh live (dashboard terbuka, Layar Besar)
// yang menyambung WebSocket; pengunjung yang hanya menilai tidak membuka koneksi apa pun.
//
// Hemat: (1) review hanya menandai "kotor" dan memasang alarm; (2) alarm tiap `tickMs` membaca D1 SEKALI lalu
// menyiarkan SATU pesan delta (`LiveCore`); (3) WebSocket Hibernation + auto-response ping/pong: DO tidak terbangun
// hanya untuk keep-alive; (4) tanpa penonton, alarm tidak membaca D1 sama sekali.
// Kondisi DO (`LiveCore`) hanya ada di memori dan dibangun ulang dari D1 pada tick berikutnya setelah evict.

import { DurableObject } from "cloudflare:workers";
import { CONFIG } from "@shared/config";
import { LiveCore, type LiveMessage } from "@shared/live-core";
import { getDb } from "../lib/db";
import { loadLiveInput } from "../services/live";

export type LiveKind = "review" | "refresh";

/** Selang minimum antar siaran `refresh` (admin bisa menekan banyak tombol beruntun). */
const REFRESH_MIN_GAP_MS = 1000;

export class LiveHub extends DurableObject<Env> {
  private readonly core = new LiveCore({
    maxFeedItemsPerTick: CONFIG.live.maxFeedItemsPerTick,
    ranking: {
      priorWeight: CONFIG.ranking.bayesPriorWeight,
      minReviewsToRank: CONFIG.ranking.minReviewsToRank,
    },
  });
  private pending = 0;
  private refreshPending = false;
  private lastRefreshAt = 0;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  /** Dipanggil Worker setelah D1 sukses. Tidak melakukan apa pun yang mahal. `endAt` = akhir event (bisa berubah). */
  async ingest(eventId: string, kind: LiveKind, endAt: number): Promise<void> {
    await this.remember(eventId, endAt);
    if (this.ctx.getWebSockets().length === 0) return; // tanpa penonton: tidak ada yang disiarkan

    let wake = Date.now() + CONFIG.live.tickMs;
    if (kind === "review") {
      this.pending += 1;
    } else {
      // Aksi admin (mode, hasil, reveal) langsung disiarkan; beruntun dibatasi 1 per REFRESH_MIN_GAP_MS.
      const gap = Date.now() - this.lastRefreshAt;
      if (gap >= REFRESH_MIN_GAP_MS) {
        this.lastRefreshAt = Date.now();
        this.broadcast({ t: "refresh" });
      } else {
        this.refreshPending = true;
        wake = this.lastRefreshAt + REFRESH_MIN_GAP_MS + 50;
      }
    }
    // Alarm tick/refresh lebih dulu dari alarm akhir-event (yang jauh di depan).
    const cur = await this.ctx.storage.getAlarm();
    if (kind === "review" || this.refreshPending) {
      if (cur === null || cur > wake) await this.ctx.storage.setAlarm(wake);
    } else {
      await this.armEnd(); // jadwal mungkin berubah: pasang ulang alarm akhir-event
    }
  }

  private async remember(eventId: string, endAt: number): Promise<void> {
    await this.ctx.storage.put({ eventId, endAt });
  }

  /** Pasang alarm pada akhir event bila tidak ada alarm lain: koneksi ditutup tepat waktu walau tak ada review. */
  private async armEnd(): Promise<void> {
    const endAt = await this.ctx.storage.get<number>("endAt");
    if (!endAt || endAt <= Date.now()) return;
    const cur = await this.ctx.storage.getAlarm();
    // Tanpa alarm, atau alarm lama (jadwal berubah): arahkan ke akhir event yang TERBARU.
    if (cur === null || (cur > endAt + 500 && !this.refreshPending && this.pending === 0)) {
      await this.ctx.storage.setAlarm(endAt + 500);
    }
  }

  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }
    const eventId = request.headers.get("x-event-id");
    const endAt = Number(request.headers.get("x-event-end"));
    if (eventId && Number.isFinite(endAt)) await this.remember(eventId, endAt);
    const screen = request.headers.get("x-live-screen") === "1";

    // Batas penonton: Layar Besar punya slot yang dijamin (reservedScreenSlots); sisanya berbagi.
    const screens = this.ctx.getWebSockets("screen").length;
    const viewers = this.ctx.getWebSockets("viewer").length;
    const generalCap = CONFIG.live.maxLiveViewers - CONFIG.live.reservedScreenSlots;
    const full = screen
      ? screens >= CONFIG.live.reservedScreenSlots &&
        screens + viewers >= CONFIG.live.maxLiveViewers
      : viewers >= generalCap;
    if (full) {
      // Klien jatuh ke polling (degradasi halus), bukan galat.
      return new Response(JSON.stringify({ code: "rate_limited" }), {
        status: 503,
        headers: { "Content-Type": "application/json", "Retry-After": "30" },
      });
    }

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server, [screen ? "screen" : "viewer"]);
    server.send(JSON.stringify({ t: "hello", serverNow: Date.now() } satisfies LiveMessage));
    await this.armEnd();
    return new Response(null, { status: 101, webSocket: client });
  }

  override async alarm(): Promise<void> {
    const sockets = this.ctx.getWebSockets();
    const pending = this.pending;
    this.pending = 0;
    if (sockets.length === 0) return; // tidak membaca D1 untuk penonton yang tidak ada

    if (this.refreshPending && Date.now() - this.lastRefreshAt >= REFRESH_MIN_GAP_MS) {
      this.refreshPending = false;
      this.lastRefreshAt = Date.now();
      this.broadcast({ t: "refresh" });
    }

    // Event selesai (menurut jadwal yang diingat): siaran tick berhenti dan penonton biasa diputus (B8). Soket Layar
    // Besar TETAP terbuka: animasi pemenang diputar admin SETELAH event selesai dan harus sampai ke layar segera.
    const endAt = await this.ctx.storage.get<number>("endAt");
    if (endAt && Date.now() >= endAt) return this.endViewers();

    const eventId = await this.ctx.storage.get<string>("eventId");
    if (eventId && pending > 0) {
      const src = await loadLiveInput(getDb(this.env), eventId, pending, Date.now());
      if (src?.ended) return this.endViewers();
      const tick = src ? this.core.tick(src.live) : null;
      if (tick) this.broadcast(tick);
    }
    await this.armEnd();
  }

  private endViewers(): void {
    for (const ws of this.ctx.getWebSockets("viewer")) {
      try {
        ws.send(JSON.stringify({ t: "event_status", ended: true } satisfies LiveMessage));
      } catch {
        // sudah putus
      }
      this.close(ws, 1000, "event_ended");
    }
  }

  override webSocketClose(ws: WebSocket, code: number, reason: string): void {
    this.close(ws, code, reason);
  }

  override webSocketError(ws: WebSocket): void {
    this.close(ws, 1011, "error");
  }

  private close(ws: WebSocket, code: number, reason: string): void {
    try {
      // 1005/1006 tidak boleh dipakai saat menutup; ganti 1000.
      ws.close(code === 1005 || code === 1006 ? 1000 : code, reason);
    } catch {
      // sudah tertutup
    }
  }

  private broadcast(msg: LiveMessage): void {
    const data = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(data);
      } catch {
        // koneksi putus: dibersihkan oleh webSocketClose
      }
    }
  }
}
