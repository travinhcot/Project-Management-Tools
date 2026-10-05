import { HttpError } from "../../../shared/http-error.ts";
import { dbError } from "../../../shared/db-error.ts";

const UNAVAILABLE = new HttpError(
  503,
  "EMAILS_UNAVAILABLE",
  "Email campaigns are temporarily unavailable.",
);

const CONFLICTS: Readonly<Record<string, string>> = {
  CAMPAIGN_EXISTS: "An active campaign of this kind already exists.",
  CAMPAIGN_NOT_RESCHEDULABLE: "Only scheduled campaigns can be rescheduled.",
  CAMPAIGN_NOT_CANCELLABLE: "Only draft or scheduled campaigns can be cancelled.",
  CAMPAIGN_NOT_RESENDABLE: "Only finished campaigns can be resent.",
  CAMPAIGN_NOT_RETRYABLE: "This campaign has no finished failures to retry.",
  NO_FAILED_DELIVERIES: "This campaign has no failed deliveries to retry.",
  DELIVERY_NOT_UNKNOWN: "Only deliveries with an unknown result can be resolved.",
  PROJECT_ARCHIVED: "This project is archived.",
};

const NOT_FOUND: Readonly<Record<string, string>> = {
  CAMPAIGN_NOT_FOUND: "Campaign not found.",
  DELIVERY_NOT_FOUND: "Delivery not found.",
  PROJECT_NOT_FOUND: "Project not found.",
  SEMESTER_NOT_FOUND: "Semester not found.",
};

/** Maps a database error from the email SQL functions/tables to an HTTP error. */
export function emailError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  const { code, message } = dbError(error);
  if (code === "42501") {
    return new HttpError(
      403,
      "FORBIDDEN",
      "You do not have permission for this action.",
    );
  }
  if (code === "22023" && message === "SCHEDULE_IN_PAST") {
    return new HttpError(
      400,
      "SCHEDULE_IN_PAST",
      "The scheduled time must be in the future.",
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
  if (code === "P0002" && message && NOT_FOUND[message]) {
    return new HttpError(404, message, NOT_FOUND[message]);
  }
  if (code === "23505") {
    return new HttpError(409, "CAMPAIGN_EXISTS", CONFLICTS.CAMPAIGN_EXISTS);
  }
  if (code === "P0001" && message === "DEMO_URL_REQUIRED") {
    return new HttpError(
      400,
      "DEMO_URL_REQUIRED",
      "Set the semester's demo registration URL first.",
    );
  }
  if (code === "P0001" && message && CONFLICTS[message]) {
    return new HttpError(409, message, CONFLICTS[message]);
  }
  return UNAVAILABLE;
}
