// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const convert = vi.hoisted(() => vi.fn());
vi.mock("../../lib/image/convert-to-webp", () => ({ convertToWebp: convert }));

import { ImageUploader } from "./ImageUploader";

const file = () => new File([new Uint8Array(10)], "foto.jpg", { type: "image/jpeg" });
const pair = () => ({
  full: new Blob([new Uint8Array(5)], { type: "image/webp" }),
  thumb: new Blob([new Uint8Array(3)], { type: "image/webp" }),
});

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:pratinjau");
  URL.revokeObjectURL = vi.fn();
  convert.mockReset();
});
afterEach(cleanup);

const input = () => document.querySelector('input[type="file"]') as HTMLInputElement;
const choose = async (f: File) => {
  await act(async () => {
    fireEvent.change(input(), { target: { files: [f] } });
  });
};

describe("ImageUploader", () => {
  it("memilih berkas: konversi, pratinjau, lalu tombol Unggah", async () => {
    convert.mockResolvedValue(pair());
    render(<ImageUploader kind="photo" label="Foto booth" onUpload={async () => {}} />);
    await choose(file());
    expect(convert).toHaveBeenCalledWith(expect.any(File), "photo");
    expect(await screen.findByRole("button", { name: "Unggah" })).toBeTruthy();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it("mengunggah dengan Idempotency-Key, lalu membersihkan pilihan dan memanggil onUploaded", async () => {
    const converted = pair();
    convert.mockResolvedValue(converted);
    const onUpload = vi.fn(async () => ({}));
    const onUploaded = vi.fn();
    render(<ImageUploader kind="logo" label="Logo" onUpload={onUpload} onUploaded={onUploaded} />);
    await choose(file());
    await act(async () => fireEvent.click(await screen.findByRole("button", { name: "Unggah" })));
    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(1));
    expect(onUpload).toHaveBeenCalledTimes(1);
    const [image, ctx] = onUpload.mock.calls[0] as unknown as [typeof converted, { key: string }];
    expect(image).toBe(converted);
    expect(ctx.key).toMatch(/^[0-9a-f-]{36}$/); // kunci idempotensi untuk header
    expect(screen.queryByRole("button", { name: "Unggah" })).toBeNull();
  });

  it("klik ganda 'Unggah' hanya mengunggah sekali", async () => {
    convert.mockResolvedValue(pair());
    let release!: () => void;
    const onUpload = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    render(<ImageUploader kind="photo" label="Foto" onUpload={onUpload} />);
    await choose(file());
    const btn = await screen.findByRole("button", { name: "Unggah" });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(onUpload).toHaveBeenCalledTimes(1);
    await act(async () => release());
  });

  it("galat konversi menampilkan pesan yang jelas dan tidak menampilkan tombol Unggah", async () => {
    convert.mockRejectedValue(Object.assign(new Error("too_large_raw"), { code: "too_large_raw" }));
    render(<ImageUploader kind="photo" label="Foto" onUpload={async () => {}} />);
    await choose(file());
    expect((await screen.findByRole("alert")).textContent).toContain("terlalu besar");
    expect(screen.queryByRole("button", { name: "Unggah" })).toBeNull();
  });

  it("disabled: pilihan berkas dinonaktifkan", () => {
    render(<ImageUploader kind="photo" label="Foto" onUpload={async () => {}} disabled />);
    expect(input().disabled).toBe(true);
  });
});
