import { describe, expect, it } from "vitest";
import { formatAverage, formatRelative, formatRupiah, formatRupiahShort } from "./format";

describe("formatRupiah", () => {
  it("memakai pemisah ribuan id-ID dan 0 = Gratis", () => {
    expect(formatRupiah(18000)).toBe("Rp 18.000");
    expect(formatRupiah(0)).toBe("Gratis");
  });
});

describe("formatRupiahShort (stiker)", () => {
  it("ribuan menjadi rb, jutaan menjadi jt, dengan koma desimal", () => {
    expect(formatRupiahShort(14000)).toBe("Rp 14rb");
    expect(formatRupiahShort(14500)).toBe("Rp 14,5rb");
    expect(formatRupiahShort(1_500_000)).toBe("Rp 1,5jt");
    expect(formatRupiahShort(2_000_000)).toBe("Rp 2jt");
  });

  it("di bawah seribu apa adanya; 0 = Gratis", () => {
    expect(formatRupiahShort(500)).toBe("Rp 500");
    expect(formatRupiahShort(0)).toBe("Gratis");
  });
});

describe("formatAverage", () => {
  it("satu desimal dengan koma", () => {
    expect(formatAverage(4.66)).toBe("4,7");
    expect(formatAverage(5)).toBe("5,0");
  });
});

describe("formatRelative", () => {
  it("memilih satuan terbesar yang sesuai", () => {
    const now = 1_000_000_000;
    expect(formatRelative(now + 3 * 86_400_000, now)).toContain("3");
    expect(formatRelative(now + 3 * 3_600_000, now)).toContain("3");
    expect(formatRelative(now - 2 * 60_000, now)).toContain("2");
  });
});
