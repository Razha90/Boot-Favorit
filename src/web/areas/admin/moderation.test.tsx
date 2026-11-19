// @vitest-environment jsdom
import type {
  AdminModerationQueue,
  AdminReportGroup,
  AdminReview,
  AdminTerm,
} from "@shared/api-types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../components/ui/Toast";
import { copy } from "../../lib/copy";
import { Component as ModerationPage } from "./pages/moderation";

const M = copy.admin.moderation;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const REVIEW = (over: Partial<AdminReview> = {}): AdminReview => ({
  id: "r1",
  boothId: "b1",
  boothName: "Kopi Rempah",
  anonymous: false,
  visitorId: "v1",
  displayName: "Budi",
  stars: 1,
  comment: "dasar bangsat",
  commentStatus: "held",
  commentMasked: null,
  status: "visible",
  filterHits: 1,
  commentLocked: false,
  riskScore: 5,
  flags: ["filter_hit"],
  originalStars: null,
  originalComment: null,
  moderationReason: null,
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

const GROUP = (over: Partial<AdminReportGroup> = {}): AdminReportGroup => ({
  review: REVIEW({ commentStatus: "visible", comment: "Mengecewakan" }),
  reports: [
    {
      id: "rep1",
      reviewId: "r1",
      reporterRole: "visitor",
      reason: "hate",
      note: "SARA",
      status: "open",
      createdAt: 1,
    },
    {
      id: "rep2",
      reviewId: "r1",
      reporterRole: "visitor",
      reason: "spam",
      note: null,
      status: "open",
      createdAt: 2,
    },
  ],
  priority: 0,
  suspiciousReporter: false,
  ...over,
});

const TERM = (over: Partial<AdminTerm> = {}): AdminTerm => ({
  id: "t1",
  term: "anjir",
  lang: "id",
  severity: "mild",
  kind: "block",
  match: "word",
  enabled: true,
  source: "starter",
  ...over,
});

interface Call {
  method: string;
  path: string;
  body: Record<string, unknown> | undefined;
  headers: Record<string, string>;
}

function server(
  o: { queue?: AdminModerationQueue; terms?: AdminTerm[]; reviews?: AdminReview[] } = {},
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
      if (c.path.endsWith("/moderation/queue")) return json(o.queue ?? { reports: [], held: [] });
      if (c.path.includes("/moderation/terms")) {
        return json({ terms: o.terms ?? [] });
      }
      if (c.path.includes("/moderation/test")) {
        return json({ status: "masked", masked: "p***h", contact: false, matched: ["payah"] });
      }
      if (c.path.includes("/reviews") && c.method === "GET")
        return json({ reviews: o.reviews ?? [] });
      return json({ review: REVIEW() });
    }),
  );
  return calls;
}

function mount(tab?: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const r = render(
    <MemoryRouter initialEntries={["/admin/e/ev1/moderation"]}>
      <QueryClientProvider client={client}>
        <ToastProvider>
          <Routes>
            <Route path="/admin/e/:id/moderation" element={<ModerationPage />} />
          </Routes>
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  if (tab) fireEvent.click(screen.getByRole("tab", { name: new RegExp(tab) }));
  return r;
}

describe("Moderasi admin: antrean", () => {
  it("kosong: pesan 'tidak ada laporan'", async () => {
    server();
    mount();
    expect(await screen.findByText(M.emptyQueue)).toBeTruthy();
  });

  it("menampilkan teks asli, jumlah laporan, alasan, catatan; badge hitungan di tab", async () => {
    server({ queue: { reports: [GROUP()], held: [] } });
    const { container } = mount();
    expect(await screen.findByText("Mengecewakan")).toBeTruthy();
    expect(container.textContent).toContain(M.reports(2));
    expect(container.textContent).toContain(M.reasons.hate);
    expect(container.textContent).toContain("SARA");
    expect(screen.getByRole("tab", { name: /Antrean laporan \(1\)/ })).toBeTruthy();
  });

  it("pelaporan mencurigakan ditandai", async () => {
    server({ queue: { reports: [GROUP({ suspiciousReporter: true })], held: [] } });
    mount();
    expect(await screen.findByText(M.suspicious)).toBeTruthy();
  });

  it("aksi mati sampai alasan ≥ 5 huruf; keputusan mengirim alasan + kunci idempotensi, lalu memuat ulang", async () => {
    const calls = server({ queue: { reports: [GROUP()], held: [] } });
    mount();
    const hide = await screen.findByRole("button", { name: M.actions.hideComment });
    expect((hide as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(M.reason), { target: { value: "abc" } });
    expect((hide as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(M.reason), { target: { value: "mengandung SARA" } });
    expect((hide as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(hide);

    await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
    const post = calls.find((c) => c.method === "POST");
    expect(post?.path).toBe("/api/admin/e/ev1/moderation/reports/rep1");
    expect(post?.body).toEqual({
      decision: "upheld",
      action: "hide_comment",
      lock: false,
      reason: "mengandung SARA",
    });
    expect(post?.headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
    // setelah keputusan antrean dimuat ulang
    await waitFor(() =>
      expect(calls.filter((c) => c.path.endsWith("/moderation/queue")).length).toBeGreaterThan(1),
    );
  });

  it("'Biarkan dan kunci' mengirim dismissed + lock", async () => {
    const calls = server({ queue: { reports: [GROUP()], held: [] } });
    mount();
    fireEvent.change(await screen.findByLabelText(M.reason), {
      target: { value: "tidak melanggar" },
    });
    fireEvent.click(screen.getByRole("button", { name: M.actions.keepLock }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
    expect(calls.find((c) => c.method === "POST")?.body).toMatchObject({
      decision: "dismissed",
      action: "none",
      lock: true,
    });
  });
});

describe("Moderasi admin: ditahan dan semua ulasan", () => {
  it("komentar ditahan: teks asli dan sinyal risiko terlihat; 'Setujui' memanggil restore", async () => {
    const calls = server({ queue: { reports: [], held: [REVIEW()] } });
    const { container } = mount("Ditahan");
    expect(await screen.findByText("dasar bangsat")).toBeTruthy();
    expect(container.textContent).toContain(M.risk(5, "filter_hit"));
    fireEvent.change(screen.getByLabelText(M.reason), { target: { value: "wajar saja" } });
    fireEvent.click(screen.getByRole("button", { name: M.actions.restore }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
    const post = calls.find((c) => c.method === "POST");
    expect(post?.path).toBe("/api/admin/e/ev1/reviews/r1/restore");
    expect(post?.body).toEqual({ reason: "wajar saja" });
  });

  it("ditahan kosong: pesan kosong", async () => {
    server();
    mount("Ditahan");
    expect(await screen.findByText(M.emptyHeld)).toBeTruthy();
  });

  it("semua ulasan: hapus permanen mengirim alasan lewat query dan kunci", async () => {
    const calls = server({ reviews: [REVIEW({ status: "visible", commentStatus: "visible" })] });
    mount("Semua ulasan");
    fireEvent.change(await screen.findByLabelText(M.reason), { target: { value: "spam jelas" } });
    fireEvent.click(screen.getByRole("button", { name: M.actions.delete }));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE")).toBe(true));
    const del = calls.find((c) => c.method === "DELETE");
    expect(del?.path).toBe("/api/admin/e/ev1/reviews/r1?reason=spam%20jelas");
    expect(del?.headers["Idempotency-Key"]).toBeTruthy();
  });

  it("ulasan tersembunyi: aksi utama menjadi 'pulihkan'", async () => {
    server({ reviews: [REVIEW({ status: "hidden", commentStatus: "visible" })] });
    mount("Semua ulasan");
    expect(await screen.findByRole("button", { name: M.actions.restore })).toBeTruthy();
    expect(screen.queryByRole("button", { name: M.actions.hideReview })).toBeNull();
  });
});

describe("Moderasi admin: daftar kata", () => {
  it("menampilkan istilah dengan tingkat; tambah istilah butuh alasan dan mengirim isian", async () => {
    const calls = server({ terms: [TERM(), TERM({ id: "t2", term: "petai", kind: "allow" })] });
    mount("Daftar kata");
    expect(await screen.findByText("anjir")).toBeTruthy();
    expect(screen.getByText("petai")).toBeTruthy();

    const add = screen.getByRole("button", {
      name: copy.admin.moderation.terms.add,
    }) as HTMLButtonElement;
    fireEvent.change(screen.getByLabelText(copy.admin.moderation.terms.term), {
      target: { value: "payah" },
    });
    expect(add.disabled).toBe(true); // alasan belum diisi
    fireEvent.change(screen.getAllByLabelText(M.reason)[0] as HTMLElement, {
      target: { value: "sering menghina" },
    });
    expect(add.disabled).toBe(false);
    fireEvent.click(add);
    await waitFor(() => expect(calls.some((c) => c.method === "PUT")).toBe(true));
    const put = calls.find((c) => c.method === "PUT");
    expect(put?.body).toEqual({
      terms: [
        {
          term: "payah",
          severity: "mild",
          kind: "block",
          match: "word",
          enabled: true,
          lang: "id",
        },
      ],
      reason: "sering menghina",
    });
    expect(put?.headers["Idempotency-Key"]).toBeTruthy();
  });

  it("'uji kalimat' menampilkan hasil dan istilah yang tertangkap", async () => {
    server({ terms: [TERM()] });
    mount("Daftar kata");
    fireEvent.change(await screen.findByLabelText(copy.admin.moderation.terms.test), {
      target: { value: "tempat ini payah" },
    });
    fireEvent.click(screen.getByRole("button", { name: copy.admin.moderation.terms.testButton }));
    expect(await screen.findByText(copy.admin.moderation.terms.result.masked)).toBeTruthy();
    expect(screen.getByText(/Tertangkap: payah/)).toBeTruthy();
  });
});
