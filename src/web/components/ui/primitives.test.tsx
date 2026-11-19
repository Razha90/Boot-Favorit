// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog, Modal } from "./Modal";
import { EmptyState, ErrorState, Skeleton } from "./states";
import { ToastProvider, useToast } from "./Toast";

// jsdom belum memiliki <dialog>.showModal/close: polyfill minimal.
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
  vi.useRealTimers();
});

const dialog = () => document.querySelector("dialog") as HTMLDialogElement;

describe("Modal", () => {
  it("terbuka/tertutup mengikuti prop open", () => {
    const { rerender } = render(
      <Modal open={false} onClose={() => {}} title="Judul">
        isi
      </Modal>,
    );
    expect(dialog().open).toBe(false);
    rerender(
      <Modal open onClose={() => {}} title="Judul">
        isi
      </Modal>,
    );
    expect(dialog().open).toBe(true);
    // Nama dialog = judulnya, lewat id unik (bukan id tetap yang bentrok antar dialog).
    const labelId = dialog().getAttribute("aria-labelledby") ?? "";
    expect(labelId).not.toBe("");
    expect(labelId).not.toBe("modal-title");
    expect(document.getElementById(labelId)?.textContent).toBe("Judul");
  });

  it("beberapa dialog di satu halaman: id judul unik dan masing-masing menunjuk judulnya sendiri", () => {
    render(
      <>
        <Modal open={false} onClose={() => {}} title="Satu">
          a
        </Modal>
        <Modal open={false} onClose={() => {}} title="Dua">
          b
        </Modal>
      </>,
    );
    const [one, two] = [...document.querySelectorAll("dialog")];
    const id1 = one?.getAttribute("aria-labelledby") ?? "";
    const id2 = two?.getAttribute("aria-labelledby") ?? "";
    expect(id1).not.toBe(id2);
    expect(document.getElementById(id1)?.textContent).toBe("Satu");
    expect(document.getElementById(id2)?.textContent).toBe("Dua");
  });

  it("Esc (cancel) memanggil onClose; saat locked dibatalkan dan dialog tetap terbuka", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Modal open onClose={onClose} title="J">
        x
      </Modal>,
    );
    const ev = new Event("cancel", { cancelable: true });
    dialog().dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true); // dialog ditutup lewat state, bukan bawaan browser
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <Modal open onClose={onClose} title="J" locked>
        x
      </Modal>,
    );
    dialog().dispatchEvent(new Event("cancel", { cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(1); // tidak bertambah
  });
});

describe("ConfirmDialog", () => {
  it("konfirmasi menjalankan aksi dengan kunci idempotensi lalu menutup; klik ganda hanya sekali", async () => {
    let release!: () => void;
    const action = vi.fn(
      () =>
        new Promise<void>((r) => {
          release = r;
        }),
    );
    const onClose = vi.fn();
    render(
      <ConfirmDialog
        open
        onClose={onClose}
        title="Hapus?"
        message="Yakin?"
        confirmLabel="Hapus"
        danger
        action={action}
      />,
    );
    const btn = screen.getByRole("button", { name: "Hapus" });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(action).toHaveBeenCalledTimes(1);
    expect((action.mock.calls[0] as unknown as [{ key: string }])[0].key).toMatch(
      /^[0-9a-f-]{36}$/,
    );
    await act(async () => release());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("selama pending: tombol Batal nonaktif dan Esc tidak menutup", async () => {
    let release!: () => void;
    const onClose = vi.fn();
    render(
      <ConfirmDialog
        open
        onClose={onClose}
        title="Hapus?"
        message="Yakin?"
        confirmLabel="Hapus"
        action={() => new Promise<void>((r) => (release = r))}
      />,
    );
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Hapus" })));
    expect((screen.getByRole("button", { name: "Batal" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    dialog().dispatchEvent(new Event("cancel", { cancelable: true }));
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => release());
  });
});

function Trigger() {
  const t = useToast();
  return (
    <button type="button" onClick={() => t.push("Tersimpan", "success")}>
      push
    </button>
  );
}

describe("Toast", () => {
  it("muncul di wilayah aria-live sopan dan hilang sendiri setelah 5 detik", async () => {
    vi.useFakeTimers();
    const { container } = render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    expect(container.querySelector("[aria-live='polite']")).not.toBeNull();
    fireEvent.click(screen.getByText("push"));
    expect(screen.getByRole("status").textContent).toContain("Tersimpan");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5100);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("maksimal 3 sekaligus dan bisa ditutup manual", () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByText("push"));
    expect(screen.getAllByRole("status")).toHaveLength(3);
    fireEvent.click(screen.getAllByText("Tutup")[0] as HTMLElement);
    expect(screen.getAllByRole("status")).toHaveLength(2);
  });

  it("useToast di luar provider memberi galat yang jelas", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Trigger />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });
});

describe("keadaan", () => {
  it("EmptyState: judul, penjelasan, dan ajakan opsional", () => {
    render(
      <EmptyState
        title="Belum ada"
        body="Coba lagi nanti."
        action={<button type="button">Tambah</button>}
      />,
    );
    expect(screen.getByText("Belum ada")).toBeTruthy();
    expect(screen.getByText("Coba lagi nanti.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tambah" })).toBeTruthy();
  });

  it("ErrorState: peran alert, tombol Coba lagi hanya bila ada onRetry", () => {
    const onRetry = vi.fn();
    const { rerender } = render(<ErrorState onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    rerender(<ErrorState />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("Skeleton dekoratif (aria-hidden)", () => {
    const { container } = render(<Skeleton />);
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
  });
});
