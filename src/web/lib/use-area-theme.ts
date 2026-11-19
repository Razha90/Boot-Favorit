import { useLayoutEffect } from "react";
import { applyTheme, type ThemeMode, type Vibe } from "./theme-loader";

// Dipanggil sekali oleh layout tiap area, sebelum browser mengecat.
export function useAreaTheme(vibe: Vibe, mode: ThemeMode): void {
  useLayoutEffect(() => {
    applyTheme({ vibe, mode });
  }, [vibe, mode]);
}
