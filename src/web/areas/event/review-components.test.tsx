// @vitest-environment jsdom
import type {
  PublicBoothDetail,
  PublicReview,
  ReviewSubmitResult,
  VisitorMe,
} from "@shared/api-types";
import { ApiError } from "@shared/errors";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BOOTHS } from "../../dev/fixtures";
import type { ActionContext } from "../../lib/action";
import { copy } from "../../lib/copy";
import { isEmpty, makeEvent, renderEvent } from "../../test/render";
import { EmailLogin } from "./components/EmailLogin";
import { LoginPanel } from "./components/LoginPanel";
import { ReportDialog } from "./components/ReportDialog";
import { ReviewFlow } from "./components/ReviewFlow";
import { ReviewForm, type ReviewValues } from "./components/ReviewForm";
import { ReviewItem } from "./components/ReviewItem";
import { ReviewsSection, TopCategories } from "./components/ReviewsSection";
import { ThankYou } from "./components/ThankYou";

const CATS = [
  { id: "c1", label: "Seru" },
  { id: "c2", label: "Ramah" },
  { id: "c3", label: "Rapi" },
  { id: "c4", label: "Kreatif" },
];
const event = () => makeEvent({ reviewCategories: CATS });
const live = { event: event(), serverNow: 3500 };
const ended = { event: event(), serverNow: 5000 };

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
  vi.restoreAllMocks();
});

// ---------- fetch palsu ----------
interface Call {
  method: string;
  path: string;
  body: Record<string, unknown> | undefined;
  headers: Record<string, string>;
}
type Reply = { status?: number; body: unknown } | undefined;

function stubApi(handler: (c: Call) => Reply) {
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
      const r = handler(c) ?? { status: 404, body: { code: "not_found" } };
      return new Response(JSON.stringify(r.body), { status: r.status ?? 200 });
    }),
  );
  return calls;
}

const ME = (over: Partial<VisitorMe> = {}): VisitorMe => ({
  visitor: null,
  authMode: "google_or_email",
  googleClientId: null,
  turnstileSiteKey: null,
  reviewed: [],
  ...over,
});
const VISITOR = { id: "v1", displayName: "Ani", provider: "email" as const };

const BOOTH: PublicBoothDetail = {
  ...BOOTHS.lengkap,
  about: null,
  teamName: null,
  photos: [],
  ratingsHidden: false,
  distribution: [0, 0, 0, 0, 0],
  hasWhatsapp: false,
  topCategories: [],
};

const RESULT: ReviewSubmitResult = {
  review: { boothId: BOOTH.id, stars: 5, comment: null, categoryIds: [], anonymous: false },
  created: true,
  commentHeld: false,
  progress: { reviewed: 1, total: 4 },
  suggestions: [
    { id: "b2", name: "Es Teh Pak Budi" },
    { id: "b3", name: "Mie Ayam Bu Tini" },
  ],
};

const REVIEW = (over: Partial<PublicReview> = {}): PublicReview => ({
  id: "r1",
  stars: 4,
  text: "Kopinya enak dan pelayanannya ramah.",
  displayName: "Budi",
  categories: [{ id: "c1", label: "Seru" }],
  createdAt: 1,
  ...over,
});

// ---------- ReviewForm ----------
describe("ReviewForm", () => {
  const setup = (over: Partial<Parameters<typeof ReviewForm>[0]> = {}) => {
    const submit = vi.fn(async (_values: ReviewValues, _ctx: ActionContext) => {});
    const r = renderEvent(<ReviewForm categories={CATS} submit={submit} {...over} />, live);
    return { submit, ...r };
  };
  const star = (n: number) =>
    fireEvent.click(screen.getByRole("radio", { name: copy.visitor.stars(n) }));
  const story = (text = "Seru banget") =>
    fireEvent.change(screen.getByRole("textbox"), { target: { value: text } });
  const send = () => fireEvent.click(screen.getByRole("button", { name: copy.event.form.submit }));

  const submitBtn = () =>
    screen.getByRole("button", { name: copy.event.form.submit }) as HTMLButtonElement;

  it("tombol kirim mati HANYA sampai bintang dipilih; komentar opsional", () => {
    setup();
    expect(submitBtn().disabled).toBe(true);
    expect(screen.getByText(copy.event.form.starsRequired)).toBeTruthy();
    star(4);
    expect(submitBtn().disabled).toBe(false); // tanpa komentar pun boleh
    expect(screen.queryByText(copy.event.form.starsRequired)).toBeNull();
  });

  it("bintang saja cukup: komentar kosong dikirim sebagai null, kunci idempotensi ikut", async () => {
    const { submit } = setup();
    star(5);
    send();
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    const [values, ctx] = submit.mock.calls[0] as unknown as [unknown, { key: string }];
    expect(values).toEqual({ stars: 5, comment: null, categoryIds: [], anonymous: false });
    expect(ctx.key).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("kategori maksimal 3; yang ke-4 diabaikan; bisa dilepas", () => {
    setup();
    for (const c of CATS) fireEvent.click(screen.getByRole("button", { name: c.label }));
    const pressed = () =>
      CATS.filter(
        (c) =>
          screen.getByRole("button", { name: c.label }).getAttribute("aria-pressed") === "true",
      ).map((c) => c.id);
    expect(pressed()).toEqual(["c1", "c2", "c3"]);
    fireEvent.click(screen.getByRole("button", { name: "Seru" }));
    expect(pressed()).toEqual(["c2", "c3"]);
  });

  it("komentar dipangkas spasi, penghitung huruf, dan batas 280", async () => {
    const { submit } = setup();
    const box = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(box.maxLength).toBe(280);
    fireEvent.change(box, { target: { value: "  Mantap!  " } });
    expect(screen.getByText("11/280")).toBeTruthy();
    star(3);
    fireEvent.click(screen.getByRole("button", { name: "Rapi" }));
    send();
    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(submit.mock.calls[0]?.[0]).toEqual({
      stars: 3,
      comment: "Mantap!",
      categoryIds: ["c3"],
      anonymous: false,
    });
  });

  it("tanpa kategori event: bagian kategori tidak dirender", () => {
    setup({ categories: [] });
    expect(screen.queryByText(copy.event.form.categories)).toBeNull();
  });

  it("pilihan anonim: tidak dicentang secara bawaan, ikut terkirim, dan terisi saat mengedit", async () => {
    const { submit } = setup();
    const box = screen.getByLabelText(copy.event.form.anonymous) as HTMLInputElement;
    expect(box.checked).toBe(false);
    star(5);
    story();
    fireEvent.click(box);
    send();
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0]?.[0].anonymous).toBe(true);
    cleanup();
    setup({
      initial: { boothId: "b", stars: 4, comment: "Oke", categoryIds: [], anonymous: true },
    });
    expect((screen.getByLabelText(copy.event.form.anonymous) as HTMLInputElement).checked).toBe(
      true,
    );
  });

  it("mengedit: isian terisi, label 'Perbarui', catatan boleh diubah", () => {
    setup({
      initial: { boothId: "b", stars: 4, comment: "Oke", categoryIds: ["c2"], anonymous: false },
    });
    expect(screen.getByText(copy.event.form.editing)).toBeTruthy();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Oke");
    expect(screen.getByRole("button", { name: "Ramah" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: copy.event.form.update })).toBeTruthy();
  });

  it("disabled (keamanan belum siap): tombol mati walau bintang sudah dipilih", () => {
    setup({ disabled: true });
    star(5);
    expect(
      (screen.getByRole("button", { name: copy.event.form.submit }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("galat server dipetakan ke teks Indonesia dan bisa dicoba lagi", async () => {
    const submit = vi.fn(async () => {
      throw new ApiError("own_booth");
    });
    renderEvent(<ReviewForm categories={CATS} submit={submit} />, live);
    star(5);
    story();
    send();
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", copy.errors.own_booth);
    expect(screen.getByRole("button", { name: copy.action.retry })).toBeTruthy();
  });
});

// ---------- ReviewItem, TopCategories, ThankYou ----------
describe("ReviewItem", () => {
  it("nama, bintang, teks, kategori; tombol lapor hanya bila disediakan", () => {
    const { container } = renderEvent(<ReviewItem review={REVIEW()} />, live);
    expect(container.textContent).toContain("Budi");
    expect(container.textContent).toContain("Kopinya enak");
    expect(container.querySelector("[role='img']")).not.toBeNull();
    expect(screen.queryByRole("button", { name: copy.event.reviews.report })).toBeNull();
  });

  it("review hanya berbintang: nama + bintang + keterangan 'Hanya memberi bintang', tanpa tombol lapor", () => {
    const onReport = vi.fn();
    const { container } = renderEvent(
      <ReviewItem review={REVIEW({ text: null, categories: [] })} onReport={onReport} />,
      live,
    );
    expect(container.textContent).toContain("Budi");
    expect(container.textContent).toContain(copy.event.reviews.starsOnly);
    expect(container.querySelector("[role='img']")).not.toBeNull();
    expect(screen.queryByRole("button", { name: copy.event.reviews.report })).toBeNull();
    expect(container.querySelectorAll("p:empty")).toHaveLength(0);
  });

  it("rating disembunyikan: tanpa bintang", () => {
    const { container } = renderEvent(<ReviewItem review={REVIEW({ stars: null })} />, live);
    expect(container.querySelector("[role='img']")).toBeNull();
  });

  it("teks di-escape (bukan HTML) dan tombol lapor memanggil callback", () => {
    const onReport = vi.fn();
    const { container } = renderEvent(
      <ReviewItem
        review={REVIEW({ text: "<img src=x onerror=alert(1)>", categories: [] })}
        onReport={onReport}
      />,
      live,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("<img src=x");
    fireEvent.click(screen.getByRole("button", { name: copy.event.reviews.report }));
    expect(onReport).toHaveBeenCalled();
  });
});

describe("TopCategories", () => {
  it("kosong: tidak dirender; berisi: 'Sering disebut: Seru (12) · Ramah (9)'", () => {
    expect(isEmpty(renderEvent(<TopCategories items={[]} />, live).container)).toBe(true);
    cleanup();
    const { container } = renderEvent(
      <TopCategories
        items={[
          { id: "c1", label: "Seru", count: 12 },
          { id: "c2", label: "Ramah", count: 9 },
        ]}
      />,
      live,
    );
    expect(container.textContent).toContain("Sering disebut: Seru (12) · Ramah (9)");
  });
});

describe("ThankYou", () => {
  it("terima kasih, kemajuan, saran booth lain (tautan), dan tombol ubah", () => {
    const onEdit = vi.fn();
    renderEvent(<ThankYou result={RESULT} onEdit={onEdit} />, live);
    expect(screen.getByText(copy.event.thanks.saved)).toBeTruthy();
    expect(screen.getByText(copy.event.thanks.progress(1, 4))).toBeTruthy();
    expect(screen.getByRole("link", { name: "Es Teh Pak Budi" }).getAttribute("href")).toBe(
      "/b/b2",
    );
    fireEvent.click(screen.getByRole("button", { name: copy.event.thanks.edit }));
    expect(onEdit).toHaveBeenCalled();
  });

  it("komentar ditahan: pesan netral tanpa menyebut kata; semua booth dinilai: ucapan selesai", () => {
    renderEvent(
      <ThankYou
        result={{
          ...RESULT,
          commentHeld: true,
          progress: { reviewed: 4, total: 4 },
          suggestions: [],
        }}
        onEdit={() => {}}
      />,
      live,
    );
    expect(screen.getByText(copy.event.thanks.held)).toBeTruthy();
    expect(screen.getByText(copy.event.thanks.allDone)).toBeTruthy();
    expect(screen.queryByText(copy.event.thanks.next)).toBeNull();
  });
});

// ---------- Masuk ----------
describe("LoginPanel", () => {
  const turnstile = (over = {}) => ({
    ref: { current: null },
    token: undefined,
    reset: vi.fn(),
    required: false,
    ...over,
  });

  it("google_or_email tanpa clientId: hanya email; dengan clientId: area tombol Google + pemisah", () => {
    renderEvent(<LoginPanel me={ME()} turnstile={turnstile()} onLoggedIn={() => {}} />, live);
    expect(screen.getByText(copy.event.login.email)).toBeTruthy();
    expect(screen.queryByText(copy.event.login.or)).toBeNull();
    cleanup();
    renderEvent(
      <LoginPanel
        me={ME({ googleClientId: "cid" })}
        turnstile={turnstile()}
        onLoggedIn={() => {}}
      />,
      live,
    );
    expect(screen.getByText(copy.event.login.or)).toBeTruthy();
  });
});

describe("EmailLogin (dua langkah)", () => {
  const ts = { ref: { current: null }, token: undefined, reset: vi.fn(), required: false };

  it("kirim kode → isi kode → masuk; kode dev terisi otomatis; token Turnstile ikut dikirim", async () => {
    const calls = stubApi((c) => {
      if (c.path === "/api/visitor/otp/request") return { body: { ok: true, devCode: "123456" } };
      if (c.path === "/api/visitor/otp/verify") return { body: { visitor: VISITOR } };
      return undefined;
    });
    const onLoggedIn = vi.fn();
    renderEvent(
      <EmailLogin turnstile={{ ...ts, token: "tok-1", required: true }} onLoggedIn={onLoggedIn} />,
      live,
    );

    const send = screen.getByRole("button", {
      name: copy.event.login.sendCode,
    }) as HTMLButtonElement;
    expect(send.disabled).toBe(true); // email belum diisi
    fireEvent.change(screen.getByLabelText(copy.event.login.email), {
      target: { value: "ani@contoh.id" },
    });
    fireEvent.click(send);

    expect(await screen.findByText(copy.event.login.codeSent("ani@contoh.id"))).toBeTruthy();
    expect(screen.getByText(copy.event.login.devCode("123456"))).toBeTruthy();
    expect((screen.getByLabelText(copy.event.login.code) as HTMLInputElement).value).toBe("123456");
    expect(calls[0]?.body).toEqual({ email: "ani@contoh.id", turnstileToken: "tok-1" });

    fireEvent.change(screen.getByLabelText(copy.event.login.name), { target: { value: "Ani" } });
    fireEvent.click(screen.getByRole("button", { name: copy.event.login.verify }));
    await waitFor(() => expect(onLoggedIn).toHaveBeenCalled());
    expect(calls[1]?.body).toEqual({ email: "ani@contoh.id", code: "123456", displayName: "Ani" });
  });

  it("kode hanya angka dan maksimal 6; tombol masuk mati sampai 6 digit; nama kosong = null", async () => {
    stubApi((c) =>
      c.path.endsWith("/request") ? { body: { ok: true } } : { body: { visitor: VISITOR } },
    );
    renderEvent(<EmailLogin turnstile={ts} onLoggedIn={() => {}} />, live);
    fireEvent.change(screen.getByLabelText(copy.event.login.email), {
      target: { value: "a@b.id" },
    });
    fireEvent.click(screen.getByRole("button", { name: copy.event.login.sendCode }));
    await screen.findByLabelText(copy.event.login.code);
    const code = screen.getByLabelText(copy.event.login.code) as HTMLInputElement;
    fireEvent.change(code, { target: { value: "12ab34" } });
    expect(code.value).toBe("1234");
    expect(
      (screen.getByRole("button", { name: copy.event.login.verify }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("kode salah: pesan Indonesia, bisa dicoba lagi", async () => {
    stubApi((c) =>
      c.path.endsWith("/request")
        ? { body: { ok: true } }
        : { status: 400, body: { code: "otp_invalid" } },
    );
    renderEvent(<EmailLogin turnstile={ts} onLoggedIn={() => {}} />, live);
    fireEvent.change(screen.getByLabelText(copy.event.login.email), {
      target: { value: "a@b.id" },
    });
    fireEvent.click(screen.getByRole("button", { name: copy.event.login.sendCode }));
    await screen.findByLabelText(copy.event.login.code);
    fireEvent.change(screen.getByLabelText(copy.event.login.code), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: copy.event.login.verify }));
    expect((await screen.findByRole("alert")).textContent).toBe(copy.errors.otp_invalid);
  });
});

// ---------- ReviewFlow: alur utuh ----------
describe("ReviewFlow", () => {
  function server(opts: { loggedIn?: boolean; mine?: unknown[]; submit?: Reply } = {}) {
    let loggedIn = opts.loggedIn ?? false;
    return stubApi((c) => {
      if (c.path === "/api/visitor/me") return { body: ME({ visitor: loggedIn ? VISITOR : null }) };
      if (c.path === "/api/me/reviews") return { body: { reviews: opts.mine ?? [] } };
      if (c.path === "/api/visitor/otp/request") return { body: { ok: true, devCode: "654321" } };
      if (c.path === "/api/visitor/otp/verify") {
        loggedIn = true;
        return { body: { visitor: VISITOR } };
      }
      if (c.path === `/api/booths/${BOOTH.id}/review`)
        return opts.submit ?? { status: 201, body: RESULT };
      return undefined;
    });
  }

  it("belum masuk: kotak masuk; setelah masuk lewat OTP: form penilaian muncul dengan nama", async () => {
    server();
    renderEvent(<ReviewFlow booth={BOOTH} />, live);
    expect(await screen.findByText(copy.event.login.title)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(copy.event.login.email), {
      target: { value: "ani@contoh.id" },
    });
    fireEvent.click(screen.getByRole("button", { name: copy.event.login.sendCode }));
    await screen.findByLabelText(copy.event.login.code);
    fireEvent.click(screen.getByRole("button", { name: copy.event.login.verify }));
    expect(await screen.findByText(copy.event.login.as("Ani"))).toBeTruthy();
    expect(screen.getByText(copy.event.form.stars)).toBeTruthy();
  });

  it("sudah masuk: isi form, kirim dengan Idempotency-Key, lalu layar terima kasih; 'Ubah' kembali ke form", async () => {
    const calls = server({ loggedIn: true });
    renderEvent(<ReviewFlow booth={BOOTH} />, live);
    await screen.findByText(copy.event.form.stars);
    fireEvent.click(screen.getByRole("radio", { name: copy.visitor.stars(5) }));
    fireEvent.click(screen.getByRole("button", { name: "Seru" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Mantap!" } });
    fireEvent.click(screen.getByRole("button", { name: copy.event.form.submit }));

    expect(await screen.findByText(copy.event.thanks.title)).toBeTruthy();
    const post = calls.find((c) => c.method === "POST" && c.path.endsWith("/review"));
    expect(post?.body).toEqual({
      stars: 5,
      comment: "Mantap!",
      categoryIds: ["c1"],
      anonymous: false,
      turnstileToken: undefined,
    });
    expect(post?.headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(screen.getByText(copy.event.thanks.progress(1, 4))).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: copy.event.thanks.edit }));
    expect(await screen.findByText(copy.event.form.stars)).toBeTruthy();
  });

  it("pernah menilai: form terisi dari /api/me/reviews dan berlabel 'Perbarui'", async () => {
    server({
      loggedIn: true,
      mine: [
        { boothId: BOOTH.id, stars: 4, comment: "Oke", categoryIds: ["c2"], anonymous: false },
      ],
    });
    renderEvent(<ReviewFlow booth={BOOTH} />, live);
    expect(await screen.findByRole("button", { name: copy.event.form.update })).toBeTruthy();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Oke");
  });

  it("booth sendiri: pesan 'nggak bisa menilai booth sendiri'", async () => {
    server({ loggedIn: true, submit: { status: 403, body: { code: "own_booth" } } });
    renderEvent(<ReviewFlow booth={BOOTH} />, live);
    await screen.findByText(copy.event.form.stars);
    fireEvent.click(screen.getByRole("radio", { name: copy.visitor.stars(5) }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Seru banget" } });
    fireEvent.click(screen.getByRole("button", { name: copy.event.form.submit }));
    expect((await screen.findByRole("alert")).textContent).toBe(copy.errors.own_booth);
  });

  it("sudah masuk: tidak ada tombol keluar/ganti akun (anti kecurangan), hanya nama akun", async () => {
    server({ loggedIn: true });
    renderEvent(<ReviewFlow booth={BOOTH} />, live);
    await screen.findByText(copy.event.form.stars);
    expect(
      screen.getByText(copy.event.login.as(VISITOR.displayName ?? copy.event.login.anonymousName)),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /keluar|ganti akun|logout/i })).toBeNull();
  });

  it("Turnstile aktif tapi token belum ada: tombol kirim tetap mati (gagal tertutup di UI)", async () => {
    stubApi((c) => {
      if (c.path === "/api/visitor/me")
        return { body: ME({ visitor: VISITOR, turnstileSiteKey: "site" }) };
      if (c.path === "/api/me/reviews") return { body: { reviews: [] } };
      return undefined;
    });
    renderEvent(<ReviewFlow booth={BOOTH} />, live);
    await screen.findByText(copy.event.form.stars);
    fireEvent.click(screen.getByRole("radio", { name: copy.visitor.stars(5) }));
    expect(
      (screen.getByRole("button", { name: copy.event.form.submit }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("gagal memuat sesi: ada galat dengan 'coba lagi', bukan kerangka selamanya", async () => {
    stubApi(() => ({ status: 500, body: { code: "internal_error" } }));
    renderEvent(<ReviewFlow booth={BOOTH} />, live);
    expect(
      await screen.findByRole("button", { name: /coba lagi/i }, { timeout: 3000 }),
    ).toBeTruthy();
  });
});

// ---------- Ulasan + laporan ----------
describe("ReviewsSection dan ReportDialog", () => {
  const page = (n: number, next: string | null) => ({
    reviews: Array.from({ length: n }, (_, i) =>
      REVIEW({ id: `r${next ?? "x"}${i}`, text: `Ulasan ${next ?? "akhir"} ${i}` }),
    ),
    next,
  });

  it("tanpa ulasan: tidak dirender sama sekali", async () => {
    stubApi((c) =>
      c.path.includes("/reviews") ? { body: { reviews: [], next: null } } : undefined,
    );
    const { container } = renderEvent(<ReviewsSection boothId="b1" />, live);
    await waitFor(() => expect(isEmpty(container)).toBe(true));
  });

  it("memuat bertahap dengan kursor: 'Muat ulasan lainnya' menambah halaman berikutnya sampai habis", async () => {
    const calls = stubApi((c) => {
      if (!c.path.includes("/reviews")) return undefined;
      return c.path.includes("cursor=") ? { body: page(2, null) } : { body: page(3, "123:abc") };
    });
    renderEvent(<ReviewsSection boothId="b1" />, live);
    expect(await screen.findByText("Ulasan 123:abc 0")).toBeTruthy();
    expect(screen.getAllByRole("article")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: copy.event.reviews.more }));
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(5));
    expect(calls.at(-1)?.path).toContain("cursor=123%3Aabc");
    expect(screen.queryByRole("button", { name: copy.event.reviews.more })).toBeNull();
  });

  it("setelah event selesai: tombol lapor hilang (hanya-baca)", async () => {
    stubApi((c) => (c.path.includes("/reviews") ? { body: page(1, null) } : undefined));
    renderEvent(<ReviewsSection boothId="b1" />, ended);
    await screen.findByRole("article");
    expect(screen.queryByRole("button", { name: copy.event.reviews.report })).toBeNull();
  });

  it("lapor sebagai pengunjung masuk: pilih alasan, kirim dengan kunci; dialog menutup dan toast tampil", async () => {
    const calls = stubApi((c) => {
      if (c.path.includes("/reviews") && c.method === "GET") return { body: page(1, null) };
      if (c.path === "/api/visitor/me") return { body: ME({ visitor: VISITOR }) };
      if (c.path.startsWith("/api/reviews/")) return { body: { ok: true, alreadyReported: false } };
      return undefined;
    });
    renderEvent(<ReviewsSection boothId="b1" />, live);
    fireEvent.click(await screen.findByRole("button", { name: copy.event.reviews.report }));
    const dialog = await screen.findByRole("dialog", { hidden: true });
    await within(dialog).findByText(copy.event.report.reasons.hate);
    fireEvent.click(within(dialog).getByRole("button", { name: copy.event.report.reasons.hate }));
    fireEvent.change(within(dialog).getByLabelText(copy.event.report.note), {
      target: { value: "SARA" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: copy.event.report.submit }));
    await waitFor(() => expect(screen.getByText(copy.event.reviews.reported)).toBeTruthy());
    const post = calls.find((c) => c.method === "POST");
    expect(post?.path).toBe("/api/reviews/rx0/report");
    expect(post?.body).toEqual({ reason: "hate", note: "SARA", turnstileToken: undefined });
    expect(post?.headers["Idempotency-Key"]).toBeTruthy();
    expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
  });

  it("belum masuk: dialog lapor meminta masuk dulu (tanpa tombol kirim)", async () => {
    stubApi((c) => (c.path === "/api/visitor/me" ? { body: ME() } : undefined));
    renderEvent(<ReportDialog reviewId="r1" onClose={() => {}} />, live);
    expect(await screen.findByText(copy.event.report.loginFirst)).toBeTruthy();
    expect(screen.queryByRole("button", { name: copy.event.report.submit })).toBeNull();
  });

  it("alasan laporan punya kelima pilihan dari daftar bersama", async () => {
    stubApi((c) => (c.path === "/api/visitor/me" ? { body: ME({ visitor: VISITOR }) } : undefined));
    renderEvent(<ReportDialog reviewId="r1" onClose={() => {}} />, live);
    for (const label of Object.values(copy.event.report.reasons)) {
      expect(await screen.findByRole("button", { name: label })).toBeTruthy();
    }
  });
});
