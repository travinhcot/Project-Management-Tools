import { HttpError } from "../../../shared/http-error.ts";
import { dbError } from "../../../shared/db-error.ts";

const UNAVAILABLE = new HttpError(
  503,
  "RESOURCES_UNAVAILABLE",
  "Resources and files are temporarily unavailable.",
);

/** Maps a database error from the files SQL functions/tables to an HTTP error. */
export function resourceError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  const { code, message } = dbError(error);
  if (code === "42501") {
    return new HttpError(
      403,
      "FORBIDDEN",
      "You do not have permission for this action.",
    );
  }
  if (code === "22023" || code === "23514" || code === "22P02") {
    return new HttpError(
      400,
      "INVALID_INPUT",
      "The request contains invalid values.",
    );
  }
  if (code === "P0002") {
    if (message === "PROJECT_NOT_FOUND")
      return new HttpError(404, "PROJECT_NOT_FOUND", "Project not found.");
    if (message === "RESOURCE_NOT_FOUND")
      return new HttpError(
        404,
        "RESOURCE_NOT_FOUND",
        "This slot has no resource.",
      );
    if (message === "FILE_NOT_FOUND")
      return new HttpError(404, "FILE_NOT_FOUND", "File not found.");
  }
  if (code === "P0001") {
    switch (message) {
      case "PROJECT_ARCHIVED":
        return new HttpError(
          409,
          "PROJECT_ARCHIVED",
          "This project is archived. Unarchive it first.",
        );
      case "RESOURCE_SLOT_NOT_ALLOWED":
        return new HttpError(
          409,
          "RESOURCE_SLOT_NOT_ALLOWED",
          "A BOM is only allowed on hardware projects.",
        );
      case "RESOURCE_SOURCE_NOT_ALLOWED":
        return new HttpError(
          409,
          "RESOURCE_SOURCE_NOT_ALLOWED",
          "This slot does not accept that kind of source.",
        );
      case "FILE_NOT_PENDING":
      case "RESOURCE_FILE_MISMATCH":
        return new HttpError(
          409,
          "FILE_STATE_CONFLICT",
          "The file is not in a state that allows this.",
        );
    }
  }
  return UNAVAILABLE;
}
