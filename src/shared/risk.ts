// Skor risiko review (explore.md B9): fungsi MURNI. Hanya MENAHAN review (`held`, diam-diam, untuk dicek admin);
// tidak pernah menghapus. IP/UA hanya sinyal: WiFi kampus berbagi satu IP, jadi tidak ada sinyal yang memblokir sendirian.

import { CONFIG } from "./config";

export interface RiskInput {
  stars: number;
  hasComment: boolean;
  /** Review ke booth ini dalam 60 detik terakhir (dari semua pengunjung) */
  boothReviewsLastMinute: number;
  /** Review ke booth ini dari ip_hash yang sama (di luar pengunjung ini) */
  sameIpBoothReviews: number;
  /** Umur akun pengunjung saat review dikirim (ms) */
  visitorAgeMs: number;
  /** Bintang review lain dari pengunjung yang sama (tidak termasuk yang ini) */
  otherStars: readonly number[];
  /** Komentar kena filter kata (hanya menambah sedikit; komentar ditangani terpisah) */
  filterHit: boolean;
}

export interface RiskResult {
  score: number;
  flags: string[];
}

const W = { burst: 40, sameIp: 30, fresh: 20, sabotage: 35, filter: 5 } as const;

export function computeRisk(i: RiskInput): RiskResult {
  const flags: string[] = [];
  let score = 0;
  const add = (flag: string, weight: number) => {
    flags.push(flag);
    score += weight;
  };

  if (i.boothReviewsLastMinute > CONFIG.spam.burstThresholdPerBoothPerMin) add("burst", W.burst);
  if (i.sameIpBoothReviews >= CONFIG.spam.sameIpBoothThreshold) add("same_ip", W.sameIp);
  if (i.visitorAgeMs < CONFIG.spam.freshVisitorMs && i.stars === 5 && !i.hasComment) {
    add("fresh_five_star", W.fresh);
  }

  // Sabotase: seluruh review pengunjung ini hanya bintang 1 atau 5 (≥ N review) dan yang ini ikut pola.
  const all = [...i.otherStars, i.stars];
  const extremeOnly = all.every((s) => s === 1 || s === 5);
  const hasBoth = all.includes(1) && all.includes(5);
  if (all.length >= CONFIG.spam.sabotageMinReviews && extremeOnly && hasBoth) {
    add("sabotage_pattern", W.sabotage);
  }
  if (i.filterHit) add("filter_hit", W.filter);

  return { score, flags };
}

export const shouldHold = (score: number): boolean => score >= CONFIG.spam.holdRiskThreshold;
