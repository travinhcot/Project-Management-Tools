import type { ImportRowStatus } from "../model/roster-import.model.ts";

import {
  invalid,
  objectBody,
  rejectUnknownKeys,
  single,
} from "../../../shared/query-params.ts";
import { pageOf } from "../../../shared/pagination.ts";
import { IMPORT_ROW_STATUSES } from "../model/roster-import.model.ts";

export const CSV_CONTENT_TYPES = [
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel", // Windows reports .csv files like this
];

/** `?filename=` — base name only, must end in .csv. */
export function uploadFilename(query: Record<string, unknown>): string {
  rejectUnknownKeys(
    query,
    ["filename"],
    "The request contains invalid query parameters.",
  );
  const raw = single(query, "filename");
  if (raw === undefined) invalid("Query parameter filename is required.");
  const base = raw.split(/[\\/]/).pop()!.trim();
  // eslint-disable-next-line no-control-regex
  if (!base || [...base].length > 255 || /[\u0000-\u001f\u007f]/.test(base)) {
    invalid("filename must be 1-255 characters without control characters.");
  }
  if (!/\.csv$/i.test(base)) invalid("Only .csv files are accepted.");
  return base;
}

export function historyQuery(query: Record<string, unknown>) {
  rejectUnknownKeys(
    query,
    ["page", "size"],
    "The request contains invalid query parameters.",
  );
  return pageOf(query);
}

export function rowsQuery(query: Record<string, unknown>) {
  rejectUnknownKeys(
    query,
    ["status", "page", "size"],
    "The request contains invalid query parameters.",
  );
  const status = single(query, "status");
  if (
    status !== undefined &&
    !IMPORT_ROW_STATUSES.includes(status as ImportRowStatus)
  ) {
    invalid("status must be VALID, UPDATE, INVALID or DUPLICATE.");
  }
  return {
    status: status as ImportRowStatus | undefined,
    ...pageOf(query, 50),
  };
}

export function missingQuery(query: Record<string, unknown>) {
  rejectUnknownKeys(
    query,
    ["page", "size"],
    "The request contains invalid query parameters.",
  );
  return pageOf(query, 50);
}

export function commitBody(body: unknown): { deactivate_missing: boolean } {
  if (body === undefined) return { deactivate_missing: false };
  const input = objectBody(body);
  rejectUnknownKeys(
    input,
    ["deactivate_missing"],
    "Only deactivate_missing can be provided.",
  );
  if (
    input.deactivate_missing !== undefined &&
    typeof input.deactivate_missing !== "boolean"
  ) {
    invalid("deactivate_missing must be true or false.");
  }
  return { deactivate_missing: input.deactivate_missing === true };
}
