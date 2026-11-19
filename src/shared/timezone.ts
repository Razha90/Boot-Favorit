// Jadwal diinput admin sebagai waktu lokal di zona waktu EVENT (events.timezone), disimpan sebagai epoch UTC
// (explore.md B17). Fungsi murni berbasis Intl, tanpa pustaka tanggal.

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

interface Parts {
  y: number;
  mo: number;
  d: number;
  h: number;
  mi: number;
  s: number;
}

function partsIn(epoch: number, timeZone: string): Parts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const get = (type: string) =>
    Number(fmt.formatToParts(epoch).find((p) => p.type === type)?.value);
  return {
    y: get("year"),
    mo: get("month"),
    d: get("day"),
    h: get("hour"),
    mi: get("minute"),
    s: get("second"),
  };
}

/** Selisih zona waktu terhadap UTC (ms) pada saat `epoch`. */
export function tzOffsetMs(epoch: number, timeZone: string): number {
  const whole = Math.floor(epoch / 1000) * 1000;
  const p = partsIn(whole, timeZone);
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - whole;
}

/** "2026-11-20T09:30" di zona waktu `timeZone` → epoch ms UTC. Null bila format tidak valid. */
export function zonedLocalToEpoch(local: string, timeZone: string): number | null {
  const m = LOCAL_RE.exec(local);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  if (Number.isNaN(naive)) return null;
  // Dua langkah agar benar di sekitar pergantian waktu musim panas.
  const guess = naive - tzOffsetMs(naive, timeZone);
  const epoch = naive - tzOffsetMs(guess, timeZone);
  return epoch;
}

/** epoch ms UTC → "YYYY-MM-DDTHH:mm" di zona waktu `timeZone` (format input datetime-local). */
export function epochToZonedLocal(epoch: number, timeZone: string): string {
  const p = partsIn(epoch, timeZone);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${String(p.y).padStart(4, "0")}-${two(p.mo)}-${two(p.d)}T${two(p.h)}:${two(p.mi)}`;
}
