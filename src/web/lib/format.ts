// Format tampilan (Intl, locale id-ID). Tidak ada pustaka tanggal.

export const formatDateTime = (epoch: number, timeZone: string) =>
  new Intl.DateTimeFormat("id-ID", { timeZone, dateStyle: "medium", timeStyle: "short" }).format(
    epoch,
  );

/** "3 hari lagi" / "2 jam yang lalu" dari selisih dua waktu. */
export function formatRelative(target: number, now: number): string {
  const diff = target - now;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("id-ID", { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];
  for (const [unit, ms] of units) {
    if (abs >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return rtf.format(Math.round(diff / 1000), "second");
}

/** Rupiah bulat: Rp 18.000 */
export const formatRupiah = (n: number) =>
  n === 0 ? "Gratis" : `Rp ${new Intl.NumberFormat("id-ID").format(n)}`;

/** Rupiah ringkas untuk stiker: Rp 14rb, Rp 14,5rb, Rp 1,5jt. 0 = Gratis. */
export function formatRupiahShort(n: number): string {
  if (n === 0) return "Gratis";
  const dec = (x: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(x);
  if (n >= 1_000_000) return `Rp ${dec(n / 1_000_000)}jt`;
  if (n >= 1_000) return `Rp ${dec(n / 1_000)}rb`;
  return `Rp ${n}`;
}

/** Rata-rata bintang satu desimal, koma Indonesia: 4,7 */
export const formatAverage = (avg: number) =>
  new Intl.NumberFormat("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
    avg,
  );

/** Skor peringkat dua desimal, koma Indonesia: 4,52 */
export const formatScore = (score: number) =>
  new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    score,
  );
