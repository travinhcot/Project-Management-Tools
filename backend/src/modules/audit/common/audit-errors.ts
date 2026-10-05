import { HttpError } from "../../../shared/http-error.ts";
import { dbError } from "../../../shared/db-error.ts";

export const EVENT_NOT_FOUND = new HttpError(
  404,
  "AUDIT_EVENT_NOT_FOUND",
  "Audit event not found.",
);

const UNAVAILABLE = new HttpError(
  503,
  "AUDIT_UNAVAILABLE",
  "The audit log is temporarily unavailable.",
);

/** Maps a database error from the audit SQL functions to an HTTP error. */
export function auditError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  const { code } = dbError(error);
  if (code === "42501") {
    return new HttpError(
      403,
      "FORBIDDEN",
      "You do not have permission for this action.",
    );
  }
  if (
    code === "22023" ||
    code === "22P02" ||
    code === "22007" ||
    code === "22008"
  ) {
    return new HttpError(
      400,
      "INVALID_INPUT",
      "The request contains invalid values.",
    );
  }
  return UNAVAILABLE;
}
