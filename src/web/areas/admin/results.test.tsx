// @vitest-environment jsdom
import type { AdminEventView, AdminResultsView } from "@shared/api-types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copy } from "../../lib/copy";
import { ResultsCard } from "./components/ResultsCard";
import { buildCsvContent } from "./csv-export";

const R = copy.admin.results;

beforeEach(() => {
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

const event = (over: Partial<AdminEventView> = {}): AdminEventView =>
  ({
    id: "ev1",
    name: "Expo",
    timezone: "Asia/Jakarta",
    ratingsMode: "visible",
    rankingMode: "visible",
    resultsPublishedAt: null,
    state: { phase: "live" },
    ...over,
  }) as unknown as AdminEventView;

const VIEW = (over: Partial<AdminResultsView> = {}): AdminResultsView => ({
  published: false,
  publishedAt: null,
  version: 0,
  revealSeq: 0,
  live: [
    {
      boothId: "a",
      rank: 1,
      name: "Kopi Rempah",
      boothNo: null,
      coverThumbKey: null,
      average: 4.7,
      reviewCount: 24,
      score: 4.5,
      topCategories: [],
    },
  ],
  frozen: null,
  differs: false,
  ...over,
});

interface Call {
  method: string;
  path: string;
  body: Record<string, unknown> | undefined;
  headers: Record<string, string>;
}
function server(view: AdminResultsView) {
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
      return new Response(JSON.stringify(c.method === "GET" ? view : { ok: true, booths: 1 }), {
        status: 200,
      });
    }),
  );
  return calls;
}
const mount = (e: AdminEventView) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ResultsCard event={e} />
    </QueryClientProvider>,
  );

describe("Admin: hasil dan tampilan", () => {
  it("menampilkan peringkat terkini; 'Umumkan hasil' mati sebelum event selesai", async () => {
    server(VIEW());
    mount(event());
    expect(await screen.findByText("Kopi Rempah")).toBeTruthy();
    expect((screen.getByRole("button", { name: R.publish }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.getByText(R.notEnded)).toBeTruthy();
  });

  it("mode rating: simpan mengirim mode + kunci idempotensi; tombol mati bila tidak berubah", async () => {
    const calls = server(VIEW());
    mount(event());
    await screen.findByText("Kopi Rempah");
    const save = screen.getAllByRole("button", {
      name: copy.admin.common.save,
    })[0] as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(R.ratingsMode), { target: { value: "hidden" } });
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    await waitFor(() => expect(calls.some((c) => c.method === "PUT")).toBe(true));
    const put = calls.find((c) => c.method === "PUT");
    expect(put?.path).toBe("/api/admin/events/ev1/ratings-mode");
    expect(put?.body).toEqual({ mode: "hidden" });
    expect(put?.headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("rating tersembunyi: pilihan peringkat 'Tampil' dinonaktifkan dengan penjelasan (aturan juga ditegakkan server)", async () => {
    server(VIEW());
    mount(event({ ratingsMode: "hidden", rankingMode: "hidden" }));
    await screen.findByText("Kopi Rempah");
    expect(screen.getByText(R.rankingNeedsRatings)).toBeTruthy();
    const visible = within(screen.getByLabelText(R.rankingMode)).getByRole("option", {
      name: R.modes.visible,
    }) as HTMLOptionElement;
    expect(visible.disabled).toBe(true);
  });

  it("setelah event selesai: umumkan → konfirmasi → POST publish-results dengan kunci", async () => {
    const calls = server(VIEW());
    mount(event({ state: { phase: "ended" } } as Partial<AdminEventView>));
    await screen.findByText("Kopi Rempah");
    fireEvent.click(screen.getByRole("button", { name: R.publish }));
    const dialog = await screen.findByRole("dialog", { hidden: true });
    expect(dialog.textContent).toContain(R.publishConfirm);
    fireEvent.click(within(dialog).getByRole("button", { name: R.publish }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
    const post = calls.find((c) => c.method === "POST");
    expect(post?.path).toBe("/api/admin/events/ev1/publish-results");
    expect(post?.headers["Idempotency-Key"]).toBeTruthy();
  });

  it("sudah diumumkan: peringatan 'berbeda' + Perbarui hasil; animasi dengan pilihan target", async () => {
    const calls = server(VIEW({ published: true, differs: true, version: 1 }));
    mount(
      event({
        state: { phase: "ended" },
        resultsPublishedAt: 1_000_000,
      } as Partial<AdminEventView>),
    );
    expect(await screen.findByText(R.differs)).toBeTruthy();
    expect(screen.queryByRole("button", { name: R.publish })).toBeNull();

    fireEvent.change(screen.getByLabelText(R.revealTarget), { target: { value: "everyone" } });
    fireEvent.click(screen.getByRole("button", { name: R.reveal }));
    const dialog = await screen.findByRole("dialog", { hidden: true });
    fireEvent.click(within(dialog).getByRole("button", { name: R.reveal }));
    await waitFor(() => expect(calls.some((c) => c.path.endsWith("/reveal"))).toBe(true));
    expect(calls.find((c) => c.path.endsWith("/reveal"))?.body).toEqual({ target: "everyone" });
  });

  it("tanpa booth: pesan kosong", async () => {
    server(VIEW({ live: [] }));
    mount(event());
    expect(await screen.findByText(R.none)).toBeTruthy();
    expect((screen.getByRole("button", { name: R.exportCsv }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("ekspor hasil CSV mengunduh daftar hasil dan melindungi sel berawalan rumus", async () => {
    server(
      VIEW({
        live: [
          {
            boothId: "a",
            rank: 1,
            name: "=CMD()",
            boothNo: "A1",
            coverThumbKey: null,
            average: 4.7,
            reviewCount: 24,
            score: 4.5,
            topCategories: [{ label: "Enak", count: 3 }],
          },
        ],
      }),
    );
    const createUrl = vi.fn(() => "blob:hasil");
    const revokeUrl = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: createUrl, revokeObjectURL: revokeUrl });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    mount(event());
    expect(await screen.findByText("=CMD()")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: R.exportCsv }));
    expect(createUrl).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeUrl).toHaveBeenCalledWith("blob:hasil");
    click.mockRestore();

    const csv = buildCsvContent(["rank", "name"], [[1, "=CMD()"]]);
    expect(csv.startsWith("\uFEFFrank,name")).toBe(true);
    expect(csv).toContain("1,'=CMD()");
  });
});
