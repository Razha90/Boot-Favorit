// Status event di client (explore.md B17): fungsi murni yang SAMA dengan server, memakai waktu server
// (offset = serverNow − Date.now()) sehingga jam HP yang salah tidak memengaruhi tombol yang muncul/hilang.
import { type EventSchedule, type EventState, getEventState } from "@shared/event-state";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";

const MAX_TIMER_MS = 24 * 60 * 60 * 1000; // batas nilai setTimeout; dihitung ulang tiap ≤ 24 jam

const EventStateContext = createContext<EventState | null>(null);

export function EventStateProvider({
  schedule,
  serverNow,
  children,
}: {
  schedule: EventSchedule;
  serverNow: number;
  children: ReactNode;
}) {
  // offset dihitung sekali saat data diterima; Date.now() HP tidak dipercaya.
  const offset = useMemo(() => serverNow - Date.now(), [serverNow]);
  // "Sekarang" menurut server. Saat mount nilainya = serverNow; selanjutnya diperbarui oleh pewaktu.
  const [now, setNow] = useState(serverNow);

  useEffect(() => setNow(serverNow), [serverNow]);

  const state = useMemo(() => getEventState(schedule, now), [schedule, now]);

  // Satu pewaktu ke perubahan berikutnya, sehingga tombol hilang tepat waktu tanpa muat ulang.
  useEffect(() => {
    if (state.nextChangeAt === null) return;
    const wait = Math.min(Math.max(state.nextChangeAt - now, 0) + 50, MAX_TIMER_MS);
    const id = setTimeout(() => setNow(Date.now() + offset), wait);
    return () => clearTimeout(id);
  }, [state.nextChangeAt, now, offset]);

  return <EventStateContext.Provider value={state}>{children}</EventStateContext.Provider>;
}

export function useEventState(): EventState {
  const s = useContext(EventStateContext);
  if (!s) throw new Error("useEventState harus dipakai di dalam EventStateProvider");
  return s;
}
