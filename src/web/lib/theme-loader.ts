// Menerapkan gaya dan tema ke <html>. Nilai warna sendiri hanya ada di styles/theme.css (B4).
export type Vibe = "seru" | "pro";
export type ThemeMode = "kertas" | "panggung";

export function applyTheme({ vibe, mode }: { vibe: Vibe; mode: ThemeMode }): void {
  const root = document.documentElement;
  root.dataset.vibe = vibe;
  root.dataset.theme = mode;
}
