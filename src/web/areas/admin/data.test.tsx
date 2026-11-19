// @vitest-environment jsdom
import type { AdminBoothView, AdminEventView, LogsResponse } from "@shared/api-types";
import type { BulkEditResponse, GridPage } from "@shared/data-grid";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../components/ui/Toast";
import { copy } from "../../lib/copy";
import { Component as DataPage } from "./pages/data";
import { Component as LogsPage } from "./pages/logs";
import { Component as PostersPage } from "./pages/posters";

const D = copy.admin.data;
const L = copy.admin.logs;
const P = copy.admin.posters;

beforeEach(() => {
  localStorage.clear();
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const EVENT = {
  id: "ev1",
  slug: "expo-2026",
  name: "LPPM Expo 2026",
  titleHighlight: null,
  timezone: "Asia/Jakarta",
  visibility: "published",
  isActive: true,
  hiddenFromPublic: false,
  schedule: {
    registrationOpenAt: null,
    registrationCloseAt: 2_000_000,
    eventStartAt: 3_000_000,
    eventEndAt: 4_000_000,
    resultsPublishedAt: null,
    allowLateRegistration: true,
  },
  settings: { maxProducts: 24, allowLateRegistration: true, reviewerAuthMode: "google_or_email" },
  ratingsMode: "visible",
  rankingMode: "visible",
  resultsPublishedAt: null,
  versions: { active: 1, stats: 1, results: 0 },
  state: { phase: "live" },
  warnings: [],
  updatedAt: 1000,
} as unknown as AdminEventView;

const BOOTHS_PAGE: GridPage = {
  rows: [
    {
      id: "b1",
      version: 100,
      values: {
        boothNo: "A1",
        name: "Kopi Rempah",
        email: null,
        owner: "none",
        completeness: "partial",
        status: "approved",
        isLate: false,
        createdBy: "admin",
        tagline: "Hangat",
        description: null,
        rejectReason: null,
        approvedBy: "admin@test",
        createdAt: 1_700_000_000_000,
        reviewCount: 4,
        average: 4.5,
        score: 4.1,
        rank: 1,
      },
    },
    {
      id: "b2",
      version: 101,
      values: {
        boothNo: "B2",
        name: "Teh Tarik",
        email: "teh@example.com",
        owner: "invited",
        completeness: "name_only",
        status: "pending",
        isLate: false,
        createdBy: "self",
        tagline: null,
        description: null,
        rejectReason: null,
        approvedBy: null,
        createdAt: 1_700_000_100_000,
        reviewCount: 3,
        average: 4.0,
        score: 3.9,
        rank: 2,
      },
    },
  ],
  next: "cursor-2",
  summary: { total: 3, avgStars: null, byStatus: { approved: 2, pending: 1 } },
};

const RANKING_PAGE: GridPage = {
  rows: [
    {
      id: "b1",
      version: 100,
      values: {
        rank: 1,
        name: "Kopi Rempah",
        boothNo: "A1",
        average: 4.5,
        reviewCount: 4,
        score: 4.1,
        gap: null,
      },
    },
    {
      id: "b2",
      version: 101,
      values: {
        rank: 2,
        name: "Teh Tarik",
        boothNo: "B2",
        average: 4.2,
        reviewCount: 3,
        score: 3.9,
        gap: 0.2,
      },
    },
  ],
  next: null,
  summary: { total: 2, avgStars: null, byStatus: {} },
};

const REVIEWS_PAGE: GridPage = {
  rows: [
    {
      id: "r1",
      version: 200,
      meta: { boothId: "b1" },
      values: {
        boothName: "Kopi Rempah",
        visitorName: "Budi",
        provider: "google",
        visitorHash: "abc12345",
        stars: 5,
        comment: "Mantap",
        status: "visible",
        commentStatus: "visible",
        riskScore: 0,
        flags: "",
        ipHash: "ip123456",
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
        moderatedBy: "mod@test",
        moderatedAt: 1_700_000_050_000,
        moderationReason: "Koreksi",
        originalStars: 4,
        originalComment: "Mantap!",
      },
    },
  ],
  next: null,
  summary: { total: 1, avgStars: 5, byStatus: { visible: 1 } },
};

interface Call {
  method: string;
  path: string;
  body: Record<string, unknown> | undefined;
  headers: Record<string, string>;
}

function mockServer(
  opts: {
    bulkResponse?: BulkEditResponse;
    logsResponse?: LogsResponse;
    approvedBooths?: Partial<AdminBoothView>[];
  } = {},
) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const c: Call = {
        method: init?.method ?? "GET",
        path: String(input),
        body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined,
        headers: (init?.headers ?? {}) as Record<string, string>,
      };
      calls.push(c);
      const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });

      if (c.path === "/api/admin/events/ev1") return json({ event: EVENT });
      if (c.path.startsWith("/api/admin/e/ev1/data/booths")) {
        if (c.path.includes("cursor=cursor-2")) {
          return json({
            rows: [
              {
                ...BOOTHS_PAGE.rows[0],
                id: "b3",
                values: { ...BOOTHS_PAGE.rows[0]?.values, name: "Booth Halaman 2" },
              },
            ],
            next: null,
            summary: BOOTHS_PAGE.summary,
          });
        }
        return json(BOOTHS_PAGE);
      }
      if (c.path.startsWith("/api/admin/e/ev1/data/ranking")) return json(RANKING_PAGE);
      if (c.path.startsWith("/api/admin/e/ev1/data/reviews")) return json(REVIEWS_PAGE);
      if (c.path === "/api/admin/e/ev1/data/bulk" && c.method === "PATCH") {
        return json(opts.bulkResponse ?? { applied: 1, results: [{ index: 0, status: "ok" }] });
      }
      if (c.path.startsWith("/api/admin/e/ev1/data/")) {
        return json({ rows: [], next: null, summary: { total: 0, avgStars: null, byStatus: {} } });
      }
      if (c.path === "/api/admin/e/ev1/booths" && c.method === "POST") {
        return json({ booth: { id: "b9", name: c.body?.name } });
      }
      if (c.path.startsWith("/api/admin/e/ev1/booths")) {
        return json({ booths: opts.approvedBooths ?? [] });
      }
      if (c.path.startsWith("/api/admin/e/ev1/logs")) {
        return json(opts.logsResponse ?? { configured: false, entries: [] });
      }
      if (c.path === "/api/admin/e/ev1/health") {
        return json({
          liveViewers: 12,
          liveScreens: 1,
          maxLiveViewers: 400,
          reviewsLastMinute: 3,
          reviewsLastHour: 20,
          totalReviews: 45,
          heldReviews: 2,
          openReports: 1,
          pendingBooths: 0,
          measuredAt: 1_700_000_000_000,
        });
      }
      return json({ ok: true });
    }),
  );
  return calls;
}

function mountRoute(initialPath: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <QueryClientProvider client={client}>
        <ToastProvider>
          <Routes>
            <Route path="/admin/e/:id/data" element={<DataPage />} />
            <Route path="/admin/e/:id/logs" element={<LogsPage />} />
            <Route path="/admin/e/:id/posters" element={<PostersPage />} />
          </Routes>
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("Data Grid admin", () => {
  it("merender tab Booth, footer ringkasan, paginasi kursor, tautan Riwayat, dan ekspor CSV", async () => {
    const calls = mockServer();
    mountRoute("/admin/e/ev1/data");

    expect(await screen.findByText("Kopi Rempah")).toBeTruthy();
    expect(screen.getByText(D.summary.total(3))).toBeTruthy();
    expect(screen.getAllByRole("link", { name: D.history })[0]?.getAttribute("href")).toBe(
      "/admin/e/ev1/logs?target=b1",
    );

    const exportLink = screen.getByRole("link", { name: D.exportCsv });
    expect(exportLink.getAttribute("href")).toBe("/api/admin/e/ev1/data/booths/export");

    fireEvent.click(screen.getByRole("button", { name: D.loadMore }));
    expect(await screen.findByText("Booth Halaman 2")).toBeTruthy();
    expect(calls.some((c) => c.path.includes("cursor=cursor-2"))).toBe(true);
  });

  it("sunting sel dengan dblklik + Esc membatalkan; simpan review menampilkan pratinjau dampak peringkat & menangani konflik", async () => {
    const calls = mockServer({
      bulkResponse: {
        applied: 1,
        results: [
          { index: 0, status: "ok" },
          { index: 1, status: "conflict", code: "version_conflict" },
        ],
      },
    });
    mountRoute("/admin/e/ev1/data?tab=reviews");

    expect(await screen.findByText("Mantap")).toBeTruthy();
    // Penanda disunting admin ada di baris review
    expect(screen.getAllByText(new RegExp(D.editedBadge)).length).toBeGreaterThan(0);

    // Dblklik komentar lalu Esc = tidak ada perubahan tertunda
    const commentCell = screen.getByText("Mantap").closest("td") as HTMLElement;
    fireEvent.doubleClick(screen.getByText("Mantap").closest("button") as HTMLElement);
    const ta = within(commentCell).getByRole("textbox");
    fireEvent.change(ta, { target: { value: "Batal" } });
    fireEvent.keyDown(ta, { key: "Escape" });
    expect(screen.queryByText(D.pendingBar(1))).toBeNull();

    // Sunting bintang review dari 5 → 1 (berdampak pada peringkat Kopi Rempah #1 → #2)
    const starsCell = screen.getByText("★ 5").closest("td") as HTMLElement;
    fireEvent.doubleClick(screen.getByText("★ 5").closest("button") as HTMLElement);
    fireEvent.click(within(starsCell).getByRole("radio", { name: copy.visitor.stars(1) }));
    expect(await screen.findByText(D.pendingBar(1))).toBeTruthy();

    // Tambah suntingan komentar agar ada 2 perubahan (satu ok, satu conflict)
    fireEvent.doubleClick(screen.getByText("Mantap").closest("button") as HTMLElement);
    const ta2 = within(commentCell).getByRole("textbox");
    fireEvent.change(ta2, { target: { value: "Kurang cocok" } });
    fireEvent.keyDown(ta2, { key: "Enter" });
    expect(await screen.findByText(D.pendingBar(2))).toBeTruthy();

    // Buka dialog Simpan → verifikasi pratinjau dampak peringkat
    fireEvent.click(screen.getByRole("button", { name: D.saveChanges }));
    const dialog = await screen.findByRole("dialog", { hidden: true });
    expect(dialog.textContent).toContain("Kopi Rempah: #1 → #2");

    const confirmBtn = within(dialog).getByRole("button", {
      name: D.dialog.confirm,
    }) as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);

    fireEvent.change(within(dialog).getByLabelText(D.dialog.reason), {
      target: { value: "Audit ulasan selesai" },
    });
    expect(confirmBtn.disabled).toBe(false);
    fireEvent.click(confirmBtn);

    await waitFor(() =>
      expect(calls.some((c) => c.path === "/api/admin/e/ev1/data/bulk")).toBe(true),
    );
    const bulkCall = calls.find((c) => c.path === "/api/admin/e/ev1/data/bulk");
    expect(bulkCall?.headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);

    // Perubahan 0 (ok) hilang; perubahan 1 (conflict) tetap tertunda dengan pesan konflik
    expect(await screen.findByText(D.pendingBar(1))).toBeTruthy();
    expect(screen.getAllByText(copy.errors.version_conflict).length).toBeGreaterThan(0);
  });

  it("aksi massal pada baris terpilih membuat suntingan tertunda & '+ Booth' langsung membuat booth", async () => {
    const calls = mockServer();
    mountRoute("/admin/e/ev1/data");

    expect(await screen.findByText("Teh Tarik")).toBeTruthy();
    fireEvent.click(screen.getByLabelText(D.selectRow("Teh Tarik")));
    fireEvent.click(screen.getByRole("button", { name: D.bulkActions.approve }));
    expect(screen.getByText(D.pendingBar(1))).toBeTruthy();
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);

    // + Booth
    fireEvent.click(screen.getByRole("button", { name: D.addBooth }));
    fireEvent.change(screen.getByLabelText(D.addBooth), { target: { value: "Booth Instan" } });
    fireEvent.click(screen.getByRole("button", { name: D.addBoothSubmit }));
    await waitFor(() =>
      expect(calls.some((c) => c.path === "/api/admin/e/ev1/booths" && c.method === "POST")).toBe(
        true,
      ),
    );
    const post = calls.find((c) => c.path === "/api/admin/e/ev1/booths" && c.method === "POST");
    expect(post?.body).toEqual({ name: "Booth Instan" });
    expect(post?.headers["Idempotency-Key"]).toBeTruthy();
  });

  it("pilihan kerapatan & kolom tersimpan di localStorage; tab bisa diganti", async () => {
    const calls = mockServer();
    mountRoute("/admin/e/ev1/data");
    expect(await screen.findByText("Kopi Rempah")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: new RegExp(D.density) }));
    expect(localStorage.getItem("adminGrid:density")).toBe("compact");

    fireEvent.click(screen.getByRole("tab", { name: D.tabs.ranking }));
    await waitFor(() =>
      expect(calls.some((c) => c.path.startsWith("/api/admin/e/ev1/data/ranking"))).toBe(true),
    );
  });
});

describe("Halaman Log & Poster QR", () => {
  it("halaman Log menampilkan pemberitahuan bila Analytics Engine belum terkonfigurasi", async () => {
    mockServer({ logsResponse: { configured: false, entries: [] } });
    mountRoute("/admin/e/ev1/logs?target=b1");
    expect(await screen.findByText(L.notConfigured)).toBeTruthy();
    expect(await screen.findByText(L.health.title)).toBeTruthy();
    expect(screen.getByText("12/400")).toBeTruthy();
    expect((screen.getByLabelText(L.target) as HTMLInputElement).value).toBe("b1");
  });

  it("halaman Log merender entri dan mendukung filter kategori/level", async () => {
    const calls = mockServer({
      logsResponse: {
        configured: true,
        entries: [
          {
            at: 1_700_000_000_000,
            category: "admin",
            action: "admin.booth_edited",
            level: "info",
            actorType: "admin",
            actorId: "adm1",
            targetType: "booth",
            targetId: "b1",
            msg: "Ubah nama",
            meta: { field: "name" },
            requestId: "req1",
          },
        ],
      },
    });
    mountRoute("/admin/e/ev1/logs");
    expect(await screen.findByText("Ubah nama")).toBeTruthy();
    expect(within(screen.getByRole("table")).getByText("admin.booth_edited")).toBeTruthy();

    fireEvent.change(screen.getByLabelText(L.category), { target: { value: "admin" } });
    await waitFor(() => expect(calls.some((c) => c.path.includes("category=admin"))).toBe(true));
  });

  it("halaman Poster QR: poster QR utama event + booth tayang + pendaftaran, semua dengan QR berlabel", async () => {
    mockServer({
      approvedBooths: [
        {
          id: "b1",
          name: "Kopi Rempah",
          boothNo: "A1",
          tagline: "Hangat",
          teamName: "Fakultas Teknik",
        },
      ],
    });
    const { container } = mountRoute("/admin/e/ev1/posters");
    expect(await screen.findByText("Kopi Rempah")).toBeTruthy();
    expect(screen.getByLabelText(P.eventQrLabel)).toBeTruthy();
    expect(screen.getByLabelText(P.qrLabel("Kopi Rempah"))).toBeTruthy();
    expect(screen.getByLabelText(P.scanToRegister)).toBeTruthy();
    expect(
      [...container.querySelectorAll("article[data-poster]")].map((a) =>
        a.getAttribute("data-poster"),
      ),
    ).toEqual(["event", "booth", "register"]); // QR utama event paling depan
    expect(container.textContent).toContain("Fakultas Teknik");
    expect(container.textContent).toContain("Booth A1");
  });

  it("QR utama event memakai alamat situs; alamat diganti dipakai, yang tidak sah kembali ke alamat situs", async () => {
    mockServer({ approvedBooths: [] });
    const { container } = mountRoute("/admin/e/ev1/posters");
    await screen.findByLabelText(P.eventQrLabel);
    const qr = () => screen.getByLabelText(P.eventQrLabel).querySelector("path")?.getAttribute("d");
    const initial = qr();
    fireEvent.change(screen.getByLabelText(P.eventUrlLabel), {
      target: { value: "https://eventunimed.id/" },
    });
    expect(qr()).not.toBe(initial);
    expect(container.textContent).toContain("eventunimed.id");
    fireEvent.change(screen.getByLabelText(P.eventUrlLabel), { target: { value: "bukan url" } });
    expect(qr()).toBe(initial); // kembali ke alamat situs
    fireEvent.change(screen.getByLabelText(P.eventUrlLabel), {
      target: { value: "javascript:alert(1)" },
    });
    expect(qr()).toBe(initial);
  });

  it("opsi poster event/pendaftaran dapat dimatikan; ukuran A5 mengubah bentuk poster", async () => {
    mockServer({ approvedBooths: [{ id: "b1", name: "Kopi", boothNo: null }] });
    const { container } = mountRoute("/admin/e/ev1/posters");
    await screen.findByLabelText(P.qrLabel("Kopi"));
    fireEvent.click(screen.getByLabelText(P.includeEvent));
    fireEvent.click(screen.getByLabelText(P.includeRegister));
    expect(container.querySelectorAll("article[data-poster]")).toHaveLength(1);
    fireEvent.change(screen.getByLabelText(P.sizeLabel), { target: { value: "a5" } });
    expect(container.querySelector("article[data-poster]")?.className).toContain(
      "aspect-[148/210]",
    );
  });

  it("Cetak membuka lapisan cetak berukuran kertas terpilih dan memanggil window.print; hanya poster yang tercetak", async () => {
    const print = vi.fn();
    window.print = print;
    mockServer({ approvedBooths: [{ id: "b1", name: "Kopi", boothNo: "A1" }] });
    mountRoute("/admin/e/ev1/posters");
    await screen.findByLabelText(P.qrLabel("Kopi"));
    fireEvent.change(screen.getByLabelText(P.sizeLabel), { target: { value: "a5" } });
    fireEvent.click(screen.getByRole("button", { name: P.print }));
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    const layer = document.body.querySelector(".poster-print-root");
    expect(layer?.querySelector("style")?.textContent).toContain("size: a5 portrait");
    expect(layer?.querySelectorAll("article[data-poster]")).toHaveLength(3);
    expect(document.body.classList.contains("poster-printing")).toBe(true);
    window.dispatchEvent(new Event("afterprint"));
    await waitFor(() => expect(document.body.querySelector(".poster-print-root")).toBeNull());
    expect(document.body.classList.contains("poster-printing")).toBe(false);
  });
});
