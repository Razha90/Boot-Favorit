// @vitest-environment jsdom
import type { BoothMe, BoothSelfView, BoothStatsView, PublicReviews } from "@shared/api-types";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QrCode } from "../../components/shared/QrCode";
import { copy } from "../../lib/copy";
import { makeEvent, renderEvent, SCHEDULE } from "../../test/render";
import { Component as Portal } from "./pages/portal";
import { Component as Register } from "./pages/register";

const T = copy.booth;

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const BOOTH = (over: Partial<BoothSelfView> = {}): BoothSelfView => ({
  id: "b1",
  name: "Kopi Rempah",
  boothNo: "A12",
  tagline: "Hangat",
  description: "Kopi dengan rempah",
  about: null,
  teamName: null,
  status: "approved",
  rejectReason: null,
  isLate: false,
  createdBy: "self",
  logoKey: null,
  coverThumbKey: null,
  photoCount: 0,
  productCount: 0,
  whatsapp: null,
  completeness: "partial",
  version: 100,
  ...over,
});

const STATS = (over: Partial<BoothStatsView> = {}): BoothStatsView => ({
  ratingsVisible: true,
  reviewCount: 3,
  average: 4.3,
  distribution: [0, 0, 1, 0, 2],
  rank: 2,
  rankedCount: 5,
  ...over,
});

const REVIEWS: PublicReviews = {
  reviews: [
    {
      id: "r1",
      stars: 5,
      text: "Kopinya enak sekali",
      displayName: "Rina",
      categories: [],
      createdAt: 3500,
    },
  ],
  next: null,
};

interface Call {
  method: string;
  path: string;
  body: Record<string, unknown> | undefined;
  headers: Record<string, string>;
}

/** Server palsu: `session` menentukan jawaban /api/booth/me; sisanya jawaban ringkas yang cukup untuk UI. */
function server(
  session: { me: BoothMe | null } | { error: string },
  extra: Record<string, unknown> = {},
) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const path = String(input);
      const method = init?.method ?? "GET";
      calls.push({
        method,
        path,
        body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined,
        headers: (init?.headers ?? {}) as Record<string, string>,
      });
      const json = (b: unknown, status = 200) =>
        new Response(JSON.stringify(b), {
          status,
          headers: { "content-type": "application/json" },
        });
      if (path === "/api/booth/me" && method === "GET") {
        if ("error" in session) return json({ code: session.error }, 401);
        return json({ me: session.me, turnstileSiteKey: null });
      }
      if (path.startsWith("/api/booth/reviews")) return json(REVIEWS);
      if (path.endsWith("/photos") || path.endsWith("/products")) {
        return json(path.endsWith("/photos") ? { photos: [] } : { products: [] });
      }
      if (path === "/api/booth/otp/request") return json({ ok: true, devCode: "123456" });
      if (path in extra) return json(extra[path]);
      return json({ ok: true });
    }),
  );
  return calls;
}

const me = (b: Partial<BoothSelfView> = {}, s: Partial<BoothStatsView> = {}): BoothMe => ({
  booth: BOOTH(b),
  stats: STATS(s),
});

describe("portal: masuk", () => {
  it("belum bersesi → form masuk (email), tanpa bagian portal", async () => {
    server({ me: null });
    renderEvent(<Portal />, { route: "/booth" });
    expect(await screen.findByRole("heading", { name: T.login.title })).toBeTruthy();
    expect(screen.getByLabelText(T.otp.email)).toBeTruthy();
    expect(screen.queryByText(T.profile.title)).toBeNull();
    // pendaftaran reguler dibuka di jam 3500? (susulan diterima) → tautan daftar tersedia
    expect(screen.getByRole("link", { name: T.login.registerLink })).toBeTruthy();
  });

  it("pemilik diubah admin (owner_changed) → form masuk dengan penjelasan", async () => {
    server({ error: "owner_changed" });
    renderEvent(<Portal />, { route: "/booth" });
    expect((await screen.findByRole("alert")).textContent).toBe(T.login.ownerChanged);
    expect(screen.getByLabelText(T.otp.email)).toBeTruthy();
  });

  it("alur OTP: minta kode → kode terisi (dev) → verifikasi memanggil server dengan tujuan login", async () => {
    const calls = server({ me: null });
    renderEvent(<Portal />, { route: "/booth" });
    fireEvent.change(await screen.findByLabelText(T.otp.email), { target: { value: "a@b.id" } });
    fireEvent.click(screen.getByRole("button", { name: T.otp.sendCode }));
    expect(await screen.findByDisplayValue("123456")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: T.otp.verify }));
    await waitFor(() => expect(calls.some((c) => c.path === "/api/booth/otp/verify")).toBe(true));
    expect(calls.find((c) => c.path === "/api/booth/otp/request")?.body).toMatchObject({
      email: "a@b.id",
      purpose: "login",
    });
    expect(calls.find((c) => c.path === "/api/booth/otp/verify")?.body).toEqual({
      email: "a@b.id",
      purpose: "login",
      code: "123456",
    });
  });
});

describe("portal: bagian-bagian", () => {
  it("booth tayang: ringkasan, ulasan, profil, produk, WhatsApp, bagikan + QR", async () => {
    server({ me: me() });
    renderEvent(<Portal />, { route: "/booth" });
    expect(await screen.findByRole("heading", { level: 1, name: "Kopi Rempah" })).toBeTruthy();
    for (const title of [
      T.stats.title,
      T.reviews.title,
      T.profile.title,
      T.whatsapp.title,
      T.share.title,
    ]) {
      expect(await screen.findByRole("heading", { name: title })).toBeTruthy();
    }
    expect(screen.getByText(T.stats.rank(2, 5))).toBeTruthy();
    expect(screen.getByRole("img", { name: T.share.qrLabel })).toBeTruthy();
    expect(screen.getByText(T.status.approved.title)).toBeTruthy();
  });

  it("ulasan: hanya bisa DILAPORKAN; tidak ada tombol hapus/sembunyikan", async () => {
    server({ me: me() });
    renderEvent(<Portal />, { route: "/booth" });
    expect(await screen.findByText("Kopinya enak sekali")).toBeTruthy();
    const names = screen.getAllByRole("button").map((b) => b.textContent ?? "");
    expect(names.some((n) => /hapus|sembunyi|hide|delete/i.test(n) && n !== "Hapus nomor")).toBe(
      false,
    );
    expect(screen.getByRole("button", { name: T.reviews.report })).toBeTruthy();
  });

  it("melaporkan ulasan: dialog → kirim → POST dengan kunci idempotensi dan alasan", async () => {
    const calls = server({ me: me() }, {});
    renderEvent(<Portal />, { route: "/booth" });
    fireEvent.click(await screen.findByRole("button", { name: T.reviews.report }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(T.reviews.reportReason), {
      target: { value: "profanity" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: T.reviews.send }));
    await waitFor(() =>
      expect(calls.some((c) => c.path === "/api/booth/reviews/r1/report")).toBe(true),
    );
    const call = calls.find((c) => c.path === "/api/booth/reviews/r1/report");
    expect(call?.body).toEqual({ reason: "profanity" });
    expect(call?.headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("rating disembunyikan panitia: tidak ada angka, hanya penjelasan", async () => {
    server({
      me: {
        booth: BOOTH(),
        stats: {
          ratingsVisible: false,
          reviewCount: null,
          average: null,
          distribution: null,
          rank: null,
          rankedCount: null,
        },
      },
    });
    renderEvent(<Portal />, { route: "/booth" });
    expect(await screen.findByText(T.stats.hidden)).toBeTruthy();
    expect(screen.queryByText(T.stats.distribution(5))).toBeNull();
  });

  it("belum ada ulasan: keadaan kosong yang jelas", async () => {
    server({
      me: me({}, { reviewCount: 0, average: null, distribution: [0, 0, 0, 0, 0], rank: null }),
    });
    renderEvent(<Portal />, { route: "/booth" });
    expect(await screen.findByText(T.stats.empty)).toBeTruthy();
  });
});

describe("portal: status booth", () => {
  it("pending: menunggu verifikasi, tanpa tombol kirim ulang", async () => {
    server({ me: me({ status: "pending" }) });
    renderEvent(<Portal />, { route: "/booth" });
    expect(await screen.findByText(T.status.pending.title)).toBeTruthy();
    expect(screen.queryByRole("button", { name: T.status.resubmit })).toBeNull();
  });

  it("revisi: catatan panitia tampil; kirim ulang memanggil server", async () => {
    const calls = server({ me: me({ status: "revision", rejectReason: "Tambahkan foto" }) });
    renderEvent(<Portal />, { route: "/booth" });
    expect(await screen.findByText("Tambahkan foto")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: T.status.resubmit }));
    await waitFor(() => expect(calls.some((c) => c.path === "/api/booth/resubmit")).toBe(true));
    expect(calls.find((c) => c.path === "/api/booth/resubmit")?.method).toBe("POST");
  });

  for (const status of ["rejected", "suspended"] as const) {
    it(`${status}: alasan tampil, isian profil dikunci, tombol simpan nonaktif`, async () => {
      server({ me: me({ status, rejectReason: "Tidak sesuai tema" }) });
      renderEvent(<Portal />, { route: "/booth" });
      expect(await screen.findByText("Tidak sesuai tema")).toBeTruthy();
      expect(
        (screen.getByLabelText(T.fields.name) as HTMLInputElement).closest("fieldset")?.disabled,
      ).toBe(true);
      expect(screen.queryByRole("button", { name: T.status.resubmit })).toBeNull();
    });
  }

  it("susulan: ditandai", async () => {
    server({ me: me({ status: "pending", isLate: true }) });
    renderEvent(<Portal />, { route: "/booth" });
    expect(await screen.findByText(T.status.late)).toBeTruthy();
  });
});

describe("portal: profil", () => {
  it("menyimpan: PUT /api/booth/me berisi isian, dengan kunci idempotensi", async () => {
    const calls = server({ me: me() });
    renderEvent(<Portal />, { route: "/booth" });
    const name = await screen.findByLabelText(T.fields.name);
    fireEvent.change(name, { target: { value: "Kopi Rempah Baru" } });
    fireEvent.click(screen.getByRole("button", { name: T.profile.save }));
    await waitFor(() =>
      expect(calls.some((c) => c.method === "PUT" && c.path === "/api/booth/me")).toBe(true),
    );
    const put = calls.find((c) => c.method === "PUT" && c.path === "/api/booth/me");
    expect(put?.body).toMatchObject({ name: "Kopi Rempah Baru", boothNo: "A12" });
    expect(put?.headers["Idempotency-Key"]).toBeTruthy();
  });

  it("tombol simpan nonaktif bila nama kosong atau tidak ada perubahan", async () => {
    server({ me: me() });
    renderEvent(<Portal />, { route: "/booth" });
    const save = await screen.findByRole("button", { name: T.profile.save });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(T.fields.name), { target: { value: "  " } });
    expect((save as HTMLButtonElement).disabled).toBe(true);
  });

  it("isian yang belum tersimpan disimpan sebagai draf, dan dipulihkan saat portal dibuka lagi (B7)", async () => {
    server({ me: me() });
    const first = renderEvent(<Portal />, { route: "/booth" });
    fireEvent.change(await screen.findByLabelText(T.fields.tagline), {
      target: { value: "Draf belum tersimpan" },
    });
    await waitFor(() =>
      expect(localStorage.getItem("boothDraft:b1")).toContain("Draf belum tersimpan"),
    );
    first.unmount();

    server({ me: me() });
    renderEvent(<Portal />, { route: "/booth" });
    expect(((await screen.findByLabelText(T.fields.tagline)) as HTMLInputElement).value).toBe(
      "Draf belum tersimpan",
    );
  });
});

describe("portal: event selesai (hanya-baca, B17)", () => {
  it("banner hanya-baca; isian profil, WhatsApp, produk, dan foto dikunci", async () => {
    server({ me: me() });
    renderEvent(<Portal />, { route: "/booth", serverNow: 5000 });
    expect(await screen.findByText(copy.readOnly.banner)).toBeTruthy();
    for (const label of [T.fields.name, T.whatsapp.number]) {
      const input = screen.getByLabelText(label) as HTMLInputElement;
      expect(input.matches(":disabled"), label).toBe(true);
    }
  });
});

describe("pendaftaran booth", () => {
  const closed = makeEvent({
    schedule: { ...SCHEDULE, allowLateRegistration: false, registrationCloseAt: 2000 },
  });

  it("event berlangsung + susulan diizinkan: formulir dengan catatan susulan", async () => {
    server({ me: null });
    renderEvent(<Register />, { route: "/register", serverNow: 3500 });
    expect(await screen.findByText(T.register.lateNotice)).toBeTruthy();
    expect(screen.getByLabelText(T.otp.email)).toBeTruthy();
  });

  it("reguler dibuka: tanpa catatan susulan", async () => {
    server({ me: null });
    renderEvent(<Register />, { route: "/register", serverNow: 1500 });
    expect(await screen.findByLabelText(T.otp.email)).toBeTruthy();
    expect(screen.queryByText(T.register.lateNotice)).toBeNull();
  });

  it("ditutup dan susulan dimatikan: pesan ditutup, tanpa formulir", () => {
    renderEvent(<Register />, { route: "/register", serverNow: 2500, event: closed });
    expect(screen.getByText(T.register.closedTitle)).toBeTruthy();
    expect(screen.queryByLabelText(T.otp.email)).toBeNull();
  });

  it("belum dibuka: pesan belum dibuka", () => {
    renderEvent(<Register />, { route: "/register", serverNow: 500 });
    expect(screen.getByText(T.register.notYetTitle)).toBeTruthy();
  });

  it("event selesai: pendaftaran tidak dibuka lagi", () => {
    renderEvent(<Register />, { route: "/register", serverNow: 5000 });
    expect(screen.getByText(T.register.endedTitle)).toBeTruthy();
    expect(screen.queryByLabelText(T.otp.email)).toBeNull();
  });

  it("alur penuh: email → kode → profil (hanya nama wajib) → kirim", async () => {
    const calls = server({ me: null });
    renderEvent(<Register />, { route: "/register", serverNow: 1500 });
    fireEvent.change(await screen.findByLabelText(T.otp.email), { target: { value: "baru@c.id" } });
    fireEvent.click(screen.getByRole("button", { name: T.otp.sendCode }));
    await screen.findByDisplayValue("123456");
    expect(screen.queryByLabelText(T.fields.name)).toBeNull(); // profil baru muncul setelah email terverifikasi
    fireEvent.click(screen.getByRole("button", { name: T.otp.verify }));

    const name = await screen.findByLabelText(T.fields.name);
    const submit = screen.getByRole("button", { name: T.register.submit }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true); // nama kosong
    fireEvent.change(name, { target: { value: "Batik Nusa" } });
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);

    await waitFor(() => expect(calls.some((c) => c.path === "/api/booth/register")).toBe(true));
    const reg = calls.find((c) => c.path === "/api/booth/register");
    expect(reg?.body).toMatchObject({ email: "baru@c.id", name: "Batik Nusa" });
    expect(reg?.headers["Idempotency-Key"]).toBeTruthy();
    expect(calls.find((c) => c.path === "/api/booth/otp/verify")?.body).toMatchObject({
      purpose: "register",
    });
  });
});

describe("QrCode", () => {
  it("SVG berlabel; isi berubah sesuai nilai; warna dari token (bukan nilai mentah)", () => {
    const a = renderEvent(<QrCode value="https://x.id/b/1" label="QR booth" />);
    const svgA = screen.getByRole("img", { name: "QR booth" });
    const pathA = svgA.querySelector("path")?.getAttribute("d");
    expect(pathA && pathA.length > 20).toBe(true);
    expect(svgA.getAttribute("class")).toContain("bg-qr-bg");
    a.unmount();
    renderEvent(<QrCode value="https://x.id/b/2" label="QR booth" />);
    const pathB = screen
      .getByRole("img", { name: "QR booth" })
      .querySelector("path")
      ?.getAttribute("d");
    expect(pathB).not.toBe(pathA);
  });
});
