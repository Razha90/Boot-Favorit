// @vitest-environment jsdom
import { ApiError } from "@shared/errors";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NetworkError } from "../../lib/api";
import { ActionButton } from "./ActionButton";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const button = () => screen.getByRole("button") as HTMLButtonElement;

describe("ActionButton", () => {
  it("dua klik cepat: aksi hanya dijalankan sekali", async () => {
    let release!: () => void;
    const action = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    render(<ActionButton action={action}>Simpan</ActionButton>);
    fireEvent.click(button());
    fireEvent.click(button()); // sebelum React sempat me-render ulang
    fireEvent.click(button());
    expect(action).toHaveBeenCalledTimes(1);
    await act(async () => release());
  });

  it("saat pending: nonaktif, aria-busy, label berganti, lebar terkunci", async () => {
    let release!: () => void;
    const action = () =>
      new Promise<void>((resolve) => {
        release = resolve;
      });
    // jsdom tidak menghitung tata letak: sediakan lebar agar penguncian lebar bisa diuji.
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(120);
    render(<ActionButton action={action}>Simpan</ActionButton>);
    expect(button().textContent).toBe("Simpan");
    fireEvent.click(button());
    expect(button().disabled).toBe(true);
    expect(button().getAttribute("aria-busy")).toBe("true");
    expect(button().textContent).toContain("Memproses");
    expect(button().style.width).toBe("120px"); // terkunci agar tidak ada layout shift
    await act(async () => release());
    expect(button().disabled).toBe(false);
    expect(button().getAttribute("aria-busy")).toBeNull();
  });

  it("sukses memanggil onSuccess dan kembali ke label semula", async () => {
    const onSuccess = vi.fn();
    render(
      <ActionButton action={async () => "ok"} onSuccess={onSuccess}>
        Simpan
      </ActionButton>,
    );
    await act(async () => fireEvent.click(button()));
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(button().textContent).toBe("Simpan");
  });

  it("galat API: pesan peran alert dari copy.ts dan label 'Coba lagi'", async () => {
    render(
      <ActionButton
        action={async () => {
          throw new ApiError("email_in_use");
        }}
      >
        Simpan
      </ActionButton>,
    );
    await act(async () => fireEvent.click(button()));
    expect(screen.getByRole("alert").textContent).toContain("sudah dipakai booth lain");
    expect(button().textContent).toBe("Coba lagi");
  });

  it("galat jaringan dijelaskan per sebab dan tombol bisa dicoba lagi dengan kunci SAMA", async () => {
    const keys: string[] = [];
    let attempt = 0;
    const action = async ({ key }: { key: string }) => {
      keys.push(key);
      if (++attempt === 1) throw new NetworkError("offline");
    };
    render(<ActionButton action={action}>Kirim</ActionButton>);
    await act(async () => fireEvent.click(button()));
    expect(screen.getByRole("alert").textContent).toContain("Tidak ada koneksi");
    await act(async () => fireEvent.click(button()));
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("tombol submit tidak memicu pengiriman form bawaan browser", async () => {
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    const action = vi.fn(async () => {});
    render(
      <form onSubmit={onSubmit}>
        <ActionButton type="submit" action={action}>
          Kirim
        </ActionButton>
      </form>,
    );
    await act(async () => fireEvent.click(button()));
    expect(action).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled(); // pengiriman ditangani runner, bukan navigasi form
  });

  it("disabled dari luar tetap menonaktifkan tombol", () => {
    render(
      <ActionButton action={async () => {}} disabled>
        Simpan
      </ActionButton>,
    );
    expect(button().disabled).toBe(true);
  });
});
