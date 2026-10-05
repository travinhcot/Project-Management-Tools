import { HttpError } from "../../../shared/http-error.ts";
import { dbError } from "../../../shared/db-error.ts";

const UNAVAILABLE = new HttpError(
  503,
  "ROSTER_UNAVAILABLE",
  "Roster management is temporarily unavailable.",
);

/** Maps a database error from the roster SQL functions/tables to an HTTP error. */
export function memberError(error: unknown): HttpError {
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
    if (message === "ROSTER_MEMBER_NOT_FOUND")
      return new HttpError(
        404,
        "ROSTER_MEMBER_NOT_FOUND",
        "Roster member not found.",
      );
  }
  if (code === "23505") {
    return new HttpError(
      409,
      "ROSTER_MEMBER_EXISTS",
      "This email is already on the roster of that semester.",
    );
  }
  return UNAVAILABLE;
}
