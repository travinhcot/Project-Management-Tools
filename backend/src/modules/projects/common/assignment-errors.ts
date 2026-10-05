import type { AssignmentRejectReason } from "../model/project-member.model.ts";

import { HttpError } from "../../../shared/http-error.ts";
import { dbError } from "../../../shared/db-error.ts";
import { projectError } from "./project-errors.ts";

export const REASON_MESSAGES: Record<AssignmentRejectReason, string> = {
  ROSTER_MEMBER_NOT_FOUND: "Roster entry not found.",
  ROSTER_MEMBER_OTHER_SEMESTER: "This person is on another semester's roster.",
  ROSTER_MEMBER_INACTIVE: "This roster entry is inactive.",
  ALREADY_ASSIGNED: "This person is already assigned to the project.",
};

/** Single-assign: a rejected id becomes an HTTP error. */
export function reasonToHttpError(reason: AssignmentRejectReason): HttpError {
  return new HttpError(
    reason === "ROSTER_MEMBER_NOT_FOUND" ? 404 : 409,
    reason,
    REASON_MESSAGES[reason],
  );
}

/** Maps a database error from the assignment SQL to an HTTP error; falls back to projectError. */
export function assignmentError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  const { code, message } = dbError(error);
  // Must run before projectError, which maps these codes to project-specific errors.
  if (code === "23505") return reasonToHttpError("ALREADY_ASSIGNED");
  if (code === "23503")
    return reasonToHttpError("ROSTER_MEMBER_OTHER_SEMESTER");
  if (code === "P0002" && message === "ASSIGNMENT_NOT_FOUND") {
    return new HttpError(
      404,
      "ASSIGNMENT_NOT_FOUND",
      "This person is not assigned to the project.",
    );
  }
  if (code === "P0001") {
    switch (message) {
      case "PROJECT_ARCHIVED":
        return new HttpError(
          409,
          "PROJECT_ARCHIVED",
          "Archived projects can't get new members. Unarchive it first.",
        );
      case "ROSTER_MEMBER_INACTIVE":
        return reasonToHttpError("ROSTER_MEMBER_INACTIVE");
      case "ASSIGNMENT_IMMUTABLE":
        return new HttpError(
          409,
          "ASSIGNMENT_IMMUTABLE",
          "Assignment history can't be changed.",
        );
    }
  }
  return projectError(error);
}
