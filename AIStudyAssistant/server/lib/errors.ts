/** Stable error codes; the client translates them into kk/ru/en messages. */
export type ErrorCode =
  | "VALIDATION"
  | "EMAIL_TAKEN"
  | "INVALID_CREDENTIALS"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "AI_UNAVAILABLE"
  | "SEARCH_UNAVAILABLE"
  | "NO_SOURCES"
  | "FILE_INVALID"
  | "IMAGE_INVALID"
  | "STORAGE_FAILED"
  | "DB_UNAVAILABLE"
  | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION: 400,
  EMAIL_TAKEN: 409,
  INVALID_CREDENTIALS: 401,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  AI_UNAVAILABLE: 503,
  SEARCH_UNAVAILABLE: 503,
  NO_SOURCES: 404,
  FILE_INVALID: 400,
  IMAGE_INVALID: 400,
  STORAGE_FAILED: 500,
  DB_UNAVAILABLE: 503,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly field?: string;

  constructor(code: ErrorCode, message?: string, field?: string) {
    super(message ?? code);
    this.code = code;
    this.status = STATUS[code];
    this.field = field;
  }
}
