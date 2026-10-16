import { HttpError } from "../../../shared/http-error.ts";
import { dbError } from "../../../shared/db-error.ts";

const UNAVAILABLE = new HttpError(
  503,
  "DEPARTMENT_RESOURCES_UNAVAILABLE",
  "Department resources are temporarily unavailable.",
);

/** Maps a database error from the department_resources SQL functions to an HTTP error. */
export function departmentResourceError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  const { code, message } = dbError(error);
  if (code === "42501") {
    return new HttpError(403, "FORBIDDEN", "You do not have permission for this action.");
  }
  if (code === "22023") {
    if (message === "DEPARTMENT_REQUIRED") {
      return new HttpError(400, "DEPARTMENT_REQUIRED", "Choose a department (department=TECH|MARCOM|HR).");
    }
    return new HttpError(400, "INVALID_INPUT", "The request contains invalid values.");
  }
  if (code === "23514" || code === "22P02" || code === "22001") {
    return new HttpError(400, "INVALID_INPUT", "The request contains invalid values.");
  }
  if (code === "P0002") {
    if (message === "FILE_NOT_FOUND") return new HttpError(404, "FILE_NOT_FOUND", "File not found.");
    return new HttpError(404, "RESOURCE_NOT_FOUND", "Resource not found.");
  }
  if (code === "P0001") {
    if (message === "RESOURCE_NOT_A_LINK") {
      return new HttpError(409, "RESOURCE_NOT_A_LINK", "Only a link can have its address changed. Upload a new file instead.");
    }
    if (message === "FILE_NOT_PENDING") {
      return new HttpError(409, "FILE_STATE_CONFLICT", "The file is not in a state that allows this.");
    }
  }
  return UNAVAILABLE;
}
