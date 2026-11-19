import type { PublicBooth } from "@shared/api-types";
import { CONFIG } from "@shared/config";
import { spotlightOrder, spotlightPosition } from "@shared/fair-order";
import { useEffect, useMemo, useState } from "react";
import { BoothCard } from "../../../components/shared/BoothCard";

/**
 * Sorotan bergilir yang adil (explore.md A8, B20): dalam satu putaran SEMUA booth tampil tepat satu kali, dalam
 * urutan acak per pengunjung (hash(seed + putaran + id)). Giliran dihitung dari WAKTU SERVER, jadi tanpa beban
 * server dan tanpa koordinasi. Booth tanpa foto mendapat giliran yang sama (tata letak hanya-teks).
 */
export function SpotlightSection({
  booths,
  seed,
  serverNow,
  ratingsHidden,
}: {
  booths: readonly PublicBooth[];
  seed: string;
  serverNow: () => number;
  ratingsHidden: boolean;
}) {
  const interval = CONFIG.live.spotlightMs;
  // "Sekarang" menurut server; diperbarui satu kali tepat di batas giliran berikutnya.
  const [now, setNow] = useState(serverNow);

  useEffect(() => {
    if (booths.length < 2) return;
    const wait = interval - (now % interval) + 20;
    const id = setTimeout(() => setNow(serverNow()), wait);
    return () => clearTimeout(id);
  }, [booths.length, interval, now, serverNow]);

  const { round, index } = useMemo(
    () => spotlightPosition(now, interval, booths.length),
    [now, interval, booths.length],
  );
  const order = useMemo(() => spotlightOrder(booths, seed, round), [booths, seed, round]);
  const current = order[index];
  if (!current) return null;
  return (
    <div key={current.id} className="reveal-pop">
      <BoothCard booth={current} variant="spotlight" ratingsHidden={ratingsHidden} />
    </div>
  );
}
