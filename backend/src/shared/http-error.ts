import type { ErrorRequestHandler } from "express";

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  const errorType = error && typeof error === "object" && "type" in error ? error.type : undefined;
  const status =
    error instanceof HttpError
      ? error.status
      : errorType === "entity.parse.failed"
        ? 400
        : errorType === "entity.too.large"
          ? 413
          : 500;
  res.status(status).json({
    error: {
      code:
        error instanceof HttpError && error.code
          ? error.code
          : status === 400
            ? "INVALID_JSON"
            : status === 413
              ? "BODY_TOO_LARGE"
              : "INTERNAL_ERROR",
      message:
        error instanceof HttpError
          ? error.message
          : status === 400
            ? "Invalid JSON body."
            : status === 413
              ? "Request body is too large."
              : "An unexpected error occurred.",
    },
  });
}
