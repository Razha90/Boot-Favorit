import { describe, expect, it, vi } from "vitest";
import { buildLogSql, toLogEntry } from "../../lib/analytics-logs";
import { directVisitor, liveHarness } from "../../test/visitor";

const AE_ENV = {
  CF_ACCOUNT_ID: "acc123",
  CF_API_TOKEN: "token-rahasia",
} as unknown as Partial<Env>;

const fakeAe = (rows: Record<string, unknown>[] = [], status = 200) =>
  vi.fn(
    async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ data: rows }), { status }),
  ) as unknown as typeof fetch & ReturnType<typeof vi.fn>;

const call = (c: Awaited<ReturnType<typeof liveHarness>>, qs = "", env: Partial<Env> = AE_ENV) =>
  c.h.call("GET", `/api/admin/e/${c.s.event.id}/logs${qs}`, undefined, { extraEnv: env });

describe("buildLogSql", () => {
  const base = { eventId: "abc-123", range: "1d" as const };

  it("memuat batas waktu, event, urutan, dan LIMIT tetap", () => {
    const sql = buildLogSql(base);
    expect(sql).toContain("FROM booth_favorit_logs");
    expect(sql).toContain("index1 = 'abc-123'");
    expect(sql).toContain("timestamp > NOW() - INTERVAL '1' DAY");
    expect(sql).toContain("ORDER BY timestamp DESC LIMIT 200");
  });

  it("filter ditambahkan sebagai kondisi", () => {
    const sql = buildLogSql({
      ...base,
      range: "7d",
      category: "admin",
      level: "warn",
      action: "admin.review_edited",
      actor: "abc123",
      target: "t-1",
    });
    for (const part of [
      "INTERVAL '7' DAY",
      "blob1 = 'admin'",
      "blob3 = 'warn'",
      "blob2 = 'admin.review_edited'",
      "blob5 = 'abc123'",
      "blob7 = 't-1'",
    ]) {
      expect(sql).toContain(part);
    }
  });

  it("nilai berbahaya (kutip, titik koma, spasi) ditolak, tidak pernah disambung ke SQL", () => {
    for (const evil of ["x' OR '1'='1", "a;DROP TABLE x", "a b", "a--b'", "`x`"]) {
      expect(() => buildLogSql({ ...base, eventId: evil }), evil).toThrow();
      expect(() => buildLogSql({ ...base, actor: evil }), evil).toThrow();
    }
    expect(() => buildLogSql({ ...base, eventId: "" })).toThrow(); // id event kosong tidak sah
  });
});

describe("toLogEntry", () => {
  it("memetakan kolom, waktu UTC AE, dan meta JSON (rusak/terpotong → null)", () => {
    const e = toLogEntry({
      timestamp: "2026-11-19 10:00:05",
      category: "admin",
      action: "admin.review_edited",
      level: "info",
      actor_type: "admin",
      actor_id: "abc",
      target_type: "review",
      target_id: "r1",
      msg: "alasan",
      meta: '{"field":"stars","before":5,"after":3}',
      request_id: "req1",
    });
    expect(e.at).toBe(Date.UTC(2026, 10, 19, 10, 0, 5));
    expect(e).toMatchObject({
      category: "admin",
      targetId: "r1",
      meta: { field: "stars", before: 5, after: 3 },
    });
    expect(toLogEntry({ meta: '{"terpotong":' }).meta).toBeNull();
    expect(toLogEntry({ meta: "{}" }).meta).toBeNull();
  });
});

describe("GET /api/admin/e/:id/logs", () => {
  it("AE belum diatur (mis. dev lokal): configured:false, tanpa memanggil siapa pun", async () => {
    const fetcher = fakeAe();
    const c = await liveHarness({ logFetcher: fetcher });
    const r = await call(c, "", {});
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ configured: false, entries: [] });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("memanggil SQL API dengan token read-only di header dan SQL berisi id event; hasil dipetakan", async () => {
    const fetcher = fakeAe([
      {
        timestamp: "2026-11-19 10:00:05",
        category: "booth",
        action: "booth.approved",
        level: "info",
        actor_type: "admin",
        actor_id: "a1",
        target_type: "booth",
        target_id: "b1",
        msg: "",
        meta: "{}",
        request_id: "r",
      },
    ]);
    const c = await liveHarness({ logFetcher: fetcher });
    const r = await call(c, "?range=7d&category=booth&level=info");
    expect(r.status).toBe(200);
    expect(r.json.configured).toBe(true);
    expect(r.json.entries[0]).toMatchObject({ action: "booth.approved", targetId: "b1" });
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.cloudflare.com/client/v4/accounts/acc123/analytics_engine/sql");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer token-rahasia");
    expect(String(init.body)).toContain(`index1 = '${c.s.event.id}'`);
    expect(String(init.body)).toContain("blob1 = 'booth'");
    expect(r.res.headers.get("cache-control")).toContain("max-age=10");
  });

  it("filter di luar whitelist atau berisi karakter berbahaya: 400 dan AE tidak dipanggil", async () => {
    const fetcher = fakeAe();
    const c = await liveHarness({ logFetcher: fetcher });
    for (const qs of [
      "?category=rahasia",
      "?level=fatal",
      "?range=1y",
      "?action=hapus.semua",
      `?actor=${encodeURIComponent("a' OR 1=1")}`,
      `?target=${encodeURIComponent("x;y")}`,
    ]) {
      expect((await call(c, qs)).status, qs).toBe(400);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("event tidak ada: 404 (id tidak pernah sampai ke SQL)", async () => {
    const fetcher = fakeAe();
    const c = await liveHarness({ logFetcher: fetcher });
    const r = await c.h.call("GET", "/api/admin/e/x'%20OR%201=1/logs", undefined, {
      extraEnv: AE_ENV,
    });
    expect([400, 404]).toContain(r.status);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("AE gagal: 500 tanpa membocorkan isi galat penyedia atau token", async () => {
    const fetcher = fakeAe([], 403);
    const c = await liveHarness({ logFetcher: fetcher });
    const r = await call(c);
    expect(r.status).toBe(500);
    expect(JSON.stringify(r.json)).not.toContain("token-rahasia");
  });

  it("hanya admin: tanpa Access di produksi → 401", async () => {
    const c = await liveHarness();
    const r = await c.h.call("GET", `/api/admin/e/${c.s.event.id}/logs`, undefined, {
      extraEnv: { APP_ENV: "production", DEV_ADMIN_EMAIL: "" } as unknown as Partial<Env>,
    });
    expect(r.status).toBe(401);
  });
});

describe("GET /api/admin/e/:id/health", () => {
  it("mengembalikan ringkasan kesehatan event (WebSocket, review/menit, ditahan, laporan, pending booth)", async () => {
    const c = await liveHarness();
    const v = await directVisitor(c.h, c.s.event.id);
    const rev = await v.call("POST", `/api/booths/${c.s.lengkap.id}/review`, {
      stars: 5,
      comment: "Mantap sekali",
    });
    expect(rev.status).toBe(201);
    const r = await c.h.call("GET", `/api/admin/e/${c.s.event.id}/health`);
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({
      liveViewers: 0,
      liveScreens: 0,
      totalReviews: 1,
      reviewsLastMinute: 1,
      reviewsLastHour: 1,
      heldReviews: 0,
      openReports: 0,
      pendingBooths: 1,
    });
  });
});
