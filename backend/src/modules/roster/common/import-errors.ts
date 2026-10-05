import { HttpError } from "../../../shared/http-error.ts";
import { dbError } from "../../../shared/db-error.ts";

const UNAVAILABLE = new HttpError(
  503,
  "ROSTER_UNAVAILABLE",
  "Roster management is temporarily unavailable.",
);

/** Maps a database error from the roster SQL functions/tables to an HTTP error. */
export function importError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  const { code, message } = dbError(error);
  if (code === "42501") {
    return new HttpError(
      403,
      "FORBIDDEN",
      "You do not have permission for this action.",
    );
  }
  if (code === "22023" || code === "23514") {
    return new HttpError(
      400,
      "INVALID_INPUT",
      "The request contains invalid values.",
    );
  }
  if (code === "P0002") {
    if (message === "SEMESTER_NOT_FOUND")
      return new HttpError(404, "SEMESTER_NOT_FOUND", "Semester not found.");
    if (message === "IMPORT_NOT_FOUND")
      return new HttpError(404, "IMPORT_NOT_FOUND", "Roster import not found.");
  }
  if (code === "23505") {
    return new HttpError(
      409,
      "ROSTER_MEMBER_EXISTS",
      "This email is already on the roster of that semester.",
    );
  }
  if (code === "P0001") {
    if (message === "IMPORT_NOT_PREVIEWED") {
      return new HttpError(
        409,
        "IMPORT_ALREADY_PROCESSED",
        "This import was already committed or has expired.",
      );
    }
    if (message === "IMPORT_EXPIRED") {
      return new HttpError(
        409,
        "IMPORT_EXPIRED",
        "This preview expired. Upload the file again.",
      );
    }
    if (message === "IMPORT_HAS_NO_VALID_ROWS") {
      return new HttpError(
        409,
        "IMPORT_HAS_NO_VALID_ROWS",
        "The preview has no valid rows to import.",
      );
    }
  }
  return UNAVAILABLE;
}
