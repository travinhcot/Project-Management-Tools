import { HttpError } from "../../../shared/http-error.ts";
import { dbError } from "../../../shared/db-error.ts";

const UNAVAILABLE = new HttpError(
  503,
  "DASHBOARD_UNAVAILABLE",
  "The dashboard is temporarily unavailable.",
);

/** Maps a database error from the dashboard SQL functions to an HTTP error. */
export function dashboardError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  if (dbError(error).code === "42501") {
    return new HttpError(
      403,
      "FORBIDDEN",
      "You do not have permission for this action.",
    );
  }
  return UNAVAILABLE;
}
