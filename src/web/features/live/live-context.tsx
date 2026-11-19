import { createContext, type ReactNode, useContext } from "react";
import { type LiveState, OFFLINE, useLive } from "./use-live";

const LiveContext = createContext<LiveState>(OFFLINE);

/** Satu koneksi live untuk seluruh halaman; hook data membaca statusnya untuk menghentikan polling. */
export function LiveProvider({
  enabled,
  screen,
  children,
}: {
  enabled: boolean;
  screen?: boolean;
  children: ReactNode;
}) {
  const live = useLive({ enabled, screen });
  return <LiveContext.Provider value={live}>{children}</LiveContext.Provider>;
}

export const useLiveStatus = (): LiveState => useContext(LiveContext);
