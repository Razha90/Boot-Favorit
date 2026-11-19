import { describe, expect, it } from "vitest";
import { type EventSchedule, getEventState, scheduleWarnings } from "./event-state";

// Garis waktu uji: daftar dibuka 1000, ditutup 2000, event mulai 3000, selesai 4000.
const base: EventSchedule = {
  registrationOpenAt: 1000,
  registrationCloseAt: 2000,
  eventStartAt: 3000,
  eventEndAt: 4000,
  resultsPublishedAt: null,
  allowLateRegistration: true,
};

describe("getEventState: pendaftaran", () => {
  it("sebelum pendaftaran dibuka: tombol dan form belum aktif", () => {
    const s = getEventState(base, 500);
    expect(s.registrationButtonVisible).toBe(false);
    expect(s.registrationAccepting).toBe(false);
    expect(s.registrationIsLate).toBe(false);
  });

  it("saat pendaftaran reguler: tombol tampil, form aktif, bukan susulan", () => {
    const s = getEventState(base, 1500);
    expect(s.registrationButtonVisible).toBe(true);
    expect(s.registrationAccepting).toBe(true);
    expect(s.registrationIsLate).toBe(false);
  });

  it("tepat pada waktu tutup: tombol hilang, form menjadi susulan", () => {
    const s = getEventState(base, 2000);
    expect(s.registrationButtonVisible).toBe(false);
    expect(s.registrationAccepting).toBe(true);
    expect(s.registrationIsLate).toBe(true);
  });

  it("susulan tetap diterima setelah event mulai sampai event selesai", () => {
    const s = getEventState(base, 3500);
    expect(s.phase).toBe("live");
    expect(s.registrationButtonVisible).toBe(false);
    expect(s.registrationAccepting).toBe(true);
    expect(s.registrationIsLate).toBe(true);
  });

  it("susulan dimatikan admin: form menolak setelah penutupan", () => {
    const s = getEventState({ ...base, allowLateRegistration: false }, 2500);
    expect(s.registrationAccepting).toBe(false);
    expect(s.registrationIsLate).toBe(false);
  });

  it("registrationOpenAt null = terbuka sejak awal", () => {
    const s = getEventState({ ...base, registrationOpenAt: null }, 0);
    expect(s.registrationButtonVisible).toBe(true);
    expect(s.registrationAccepting).toBe(true);
  });

  it("event selesai: pendaftaran ditolak sepenuhnya, termasuk susulan", () => {
    const s = getEventState(base, 4000);
    expect(s.frozen).toBe(true);
    expect(s.registrationButtonVisible).toBe(false);
    expect(s.registrationAccepting).toBe(false);
    expect(s.registrationIsLate).toBe(false);
  });
});

describe("getEventState: fase dan voting", () => {
  it("batas fase: mulai = live, selesai = ended", () => {
    expect(getEventState(base, 2999).phase).toBe("upcoming");
    expect(getEventState(base, 3000).phase).toBe("live");
    expect(getEventState(base, 3999).phase).toBe("live");
    expect(getEventState(base, 4000).phase).toBe("ended");
  });

  it("voting hanya terbuka selama event berlangsung", () => {
    expect(getEventState(base, 2999).votingOpen).toBe(false);
    expect(getEventState(base, 3000).votingOpen).toBe(true);
    expect(getEventState(base, 4000).votingOpen).toBe(false);
  });

  it("beku hanya setelah event selesai", () => {
    expect(getEventState(base, 3999).frozen).toBe(false);
    expect(getEventState(base, 4000).frozen).toBe(true);
  });

  it("membuka kembali event (memundurkan eventEnd) membatalkan beku", () => {
    expect(getEventState(base, 4500).frozen).toBe(true);
    const reopened = { ...base, eventEndAt: 5000 };
    const s = getEventState(reopened, 4500);
    expect(s.frozen).toBe(false);
    expect(s.votingOpen).toBe(true);
  });

  it("hasil diumumkan mengikuti resultsPublishedAt", () => {
    expect(getEventState(base, 4500).resultsPublished).toBe(false);
    expect(getEventState({ ...base, resultsPublishedAt: 4200 }, 4500).resultsPublished).toBe(true);
  });
});

describe("getEventState: nextChangeAt", () => {
  it("menunjuk perubahan terdekat yang akan datang", () => {
    expect(getEventState(base, 0).nextChangeAt).toBe(1000);
    expect(getEventState(base, 1000).nextChangeAt).toBe(2000);
    expect(getEventState(base, 2500).nextChangeAt).toBe(3000);
    expect(getEventState(base, 3500).nextChangeAt).toBe(4000);
  });

  it("null bila tidak ada perubahan lagi", () => {
    expect(getEventState(base, 4000).nextChangeAt).toBeNull();
    expect(getEventState(base, 9999).nextChangeAt).toBeNull();
  });

  it("mengabaikan registrationOpenAt yang null", () => {
    expect(getEventState({ ...base, registrationOpenAt: null }, 0).nextChangeAt).toBe(2000);
  });
});

describe("scheduleWarnings", () => {
  it("tanpa peringatan untuk jadwal normal di masa depan", () => {
    expect(scheduleWarnings(base, 0)).toEqual([]);
  });

  it("penutupan pendaftaran setelah event mulai", () => {
    const w = scheduleWarnings({ ...base, registrationCloseAt: 3500 }, 0);
    expect(w).toContain("registration_closes_after_event_start");
  });

  it("tanggal tutup dan selesai di masa lalu", () => {
    const w = scheduleWarnings(base, 5000);
    expect(w).toContain("registration_close_in_past");
    expect(w).toContain("event_end_in_past");
  });
});
