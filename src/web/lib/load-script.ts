// Memuat skrip pihak ketiga (Turnstile, Google Identity) sekali saja, hanya saat dibutuhkan.
// Tidak dimuat di bundle awal dan tidak dimuat di halaman yang tidak memakainya (explore.md B16).

const loading = new Map<string, Promise<void>>();

export function loadScript(src: string): Promise<void> {
  const existing = loading.get(src);
  if (existing) return existing;
  const p = new Promise<void>((resolve, reject) => {
    const el = document.createElement("script");
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => {
      loading.delete(src); // boleh dicoba lagi
      reject(new Error(`gagal memuat ${src}`));
    };
    document.head.append(el);
  });
  loading.set(src, p);
  return p;
}
