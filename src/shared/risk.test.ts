import { describe, expect, it } from "vitest";
import { CONFIG } from "./config";
import { computeRisk, type RiskInput, shouldHold } from "./risk";

const calm: RiskInput = {
  stars: 4,
  hasComment: true,
  boothReviewsLastMinute: 1,
  sameIpBoothReviews: 0,
  visitorAgeMs: 120_000,
  otherStars: [4, 5, 3],
  filterHit: false,
};
const risk = (over: Partial<RiskInput>) => computeRisk({ ...calm, ...over });

describe("computeRisk", () => {
  it("pengunjung biasa: nol dan tidak ditahan", () => {
    const r = risk({});
    expect(r).toEqual({ score: 0, flags: [] });
    expect(shouldHold(r.score)).toBe(false);
  });

  it("lonjakan: tepat di ambang tidak dihitung, di atasnya dihitung", () => {
    const edge = CONFIG.spam.burstThresholdPerBoothPerMin;
    expect(risk({ boothReviewsLastMinute: edge }).flags).toEqual([]);
    expect(risk({ boothReviewsLastMinute: edge + 1 }).flags).toContain("burst");
  });

  it("IP yang sama ke booth yang sama menjadi sinyal, bukan pemblokir", () => {
    const r = risk({ sameIpBoothReviews: CONFIG.spam.sameIpBoothThreshold });
    expect(r.flags).toEqual(["same_ip"]);
    expect(shouldHold(r.score)).toBe(false); // sendirian tidak cukup (WiFi kampus berbagi IP)
  });

  it("akun baru langsung bintang 5 tanpa komentar", () => {
    expect(risk({ visitorAgeMs: 1000, stars: 5, hasComment: false }).flags).toContain(
      "fresh_five_star",
    );
    expect(risk({ visitorAgeMs: 1000, stars: 5, hasComment: true }).flags).toEqual([]);
    expect(risk({ visitorAgeMs: 1000, stars: 4, hasComment: false }).flags).toEqual([]);
  });

  it("pola sabotase: hanya bintang 1 dan 5, minimal beberapa review", () => {
    expect(risk({ stars: 1, otherStars: [5, 5] }).flags).toContain("sabotage_pattern");
    expect(risk({ stars: 1, otherStars: [5] }).flags).toEqual([]); // belum cukup review
    expect(risk({ stars: 1, otherStars: [5, 4] }).flags).toEqual([]); // ada nilai tengah
    expect(risk({ stars: 5, otherStars: [5, 5] }).flags).toEqual([]); // semua 5 = bukan sabotase
  });

  it("kombinasi sinyal melewati ambang tahan", () => {
    const r = risk({
      boothReviewsLastMinute: CONFIG.spam.burstThresholdPerBoothPerMin + 5,
      sameIpBoothReviews: 10,
    });
    expect(r.score).toBe(70);
    expect(shouldHold(r.score)).toBe(true);
  });

  it("hasil filter kata hanya menambah sedikit", () => {
    const r = risk({ filterHit: true });
    expect(r.score).toBeLessThan(CONFIG.spam.holdRiskThreshold);
    expect(r.flags).toEqual(["filter_hit"]);
  });
});
