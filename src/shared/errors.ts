// Kode galat API: SATU daftar bersama client dan server (explore.md B14 aturan 7).
// Server menjawab { code, message?, details? }; UI memetakan code ke teks di lib/copy.ts.

export const ERROR_STATUS = {
  // Umum
  validation_error: 400,
  idempotency_key_required: 400,
  reason_required: 400,
  invalid_image: 400,
  payload_too_large: 413,
  unauthorized: 401,
  owner_changed: 401,
  booth_not_editable: 403,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  idempotency_mismatch: 422,
  rate_limited: 429,
  internal_error: 500,
  // Jadwal event (B17)
  no_active_event: 409,
  registration_closed: 403,
  voting_closed: 403,
  event_ended: 403,
  // Aksi tulis ganda / bersamaan (B21)
  request_in_progress: 409,
  // Reviewer (A5, A6)
  turnstile_failed: 403,
  visitor_blocked: 403,
  own_booth: 403,
  otp_invalid: 400,
  otp_expired: 400,
  otp_cooldown: 429,
  login_failed: 401,
  // Domain
  email_in_use: 409,
  product_limit: 409,
  photo_limit: 409,
  version_conflict: 409,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export const isErrorCode = (v: unknown): v is ErrorCode =>
  typeof v === "string" && Object.hasOwn(ERROR_STATUS, v);

export interface ApiErrorBody {
  code: ErrorCode;
  message?: string;
  details?: unknown;
}

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly details: unknown;

  constructor(code: ErrorCode, message?: string, details?: unknown) {
    super(message ?? code);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
  }

  get status(): number {
    return ERROR_STATUS[this.code];
  }

  toBody(): ApiErrorBody {
    const body: ApiErrorBody = { code: this.code };
    if (this.message !== this.code) body.message = this.message;
    if (this.details !== undefined) body.details = this.details;
    return body;
  }
}
