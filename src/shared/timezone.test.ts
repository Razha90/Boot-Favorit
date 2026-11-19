import { describe, expect, it } from "vitest";
import { epochToZonedLocal, tzOffsetMs, zonedLocalToEpoch } from "./timezone";

const JAKARTA = "Asia/Jakarta";
const HOUR = 3_600_000;

describe("zona waktu", () => {
  it("Asia/Jakarta = UTC+7 sepanjang tahun", () => {
    expect(tzOffsetMs(Date.UTC(2026, 0, 1), JAKARTA)).toBe(7 * HOUR);
    expect(tzOffsetMs(Date.UTC(2026, 6, 1), JAKARTA)).toBe(7 * HOUR);
  });

  it("lokal → epoch: 09.30 WIB = 02.30 UTC", () => {
    expect(zonedLocalToEpoch("2026-11-20T09:30", JAKARTA)).toBe(Date.UTC(2026, 10, 20, 2, 30));
  });

  it("epoch → lokal: kebalikannya, dan bolak-balik konsisten", () => {
    const epoch = Date.UTC(2026, 10, 20, 2, 30);
    expect(epochToZonedLocal(epoch, JAKARTA)).toBe("2026-11-20T09:30");
    for (const local of ["2026-01-01T00:00", "2026-12-31T23:59", "2026-06-15T12:00"]) {
      const e = zonedLocalToEpoch(local, JAKARTA);
      expect(e).not.toBeNull();
      expect(epochToZonedLocal(e ?? 0, JAKARTA)).toBe(local);
    }
  });

  it("tengah malam WIB jatuh pada hari sebelumnya di UTC", () => {
    expect(zonedLocalToEpoch("2026-11-20T00:00", JAKARTA)).toBe(Date.UTC(2026, 10, 19, 17, 0));
  });

  it("memperhitungkan waktu musim panas di zona lain (New York)", () => {
    const NY = "America/New_York";
    expect(tzOffsetMs(Date.UTC(2026, 0, 15, 12), NY)).toBe(-5 * HOUR); // musim dingin
    expect(tzOffsetMs(Date.UTC(2026, 6, 15, 12), NY)).toBe(-4 * HOUR); // musim panas
    expect(zonedLocalToEpoch("2026-07-15T08:00", NY)).toBe(Date.UTC(2026, 6, 15, 12, 0));
    expect(zonedLocalToEpoch("2026-01-15T08:00", NY)).toBe(Date.UTC(2026, 0, 15, 13, 0));
  });

  it("menolak format yang tidak valid", () => {
    for (const bad of ["", "2026-11-20", "20/11/2026 09:30", "2026-11-20 09:30", "abc"]) {
      expect(zonedLocalToEpoch(bad, JAKARTA)).toBeNull();
    }
  });
});
