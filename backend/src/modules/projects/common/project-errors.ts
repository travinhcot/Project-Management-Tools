import { HttpError } from "../../../shared/http-error.ts";
import { dbError } from "../../../shared/db-error.ts";

const UNAVAILABLE = new HttpError(
  503,
  "PROJECTS_UNAVAILABLE",
  "Project management is temporarily unavailable.",
);

/** Maps a database error from the project SQL functions/tables to an HTTP error. */
export function projectError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  const { code, message } = dbError(error);
  if (code === "42501") {
    return new HttpError(
      403,
      "FORBIDDEN",
      "You do not have permission for this action.",
    );
  }
  if (
    code === "22023" ||
    code === "23514" ||
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
  if (code === "P0002") {
    if (message === "SEMESTER_NOT_FOUND")
      return new HttpError(404, "SEMESTER_NOT_FOUND", "Semester not found.");
    if (message === "PROJECT_NOT_FOUND")
      return new HttpError(404, "PROJECT_NOT_FOUND", "Project not found.");
  }
  if (code === "23505") {
    return new HttpError(
      409,
      "PROJECT_NAME_EXISTS",
      "A project with this name already exists in that semester.",
    );
  }
  if (code === "23503") {
    return new HttpError(
      409,
      "PROJECT_SEMESTER_LOCKED",
      "Projects with assignments or campaigns can't move to another semester.",
    );
  }
  if (code === "P0001") {
    switch (message) {
      case "PROJECT_STALE":
        return new HttpError(
          409,
          "PROJECT_STALE",
          "This project was changed by someone else. Reload and try again.",
        );
      case "PROJECT_ARCHIVED":
        return new HttpError(
          409,
          "PROJECT_ARCHIVED",
          "This project is archived. Unarchive it first.",
        );
      case "PROJECT_HAS_BOM":
        return new HttpError(
          409,
          "PROJECT_HAS_BOM",
          "Remove the BOM before changing the type away from HARDWARE.",
        );
      case "PROJECT_HAS_RESEARCH_TEMPLATE":
        return new HttpError(
          409,
          "PROJECT_HAS_RESEARCH_TEMPLATE",
          "Remove the research template before changing the type away from RESEARCH.",
        );
      case "PROJECT_HAS_ASSIGNMENTS":
        return new HttpError(
          409,
          "PROJECT_SEMESTER_LOCKED",
          "Projects with assignments or campaigns can't move to another semester.",
        );
      case "PROJECT_ALREADY_ARCHIVED":
        return new HttpError(
          409,
          "PROJECT_ALREADY_ARCHIVED",
          "This project is already archived.",
        );
      case "PROJECT_NOT_ARCHIVED":
        return new HttpError(
          409,
          "PROJECT_NOT_ARCHIVED",
          "This project is not archived.",
        );
    }
  }
  return UNAVAILABLE;
}
