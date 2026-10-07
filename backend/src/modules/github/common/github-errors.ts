import { HttpError } from "../../../shared/http-error.ts";

export const PROJECT_NOT_FOUND = new HttpError(
  404,
  "PROJECT_NOT_FOUND",
  "Project not found.",
);

const UNAVAILABLE = new HttpError(
  503,
  "GITHUB_UNAVAILABLE",
  "GitHub activity is temporarily unavailable.",
);

/** Anything that is not already an HttpError becomes a generic 503 (no database details leak). */
export function githubError(error: unknown): HttpError {
  return error instanceof HttpError ? error : UNAVAILABLE;
}
