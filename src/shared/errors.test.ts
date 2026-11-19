import { describe, expect, it } from "vitest";
import { ApiError, ERROR_STATUS, isErrorCode } from "./errors";

describe("errors", () => {
  it("setiap kode memiliki status HTTP yang valid", () => {
    for (const status of Object.values(ERROR_STATUS)) {
      expect(status).toBeGreaterThanOrEqual(400);
      expect(status).toBeLessThan(600);
    }
  });

  it("kode jadwal event sesuai B17", () => {
    expect(ERROR_STATUS.registration_closed).toBe(403);
    expect(ERROR_STATUS.voting_closed).toBe(403);
    expect(ERROR_STATUS.event_ended).toBe(403);
    expect(ERROR_STATUS.idempotency_mismatch).toBe(422);
    expect(ERROR_STATUS.request_in_progress).toBe(409);
  });

  it("isErrorCode hanya menerima kode yang terdaftar", () => {
    expect(isErrorCode("event_ended")).toBe(true);
    expect(isErrorCode("toString")).toBe(false);
    expect(isErrorCode(42)).toBe(false);
  });

  it("ApiError menghasilkan badan { code } yang ringkas", () => {
    const e = new ApiError("product_limit");
    expect(e.status).toBe(409);
    expect(e.toBody()).toEqual({ code: "product_limit" });
    expect(new ApiError("validation_error", "bad", { f: 1 }).toBody()).toEqual({
      code: "validation_error",
      message: "bad",
      details: { f: 1 },
    });
  });
});
