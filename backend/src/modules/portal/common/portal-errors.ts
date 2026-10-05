import { HttpError } from "../../../shared/http-error.ts";

export const NOT_ELIGIBLE = new HttpError(
  403,
  "NOT_ELIGIBLE",
  "You do not have access to the member portal.",
);

/** D-09: unknown, archived, unassigned and other-semester projects all look the same. */
export const PROJECT_NOT_FOUND = new HttpError(
  404,
  "PROJECT_NOT_FOUND",
  "Project not found.",
);

const UNAVAILABLE = new HttpError(
  503,
  "PORTAL_UNAVAILABLE",
  "The member portal is temporarily unavailable.",
);

/** Anything that is not already an HttpError becomes a generic 503 (no database details leak). */
export function portalError(error: unknown): HttpError {
  return error instanceof HttpError ? error : UNAVAILABLE;
}
