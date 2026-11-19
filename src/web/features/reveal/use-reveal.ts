// Kapan dan bagaimana animasi pemenang diputar (explore.md A8, B20). Aturannya murni di `shared/reveal.ts`; hook ini
// hanya menyambungkannya ke data (snapshot, hasil beku), penyimpanan browser, dan status lapisan.

import type { ResultEntry } from "@shared/results";
import { autoplayOffKey, revealSeenKey, shouldAutoReplay, shouldPlayLive } from "@shared/reveal";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEventState } from "../../lib/event-state";
import { createSafeStorage, type SafeStorage } from "../../lib/safe-storage";
import { useEventData, useResultsQuery, useSnapshotQuery } from "../event-data";

let storage: SafeStorage | null = null;
const store = () => {
  storage ??= createSafeStorage();
  return storage;
};

export type RevealMode = "live" | "replay";

export interface RevealControls {
  /** Lapisan yang sedang tampil; null = tidak ada */
  overlay: { mode: RevealMode; results: readonly ResultEntry[] } | null;
  /** Hasil sudah diumumkan (tombol "Putar ulang" boleh tampil) */
  canReplay: boolean;
  replay: () => void;
  close: () => void;
  /** Pilihan "jangan putar otomatis lagi di perangkat ini" (per versi hasil) */
  optedOut: boolean;
  setOptOut: (off: boolean) => void;
}

/**
 * `area`: halaman pengunjung hanya memutar pemutaran langsung bertarget `everyone`; Layar Besar memutar keduanya.
 * `autoReplay`: putar otomatis tiap halaman dibuka setelah event selesai dan hasil diumumkan (hanya halaman event, /results).
 */
export function useReveal(o: { area: "event" | "screen"; autoReplay: boolean }): RevealControls {
  const { event, serverNow } = useEventData();
  const state = useEventState();
  const snap = useSnapshotQuery(event, { poll: false }).data;
  const published = snap?.resultsPublished ?? false;
  const version = snap?.resultsVersion ?? event.versions.results;
  const results = useResultsQuery(event, published, version).data?.results ?? null;

  const [optedOut, setOptedOutState] = useState(
    () => store().get(autoplayOffKey(event.id, version)) === "1",
  );
  // Versi hasil berganti ("Perbarui hasil"): pilihan lama tidak berlaku, pemutaran otomatis menyala lagi.
  useEffect(() => {
    setOptedOutState(store().get(autoplayOffKey(event.id, version)) === "1");
  }, [event.id, version]);

  const [dismissed, setDismissed] = useState(false);
  const [manual, setManual] = useState(false);
  const [liveSeq, setLiveSeq] = useState(0);
  const seen = useRef(Number(store().get(revealSeenKey(event.id)) ?? 0));

  const reveal = snap?.reveal ?? null;
  useEffect(() => {
    if (!results) return;
    if (shouldPlayLive({ reveal, lastSeenSeq: seen.current, now: serverNow(), area: o.area })) {
      seen.current = reveal?.seq ?? seen.current;
      store().set(revealSeenKey(event.id), String(seen.current));
      setDismissed(false);
      setLiveSeq(seen.current);
    }
  }, [reveal, results, serverNow, o.area, event.id]);

  // Pemutaran otomatis "terkunci" sejak mulai sampai ditutup: mencentang "jangan putar otomatis lagi" saat lapisan
  // terbuka tidak boleh menutupnya (kotak centang bisa dicentang bersamaan dengan Lewati). Pilihan itu berlaku
  // untuk pembukaan halaman berikutnya.
  const eligible =
    o.autoReplay &&
    shouldAutoReplay({ frozen: state.frozen, resultsPublished: published, optedOut });
  const [autoActive, setAutoActive] = useState(false);
  useEffect(() => {
    if (eligible && results && !dismissed) setAutoActive(true);
  }, [eligible, results, dismissed]);
  const auto = autoActive && !dismissed;

  const overlay = useMemo(() => {
    if (!results) return null;
    if (liveSeq > 0 && !dismissed) return { mode: "live" as const, results };
    if (manual || auto) return { mode: "replay" as const, results };
    return null;
  }, [results, liveSeq, dismissed, manual, auto]);

  const close = useCallback(() => {
    setDismissed(true);
    setManual(false);
    setLiveSeq(0);
    setAutoActive(false);
  }, []);
  const replay = useCallback(() => {
    setDismissed(false);
    setLiveSeq(0);
    setManual(true);
  }, []);
  const setOptOut = useCallback(
    (off: boolean) => {
      setOptedOutState(off);
      const key = autoplayOffKey(event.id, version);
      if (off) store().set(key, "1");
      else store().remove(key);
    },
    [event.id, version],
  );

  return { overlay, canReplay: published && results !== null, replay, close, optedOut, setOptOut };
}
