// Status event DIHITUNG dari tanggal, tidak pernah disimpan (explore.md B17).
// Fungsi murni: waktu adalah argumen, bukan Date.now(), agar mudah diuji dan sama di client dan server.

export interface EventSchedule {
  /** null = pendaftaran terbuka sejak event dipublikasikan */
  registrationOpenAt: number | null;
  registrationCloseAt: number;
  eventStartAt: number;
  eventEndAt: number;
  resultsPublishedAt: number | null;
  /** Pendaftaran susulan lewat link setelah penutupan, sampai event selesai */
  allowLateRegistration: boolean;
}

export type EventPhase = "upcoming" | "live" | "ended";

export interface EventState {
  phase: EventPhase;
  /** Event selesai: hanya admin yang boleh mengubah data */
  frozen: boolean;
  /** Tombol "Daftar Toko" di halaman publik */
  registrationButtonVisible: boolean;
  /** Form /register menerima kiriman (reguler atau susulan) */
  registrationAccepting: boolean;
  /** Kiriman yang masuk sekarang dihitung sebagai susulan */
  registrationIsLate: boolean;
  /** Review hanya dibuka selama event berlangsung */
  votingOpen: boolean;
  resultsPublished: boolean;
  /** Waktu perubahan status berikutnya (untuk pewaktu di client), atau null */
  nextChangeAt: number | null;
}

export type ScheduleWarning =
  | "registration_closes_after_event_start"
  | "registration_close_in_past"
  | "event_end_in_past";

/** Peringatan lunak untuk admin saat mengedit jadwal (B17): tidak memblokir penyimpanan. */
export function scheduleWarnings(
  s: Pick<EventSchedule, "registrationCloseAt" | "eventStartAt" | "eventEndAt">,
  now: number,
): ScheduleWarning[] {
  const out: ScheduleWarning[] = [];
  if (s.registrationCloseAt > s.eventStartAt) out.push("registration_closes_after_event_start");
  if (s.registrationCloseAt <= now) out.push("registration_close_in_past");
  if (s.eventEndAt <= now) out.push("event_end_in_past");
  return out;
}

export function getEventState(s: EventSchedule, now: number): EventState {
  const phase: EventPhase =
    now < s.eventStartAt ? "upcoming" : now < s.eventEndAt ? "live" : "ended";
  const frozen = phase === "ended";
  const registrationStarted = s.registrationOpenAt === null || now >= s.registrationOpenAt;

  const registrationButtonVisible = !frozen && registrationStarted && now < s.registrationCloseAt;
  const registrationAccepting =
    !frozen && registrationStarted && (now < s.registrationCloseAt || s.allowLateRegistration);
  const registrationIsLate = registrationAccepting && !registrationButtonVisible;

  const upcomingChanges = [
    s.registrationOpenAt,
    s.registrationCloseAt,
    s.eventStartAt,
    s.eventEndAt,
  ].filter((t): t is number => t !== null && t > now);
  const nextChangeAt = upcomingChanges.length > 0 ? Math.min(...upcomingChanges) : null;

  return {
    phase,
    frozen,
    registrationButtonVisible,
    registrationAccepting,
    registrationIsLate,
    votingOpen: phase === "live",
    resultsPublished: s.resultsPublishedAt !== null,
    nextChangeAt,
  };
}
