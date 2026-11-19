// @vitest-environment jsdom
import type { EventSchedule } from "@shared/event-state";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventStateProvider, useEventState } from "../../lib/event-state";
import { ReadOnlyBanner, WriteAction } from "./WriteAction";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const schedule = (over: Partial<EventSchedule> = {}): EventSchedule => ({
  registrationOpenAt: 1000,
  registrationCloseAt: 2000,
  eventStartAt: 3000,
  eventEndAt: 4000,
  resultsPublishedAt: null,
  allowLateRegistration: true,
  ...over,
});

function Form() {
  return (
    <WriteAction>
      <input aria-label="nama" />
      <button type="button">Simpan</button>
    </WriteAction>
  );
}

function Probe() {
  const s = useEventState();
  return <p>{s.registrationButtonVisible ? "tombol-ada" : "tombol-hilang"}</p>;
}

describe("WriteAction", () => {
  it("event berlangsung: isian aktif, tanpa banner", () => {
    render(
      <EventStateProvider schedule={schedule()} serverNow={3500 - 0}>
        <ReadOnlyBanner />
        <Form />
      </EventStateProvider>,
    );
    // serverNow dipakai sebagai "sekarang" saat mount (offset terhadap jam lokal)
    expect(screen.getByLabelText("nama").matches(":disabled")).toBe(false);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("event selesai: semua isian dinonaktifkan dan banner hanya-baca tampil", () => {
    render(
      <EventStateProvider schedule={schedule()} serverNow={5000}>
        <ReadOnlyBanner />
        <Form />
      </EventStateProvider>,
    );
    // Di dalam <fieldset disabled>, isian ditandai lewat pseudo-kelas :disabled (bukan properti .disabled).
    expect(screen.getByLabelText("nama").matches(":disabled")).toBe(true);
    expect(screen.getByRole("button").matches(":disabled")).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("hanya-baca");
  });

  it("mode hide: tidak merender apa pun saat beku", () => {
    render(
      <EventStateProvider schedule={schedule()} serverNow={5000}>
        <WriteAction mode="hide">
          <button type="button">Daftar</button>
        </WriteAction>
      </EventStateProvider>,
    );
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("EventStateProvider: status berubah tepat waktu tanpa muat ulang", () => {
  it("tombol 'Daftar Toko' hilang sendiri saat pendaftaran ditutup (memakai waktu SERVER, bukan jam HP)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01T00:00:00Z")); // jam HP "salah" jauh dari waktu server
    // Waktu server: 1500 → penutupan di 2000 → 500 ms lagi
    render(
      <EventStateProvider schedule={schedule()} serverNow={1500}>
        <Probe />
      </EventStateProvider>,
    );
    expect(screen.getByText("tombol-ada")).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    expect(screen.getByText("tombol-hilang")).toBeTruthy();
  });
});
