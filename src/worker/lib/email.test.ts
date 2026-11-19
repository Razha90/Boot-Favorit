import { describe, expect, it, vi } from "vitest";
import { boothMail } from "./booth-mail";
import { cloudflareEmailSender, parseSenderAddress, resendSender } from "./email";

describe("cloudflareEmailSender", () => {
  it("tanpa binding EMAIL atau EMAIL_FROM: tidak aktif (undefined)", () => {
    const fakeBinding = { send: vi.fn() } as unknown as SendEmail;
    expect(cloudflareEmailSender({})).toBeUndefined();
    expect(cloudflareEmailSender({ EMAIL: fakeBinding })).toBeUndefined();
    expect(cloudflareEmailSender({ EMAIL_FROM: "noreply@mail.eventunimed.id" })).toBeUndefined();
  });

  it("mengurai pengirim dan mengirim melalui binding SendEmail", async () => {
    const sendMock = vi.fn(async () => ({ messageId: "msg-1" }));
    const send = cloudflareEmailSender({
      EMAIL: { send: sendMock } as unknown as SendEmail,
      EMAIL_FROM: "LPPM Expo <noreply@mail.eventunimed.id>",
    });
    await send?.({ to: "v@contoh.id", subject: "Kode", text: "123456" });
    expect(sendMock).toHaveBeenCalledWith({
      from: { name: "LPPM Expo", email: "noreply@mail.eventunimed.id" },
      to: "v@contoh.id",
      subject: "Kode",
      text: "123456",
    });
    expect(parseSenderAddress("noreply@mail.eventunimed.id")).toBe("noreply@mail.eventunimed.id");
  });
});

describe("resendSender", () => {
  it("tanpa kunci atau pengirim: tidak aktif (undefined), bukan pengirim palsu", () => {
    expect(resendSender({})).toBeUndefined();
    expect(resendSender({ RESEND_API_KEY: "k" })).toBeUndefined();
    expect(resendSender({ EMAIL_FROM: "a@b.id" })).toBeUndefined();
  });

  it("mengirim ke penyedia dengan kunci di header dan penerima tunggal", async () => {
    const fetcher = vi.fn(async () => new Response("{}", { status: 200 }));
    const send = resendSender(
      { RESEND_API_KEY: "kunci", EMAIL_FROM: "Panitia <p@e.id>" },
      fetcher as unknown as typeof fetch,
    );
    await send?.({ to: "a@c.id", subject: "Halo", text: "Isi" });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer kunci");
    expect(JSON.parse(init.body as string)).toEqual({
      from: "Panitia <p@e.id>",
      to: ["a@c.id"],
      subject: "Halo",
      text: "Isi",
    });
  });

  it("penyedia menolak → galat (bukan diam-diam dianggap terkirim)", async () => {
    const fetcher = vi.fn(async () => new Response("{}", { status: 422 }));
    const send = resendSender(
      { RESEND_API_KEY: "k", EMAIL_FROM: "p@e.id" },
      fetcher as unknown as typeof fetch,
    );
    await expect(send?.({ to: "a@c.id", subject: "s", text: "t" })).rejects.toThrow(
      "email_provider_422",
    );
  });
});

describe("boothMail", () => {
  const i = {
    to: "a@c.id",
    eventName: "Expo",
    boothName: "Kopi",
    origin: "https://eventunimed.id",
  };
  it("setiap jenis memuat tautan portal dan nama booth", () => {
    for (const k of ["invite", "approved", "rejected", "revision", "suspended"] as const) {
      const m = boothMail(k, { ...i, reason: "alasan uji" });
      expect(m.to).toBe("a@c.id");
      expect(m.text).toContain("https://eventunimed.id/booth");
      expect(m.subject + m.text).toContain("Kopi");
    }
  });
  it("alasan hanya tampil bila ada", () => {
    expect(boothMail("rejected", { ...i, reason: "Tidak sesuai" }).text).toContain(
      "Alasan dari panitia: Tidak sesuai",
    );
    expect(boothMail("rejected", { ...i, reason: "  " }).text).not.toContain("Alasan dari panitia");
    expect(boothMail("approved", { ...i, reason: "x" }).text).not.toContain("Alasan dari panitia");
  });
});
